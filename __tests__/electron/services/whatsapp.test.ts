import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createWhatsAppService, type WhatsAppDeps } from '../../../electron/services/whatsapp'
import { LOGGED_OUT_CODE } from '../../../electron/services/whatsapp-state'

interface FakeSocket {
  ev: { on: ReturnType<typeof vi.fn> }
  end: ReturnType<typeof vi.fn>
  logout: ReturnType<typeof vi.fn>
  user?: { id?: string; phoneNumber?: string; lid?: string }
  _handlers: Map<string, ((...args: unknown[]) => void)[]>
  _trigger: (event: string, ...args: unknown[]) => void
}

function makeFakeSocket(user?: FakeSocket['user']): FakeSocket {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>()
  const sock: FakeSocket = {
    ev: {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        const list = handlers.get(event) ?? []
        list.push(handler)
        handlers.set(event, list)
      })
    },
    end: vi.fn(),
    logout: vi.fn(async () => {}),
    user,
    _handlers: handlers,
    _trigger: (event, ...args) => {
      for (const h of handlers.get(event) ?? []) h(...args)
    }
  }
  return sock
}

interface Harness {
  service: ReturnType<typeof createWhatsAppService>
  socket: FakeSocket
  deps: Required<Pick<WhatsAppDeps,
    'socketFactory' | 'authStateFactory' | 'versionFactory' | 'browser'
    | 'makeKeyStore' | 'rmAuth' | 'scheduleReconnect' | 'cancelReconnect'
    | 'initialBackoffMs' | 'maxBackoffMs' | 'authPath'
  >>
  saveCreds: ReturnType<typeof vi.fn>
  reconnectCalls: { cb: () => void; ms: number }[]
  fireReconnect: () => void
}

interface HarnessOpts extends Partial<WhatsAppDeps> {
  userId?: string
  user?: FakeSocket['user']
  authMe?: FakeSocket['user']
}

async function buildHarness(overrides: HarnessOpts = {}): Promise<Harness> {
  const { userId, user, authMe, ...waOverrides } = overrides
  const socketUser = user ?? (userId ? { id: userId } : undefined)
  let socket: FakeSocket = makeFakeSocket(socketUser)
  const sockets: FakeSocket[] = [socket]
  const saveCreds = vi.fn(async () => {})
  const reconnectCalls: { cb: () => void; ms: number }[] = []

  const deps: WhatsAppDeps = {
    authPath: '/tmp/auth-test',
    socketFactory: vi.fn(() => {
      // each connect creates a new fake socket
      socket = makeFakeSocket(socketUser)
      sockets.push(socket)
      return socket
    }),
    authStateFactory: vi.fn(async () => ({
      state: { creds: { id: 'creds', me: authMe }, keys: { id: 'keys' } },
      saveCreds
    })),
    versionFactory: vi.fn(async () => ({ version: [2, 3000, 0], isLatest: true })),
    browser: ['Test', 'Desktop', '1.0'],
    makeKeyStore: vi.fn((keys: unknown) => keys),
    rmAuth: vi.fn(async () => {}),
    scheduleReconnect: vi.fn((cb: () => void, ms: number) => {
      const handle = { cb, ms }
      reconnectCalls.push(handle)
      return handle
    }),
    cancelReconnect: vi.fn(),
    initialBackoffMs: 1000,
    maxBackoffMs: 30_000,
    ...waOverrides
  }

  const service = createWhatsAppService(deps)

  await service.start()

  return {
    service,
    get socket() {
      return sockets[sockets.length - 1]!
    },
    deps: deps as Harness['deps'],
    saveCreds,
    reconnectCalls,
    fireReconnect: () => {
      const last = reconnectCalls.pop()
      if (!last) throw new Error('no scheduled reconnect to fire')
      last.cb()
    }
  } as unknown as Harness
}

describe('whatsapp service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('start', () => {
    it('creates a socket with all required Baileys flags', async () => {
      const h = await buildHarness()
      expect(h.deps.socketFactory).toHaveBeenCalledTimes(1)
      const opts = (h.deps.socketFactory as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Record<string, unknown>
      expect(opts.syncFullHistory).toBe(true)
      expect(opts.markOnlineOnConnect).toBe(false)
      expect(opts.keepAliveIntervalMs).toBe(25_000)
      expect(opts.connectTimeoutMs).toBe(60_000)
      expect(opts.defaultQueryTimeoutMs).toBe(60_000)
      expect(opts.retryRequestDelayMs).toBe(1_000)
      expect(opts.maxMsgRetryCount).toBe(5)
      expect(typeof opts.getMessage).toBe('function')
      expect(opts.browser).toEqual(['Test', 'Desktop', '1.0'])
    })

    it('getMessage returns undefined to satisfy retry contract', async () => {
      const h = await buildHarness()
      const opts = (h.deps.socketFactory as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Record<string, unknown>
      const getMessage = opts.getMessage as () => Promise<unknown>
      await expect(getMessage()).resolves.toBeUndefined()
    })

    it('wraps key store with makeCacheableSignalKeyStore', async () => {
      const h = await buildHarness()
      expect(h.deps.makeKeyStore).toHaveBeenCalledTimes(1)
    })

    it('registers connection.update and creds.update handlers', async () => {
      const h = await buildHarness()
      const events = h.socket.ev.on.mock.calls.map((c) => c[0])
      expect(events).toContain('connection.update')
      expect(events).toContain('creds.update')
    })

    it('starts in connecting state and emits the transition', async () => {
      const onState = vi.fn()
      const sock = makeFakeSocket()
      const service = createWhatsAppService({
        authPath: '/tmp/x',
        socketFactory: () => sock,
        authStateFactory: async () => ({ state: { creds: {}, keys: {} }, saveCreds: async () => {} }),
        versionFactory: async () => ({ version: [2, 3000, 0] }),
        browser: ['x', 'y', 'z'],
        makeKeyStore: (k: any) => k,
        rmAuth: async () => {},
        scheduleReconnect: () => null,
        cancelReconnect: () => {}
      })
      service.on('connection-state', onState)
      await service.start()
      expect(onState).toHaveBeenCalledWith('connecting')
      expect(service.getState()).toBe('connecting')
    })
  })

  describe('connection updates', () => {
    it('emits qr event and stores currentQr', async () => {
      const h = await buildHarness()
      const onQr = vi.fn()
      h.service.on('qr', onQr)
      h.socket._trigger('connection.update', { qr: 'ABC123' })
      expect(onQr).toHaveBeenCalledWith('ABC123')
      expect(h.service.getCurrentQr()).toBe('ABC123')
    })

    it('open transition emits connection-state and clears qr', async () => {
      const h = await buildHarness()
      h.socket._trigger('connection.update', { qr: 'PRE' })
      expect(h.service.getCurrentQr()).toBe('PRE')

      const onState = vi.fn()
      h.service.on('connection-state', onState)
      h.socket._trigger('connection.update', { connection: 'open' })
      expect(onState).toHaveBeenCalledWith('open')
      expect(h.service.getState()).toBe('open')
      expect(h.service.getCurrentQr()).toBeNull()
    })

    it('close (non-logged-out) schedules reconnect with growing backoff', async () => {
      const h = await buildHarness({ authMe: { id: '5491134567890@s.whatsapp.net' } })
      h.socket._trigger('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 515 } } }
      })
      expect(h.reconnectCalls.length).toBe(1)
      expect(h.reconnectCalls[0]!.ms).toBe(2000) // initial 1000 doubled

      h.fireReconnect()
      // a fresh connect happens; trigger another close
      h.socket._trigger('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 515 } } }
      })
      expect(h.reconnectCalls[h.reconnectCalls.length - 1]!.ms).toBe(4000)
    })

    it('close during pairing schedules reconnect with fixed initial backoff', async () => {
      const h = await buildHarness() // authMe is undefined -> pairing
      h.socket._trigger('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 515 } } }
      })
      expect(h.reconnectCalls.length).toBe(1)
      expect(h.reconnectCalls[0]!.ms).toBe(1000) // initialBackoffMs since it's pairing

      h.fireReconnect()
      h.socket._trigger('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 515 } } }
      })
      expect(h.reconnectCalls[h.reconnectCalls.length - 1]!.ms).toBe(1000)
    })

    it('open after close resets backoff', async () => {
      const h = await buildHarness({ authMe: { id: '5491134567890@s.whatsapp.net' } })
      h.socket._trigger('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 515 } } }
      })
      h.fireReconnect()
      h.socket._trigger('connection.update', { connection: 'open' })

      h.socket._trigger('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 515 } } }
      })
      // backoff should be 2000 again (initial after reset)
      expect(h.reconnectCalls[h.reconnectCalls.length - 1]!.ms).toBe(2000)
    })

    it('backoff caps at maxBackoffMs', async () => {
      const h = await buildHarness({ authMe: { id: '5491134567890@s.whatsapp.net' }, maxBackoffMs: 4000 })
      const close = () =>
        h.socket._trigger('connection.update', {
          connection: 'close',
          lastDisconnect: { error: { output: { statusCode: 515 } } }
        })
      close() // 2000
      h.fireReconnect()
      close() // 4000
      h.fireReconnect()
      close() // capped at 4000
      expect(h.reconnectCalls[h.reconnectCalls.length - 1]!.ms).toBe(4000)
    })

    it('logged-out close fires logged-out event and clears auth', async () => {
      const h = await buildHarness()
      const onLoggedOut = vi.fn()
      h.service.on('logged-out', onLoggedOut)
      h.socket._trigger('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: LOGGED_OUT_CODE } } }
      })
      // State transition and 'logged-out' event fire AFTER rmAuth resolves,
      // so the renderer can never race a new connect() against a partial delete.
      await Promise.resolve()
      expect(h.deps.rmAuth).toHaveBeenCalledWith('/tmp/auth-test')
      expect(onLoggedOut).toHaveBeenCalledTimes(1)
      expect(h.reconnectCalls.length).toBe(0)
      expect(h.service.getState()).toBe('logged-out')
    })

    it('logged-out path tolerates rmAuth failure (logs, does not throw)', async () => {
      const rmAuth = vi.fn(async () => {
        throw new Error('disk full')
      })
      const h = await buildHarness({ rmAuth })
      h.socket._trigger('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: LOGGED_OUT_CODE } } }
      })
      // microtask drain
      await new Promise((r) => setTimeout(r, 0))
      expect(rmAuth).toHaveBeenCalled()
      expect(h.service.getState()).toBe('logged-out')
    })

    it('saveCreds is invoked when creds.update fires', async () => {
      const h = await buildHarness()
      h.socket._trigger('creds.update')
      await Promise.resolve()
      expect(h.saveCreds).toHaveBeenCalledTimes(1)
    })

    it('saveCreds failure is logged but does not throw', async () => {
      const failingSaveCreds = vi.fn(async () => {
        throw new Error('save fail')
      })
      const h = await buildHarness({
        authStateFactory: async () => ({
          state: { creds: {}, keys: {} },
          saveCreds: failingSaveCreds
        })
      })
      expect(() => h.socket._trigger('creds.update')).not.toThrow()
      await new Promise((r) => setTimeout(r, 0))
      expect(failingSaveCreds).toHaveBeenCalled()
    })
  })

  describe('stop', () => {
    it('clears reconnect timer if pending', async () => {
      const h = await buildHarness()
      h.socket._trigger('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 515 } } }
      })
      expect(h.reconnectCalls.length).toBe(1)

      await h.service.stop()
      expect(h.deps.cancelReconnect).toHaveBeenCalled()
    })

    it('calls socket.end', async () => {
      const h = await buildHarness()
      const sockBefore = h.socket
      await h.service.stop()
      expect(sockBefore.end).toHaveBeenCalled()
    })

    it('clears currentQr, emits qr null event, and deletes auth if not logged in', async () => {
      const h = await buildHarness()
      const onQr = vi.fn()
      h.service.on('qr', onQr)
      h.socket._trigger('connection.update', { qr: 'XYZ' })
      expect(h.service.getCurrentQr()).toBe('XYZ')

      await h.service.stop()
      expect(h.service.getCurrentQr()).toBeNull()
      expect(onQr).toHaveBeenCalledWith(null)
      expect(h.deps.rmAuth).toHaveBeenCalledWith('/tmp/auth-test')
    })

    it('clears currentQr, emits qr null event, but does NOT delete auth if logged in', async () => {
      const h = await buildHarness({ authMe: { id: '5491134567890@s.whatsapp.net' } })
      const onQr = vi.fn()
      h.service.on('qr', onQr)
      h.socket._trigger('connection.update', { qr: 'XYZ' })
      expect(h.service.getCurrentQr()).toBe('XYZ')

      await h.service.stop()
      expect(h.service.getCurrentQr()).toBeNull()
      expect(onQr).toHaveBeenCalledWith(null)
      expect(h.deps.rmAuth).not.toHaveBeenCalled()
    })

    it('after stop, scheduleReconnect from a stale close is ignored', async () => {
      const h = await buildHarness()
      await h.service.stop()
      const beforeCount = h.reconnectCalls.length
      // simulate a late close
      h.socket._trigger('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 515 } } }
      })
      expect(h.reconnectCalls.length).toBe(beforeCount)
    })

    it('tolerates socket.end throwing', async () => {
      const h = await buildHarness()
      h.socket.end.mockImplementation(() => {
        throw new Error('socket already closed')
      })
      await expect(h.service.stop()).resolves.toBeUndefined()
    })
  })

  describe('logout', () => {
    it('clears auth folder, calls socket.logout, emits logged-out', async () => {
      const h = await buildHarness()
      const onLoggedOut = vi.fn()
      h.service.on('logged-out', onLoggedOut)
      const sockBefore = h.socket

      await h.service.logout()
      expect(sockBefore.logout).toHaveBeenCalled()
      expect(h.deps.rmAuth).toHaveBeenCalledWith('/tmp/auth-test')
      expect(onLoggedOut).toHaveBeenCalledTimes(1)
      expect(h.service.getState()).toBe('logged-out')
      expect(h.service.getCurrentQr()).toBeNull()
    })

    it('tolerates socket.logout throwing', async () => {
      const h = await buildHarness()
      h.socket.logout.mockImplementation(async () => {
        throw new Error('already logged out')
      })
      await expect(h.service.logout()).resolves.toBeUndefined()
      expect(h.deps.rmAuth).toHaveBeenCalled()
    })

    it('after logout, late updates do not schedule reconnects', async () => {
      const h = await buildHarness()
      await h.service.logout()
      h.socket._trigger('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 515 } } }
      })
      // logout already cleared reconnect; no new schedule
      expect(h.reconnectCalls.length).toBe(0)
    })
  })

  describe('connect failure', () => {
    it('schedules reconnect when authStateFactory throws', async () => {
      const reconnectCalls: { cb: () => void; ms: number }[] = []
      const service = createWhatsAppService({
        authPath: '/tmp/x',
        socketFactory: () => makeFakeSocket(),
        authStateFactory: vi.fn(async () => {
          throw new Error('disk error')
        }),
        versionFactory: async () => ({ version: [2, 3000, 0] }),
        browser: ['x', 'y', 'z'],
        makeKeyStore: (k: any) => k,
        rmAuth: async () => {},
        scheduleReconnect: (cb, ms) => {
          reconnectCalls.push({ cb, ms })
          return null
        },
        cancelReconnect: () => {}
      })
      await service.start()
      expect(reconnectCalls.length).toBe(1)
      expect(reconnectCalls[0]!.ms).toBe(1000) // pairing backoff is fixed at initialBackoffMs
    })

    it('transitions to disconnected state on failure', async () => {
      const service = createWhatsAppService({
        authPath: '/tmp/x-fail',
        socketFactory: () => makeFakeSocket(),
        authStateFactory: vi.fn(async () => {
          throw new Error('disk error')
        }),
        versionFactory: async () => ({ version: [2, 3000, 0] }),
        browser: ['x', 'y', 'z'],
        makeKeyStore: (k: any) => k,
        rmAuth: async () => {},
        scheduleReconnect: () => null,
        cancelReconnect: () => {}
      })
      await service.start()
      expect(service.getState()).toBe('disconnected')
    })
  })

  describe('event subscription off()', () => {
    it('off removes a listener', async () => {
      const h = await buildHarness()
      const onState = vi.fn()
      h.service.on('connection-state', onState)
      h.service.off('connection-state', onState)
      h.socket._trigger('connection.update', { connection: 'open' })
      expect(onState).not.toHaveBeenCalled()
    })
  })

  describe('messages.upsert', () => {
    const SELF = '5491134567890:42@s.whatsapp.net'

    function selfChatMsg(id: string, text: string) {
      return {
        key: { id, remoteJid: '5491134567890@s.whatsapp.net', fromMe: true },
        messageTimestamp: 1_700_000_000,
        message: { conversation: text }
      }
    }

    it('emits message with source=realtime for type=notify', async () => {
      const h = await buildHarness({ userId: SELF })
      const onMessage = vi.fn()
      h.service.on('message', onMessage)

      h.socket._trigger('messages.upsert', {
        type: 'notify',
        messages: [selfChatMsg('m1', 'hello')]
      })

      expect(onMessage).toHaveBeenCalledTimes(1)
      expect(onMessage).toHaveBeenCalledWith({
        raw: expect.objectContaining({ key: expect.objectContaining({ id: 'm1' }) }),
        source: 'realtime'
      })
    })

    it('emits source=offline-sync for type=append (catch-up)', async () => {
      const h = await buildHarness({ userId: SELF })
      const onMessage = vi.fn()
      h.service.on('message', onMessage)

      h.socket._trigger('messages.upsert', {
        type: 'append',
        messages: [selfChatMsg('m1', 'caught up')]
      })

      expect(onMessage.mock.calls[0]![0].source).toBe('offline-sync')
    })

    it('emits source=realtime when type missing or unknown', async () => {
      const h = await buildHarness({ userId: SELF })
      const onMessage = vi.fn()
      h.service.on('message', onMessage)
      h.socket._trigger('messages.upsert', {
        messages: [selfChatMsg('m1', 'x')]
      })
      expect(onMessage.mock.calls[0]![0].source).toBe('realtime')
    })

    it('filters out messages from other JIDs', async () => {
      const h = await buildHarness({ userId: SELF })
      const onMessage = vi.fn()
      h.service.on('message', onMessage)
      h.socket._trigger('messages.upsert', {
        type: 'notify',
        messages: [
          {
            key: {
              id: 'group-1',
              remoteJid: '999999@g.us',
              fromMe: false
            },
            messageTimestamp: 1,
            message: { conversation: 'group msg' }
          },
          selfChatMsg('m1', 'self msg')
        ]
      })
      expect(onMessage).toHaveBeenCalledTimes(1)
      expect(onMessage.mock.calls[0]![0].raw.key.id).toBe('m1')
    })

    it('does not emit immediately when own JID variants are missing', async () => {
      const h = await buildHarness({ userId: undefined })
      const onMessage = vi.fn()
      h.service.on('message', onMessage)
      h.socket._trigger('messages.upsert', {
        type: 'notify',
        messages: [selfChatMsg('m1', 'x')]
      })
      expect(onMessage).not.toHaveBeenCalled()
    })

    it('uses creds.me as a fallback when sock.user is not populated yet', async () => {
      const h = await buildHarness({
        userId: undefined,
        authMe: { phoneNumber: SELF }
      })
      const onMessage = vi.fn()
      h.service.on('message', onMessage)

      h.socket._trigger('messages.upsert', {
        type: 'notify',
        messages: [selfChatMsg('m1', 'from creds')]
      })

      expect(onMessage).toHaveBeenCalledTimes(1)
      expect(onMessage.mock.calls[0]![0].raw.key.id).toBe('m1')
    })

    it('queues early upsert messages until own JID variants become available', async () => {
      const h = await buildHarness({ userId: undefined })
      const onMessage = vi.fn()
      h.service.on('message', onMessage)

      h.socket._trigger('messages.upsert', {
        type: 'notify',
        messages: [selfChatMsg('m1', 'early')]
      })
      expect(onMessage).not.toHaveBeenCalled()

      h.socket.user = { id: SELF }
      h.socket._trigger('connection.update', { connection: 'open' })

      expect(onMessage).toHaveBeenCalledTimes(1)
      expect(onMessage.mock.calls[0]![0]).toEqual({
        raw: expect.objectContaining({ key: expect.objectContaining({ id: 'm1' }) }),
        source: 'realtime'
      })
    })

    it('flushes queued upsert messages when creds.update provides me', async () => {
      const h = await buildHarness({ userId: undefined })
      const onMessage = vi.fn()
      h.service.on('message', onMessage)

      h.socket._trigger('messages.upsert', {
        type: 'notify',
        messages: [selfChatMsg('m1', 'early creds')]
      })
      expect(onMessage).not.toHaveBeenCalled()

      h.socket._trigger('creds.update', { me: { phoneNumber: SELF } })
      await new Promise((r) => setTimeout(r, 0))

      expect(onMessage).toHaveBeenCalledTimes(1)
      expect(onMessage.mock.calls[0]![0].source).toBe('realtime')
    })

    it('matches PN remoteJid against sock.user.phoneNumber when id is LID', async () => {
      const h = await buildHarness({
        user: {
          id: 'lid-user@lid',
          phoneNumber: SELF,
          lid: 'lid-user@lid'
        }
      })
      const onMessage = vi.fn()
      h.service.on('message', onMessage)

      h.socket._trigger('messages.upsert', {
        type: 'notify',
        messages: [selfChatMsg('m1', 'pn via phoneNumber')]
      })

      expect(onMessage).toHaveBeenCalledTimes(1)
    })

    it('tolerates missing messages array', async () => {
      const h = await buildHarness({ userId: SELF })
      const onMessage = vi.fn()
      h.service.on('message', onMessage)
      expect(() => h.socket._trigger('messages.upsert', { type: 'notify' })).not.toThrow()
      expect(onMessage).not.toHaveBeenCalled()
    })

    it('emits multiple messages from a single batch', async () => {
      const h = await buildHarness({ userId: SELF })
      const onMessage = vi.fn()
      h.service.on('message', onMessage)
      h.socket._trigger('messages.upsert', {
        type: 'notify',
        messages: [selfChatMsg('a', 'A'), selfChatMsg('b', 'B'), selfChatMsg('c', 'C')]
      })
      expect(onMessage).toHaveBeenCalledTimes(3)
    })
  })

  describe('messaging-history.set', () => {
    const SELF = '5491134567890:42@s.whatsapp.net'

    it('emits source=history-sync for self-chat messages', async () => {
      const h = await buildHarness({ userId: SELF })
      const onMessage = vi.fn()
      h.service.on('message', onMessage)
      h.socket._trigger('messaging-history.set', {
        messages: [
          {
            key: {
              id: 'h1',
              remoteJid: '5491134567890@s.whatsapp.net',
              fromMe: true
            },
            messageTimestamp: 1,
            message: { conversation: 'past' }
          }
        ]
      })
      expect(onMessage).toHaveBeenCalledTimes(1)
      expect(onMessage.mock.calls[0]![0].source).toBe('history-sync')
    })

    it('filters out non-self messages from history', async () => {
      const h = await buildHarness({ userId: SELF })
      const onMessage = vi.fn()
      h.service.on('message', onMessage)
      h.socket._trigger('messaging-history.set', {
        messages: [
          {
            key: { id: 'g1', remoteJid: '999@g.us', fromMe: false },
            messageTimestamp: 1,
            message: { conversation: 'group history' }
          }
        ]
      })
      expect(onMessage).not.toHaveBeenCalled()
    })

    it('does not emit history immediately when own JID variants are missing', async () => {
      const h = await buildHarness({ userId: undefined })
      const onMessage = vi.fn()
      h.service.on('message', onMessage)
      h.socket._trigger('messaging-history.set', {
        messages: [
          {
            key: { id: 'h', remoteJid: '5491134567890@s.whatsapp.net' },
            messageTimestamp: 1,
            message: { conversation: 'x' }
          }
        ]
      })
      expect(onMessage).not.toHaveBeenCalled()
    })

    it('queues early history until own JID variants become available', async () => {
      const h = await buildHarness({ userId: undefined })
      const onMessage = vi.fn()
      h.service.on('message', onMessage)
      h.socket._trigger('messaging-history.set', {
        messages: [
          {
            key: {
              id: 'h1',
              remoteJid: '5491134567890@s.whatsapp.net',
              fromMe: true
            },
            messageTimestamp: 1,
            message: { conversation: 'queued history' }
          }
        ]
      })
      expect(onMessage).not.toHaveBeenCalled()

      h.socket.user = { id: SELF }
      h.socket._trigger('connection.update', { connection: 'open' })

      expect(onMessage).toHaveBeenCalledTimes(1)
      expect(onMessage.mock.calls[0]![0].source).toBe('history-sync')
    })

    it('uses creds.me for history when sock.user is missing', async () => {
      const h = await buildHarness({
        userId: undefined,
        authMe: { phoneNumber: SELF }
      })
      const onMessage = vi.fn()
      h.service.on('message', onMessage)
      h.socket._trigger('messaging-history.set', {
        messages: [
          {
            key: {
              id: 'h1',
              remoteJid: '5491134567890@s.whatsapp.net',
              fromMe: true
            },
            messageTimestamp: 1,
            message: { conversation: 'creds history' }
          }
        ]
      })
      expect(onMessage).toHaveBeenCalledTimes(1)
      expect(onMessage.mock.calls[0]![0].source).toBe('history-sync')
    })

    it('tolerates missing messages array', async () => {
      const h = await buildHarness({ userId: SELF })
      expect(() => h.socket._trigger('messaging-history.set', {})).not.toThrow()
    })
  })

  describe('default factories (no DI)', () => {
    it('default scheduleReconnect/cancelReconnect use real timers', async () => {
      vi.useFakeTimers()
      const sock = makeFakeSocket()
      // Omit scheduleReconnect, cancelReconnect, logger to exercise defaults.
      const service = createWhatsAppService({
        authPath: '/tmp/x-default',
        socketFactory: () => sock,
        authStateFactory: async () => ({
          state: { creds: {}, keys: {} },
          saveCreds: async () => {}
        }),
        versionFactory: async () => ({ version: [2, 3000, 0] }),
        browser: ['x', 'y', 'z'],
        makeKeyStore: (k: any) => k,
        rmAuth: async () => {}
      })
      try {
        await service.start()
        sock._trigger('connection.update', {
          connection: 'close',
          lastDisconnect: { error: { output: { statusCode: 515 } } }
        })
        // A real setTimeout was scheduled for 2000ms. Advance to fire it,
        // but stop first to cancel — exercises the default cancelReconnect.
        await service.stop()
        vi.advanceTimersByTime(5000)
      } finally {
        vi.useRealTimers()
      }
    })

    it('default cancelReconnect handles null/undefined safely', async () => {
      const sock = makeFakeSocket()
      const service = createWhatsAppService({
        authPath: '/tmp/x-default-2',
        socketFactory: () => sock,
        authStateFactory: async () => ({
          state: { creds: {}, keys: {} },
          saveCreds: async () => {}
        }),
        versionFactory: async () => ({ version: [2, 3000, 0] }),
        browser: ['x', 'y', 'z'],
        makeKeyStore: (k: any) => k,
        rmAuth: async () => {}
      })
      await service.start()
      // No reconnect pending — stop must not throw.
      await expect(service.stop()).resolves.toBeUndefined()
    })
  })
})
