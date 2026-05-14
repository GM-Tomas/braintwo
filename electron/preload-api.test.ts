import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApi, type PreloadEnv } from './preload-api'

interface FakeIpc {
  invoke: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  _emit: (channel: string, payload: unknown) => void
}

function makeFakeIpc(): FakeIpc {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>()
  const ipc = {
    invoke: vi.fn(async () => undefined),
    on: vi.fn((channel: string, h: (...args: unknown[]) => void) => {
      const list = handlers.get(channel) ?? []
      list.push(h)
      handlers.set(channel, list)
    }),
    off: vi.fn((channel: string, h: (...args: unknown[]) => void) => {
      const list = handlers.get(channel) ?? []
      handlers.set(
        channel,
        list.filter((f) => f !== h)
      )
    }),
    _emit: (channel: string, payload: unknown) => {
      for (const h of handlers.get(channel) ?? []) h({} as never, payload)
    }
  }
  return ipc as unknown as FakeIpc
}

const env: PreloadEnv = {
  platform: 'win32',
  versions: { electron: '33.0.0', node: '20.0.0', chrome: '130.0.0' }
}

describe('preload-api createApi', () => {
  let ipc: FakeIpc

  beforeEach(() => {
    ipc = makeFakeIpc()
  })

  describe('shape', () => {
    it('exposes platform, versions, app, wa', () => {
      const api = createApi(ipc, env)
      expect(api.platform).toBe('win32')
      expect(api.versions).toEqual({
        electron: '33.0.0',
        node: '20.0.0',
        chrome: '130.0.0'
      })
      expect(api.app).toBeDefined()
      expect(api.wa).toBeDefined()
    })

    it('falls back to empty strings when version fields missing', () => {
      const api = createApi(ipc, { platform: 'linux', versions: {} })
      expect(api.versions.electron).toBe('')
      expect(api.versions.node).toBe('')
      expect(api.versions.chrome).toBe('')
    })

    it('uses process defaults when env not provided', () => {
      const api = createApi(ipc)
      expect(api.platform).toBe(process.platform)
    })
  })

  describe('app.* invokes correct channels', () => {
    it.each([
      ['openWindow', 'app:open-window'],
      ['quit', 'app:quit'],
      ['getVersion', 'app:get-version'],
      ['getPlatform', 'app:get-platform'],
      ['getMessageCount', 'app:get-message-count'],
      ['getSyncStatus', 'app:get-sync-status'],
      ['getSettings', 'settings:get'],
      ['getDbStats', 'db:stats'],
      ['openUserDataFolder', 'app:open-userdata-folder']
    ] as const)('%s → invoke(%s)', async (method, channel) => {
      const api = createApi(ipc, env)
      await api.app[method]()
      expect(ipc.invoke).toHaveBeenCalledWith(channel)
    })

    it('getRecentMessages forwards the limit argument', async () => {
      const api = createApi(ipc, env)
      await api.app.getRecentMessages(25)
      expect(ipc.invoke).toHaveBeenCalledWith('app:get-recent-messages', 25)
    })

    it('setSettings forwards the settings patch', async () => {
      const api = createApi(ipc, env)
      await api.app.setSettings({ autostart: false })
      expect(ipc.invoke).toHaveBeenCalledWith('settings:set', { autostart: false })
    })
  })

  describe('search/export invokes correct channels', () => {
    it('search.query forwards text and k', async () => {
      const api = createApi(ipc, env)
      await api.search.query('hola', 7)
      expect(ipc.invoke).toHaveBeenCalledWith('search:query', 'hola', 7)
    })

    it('export.importTxt invokes export:import', async () => {
      const api = createApi(ipc, env)
      await api.export.importTxt()
      expect(ipc.invoke).toHaveBeenCalledWith('export:import')
    })
  })

  describe('wa.* invokes correct channels', () => {
    it.each([
      ['getConnectionState', 'wa:get-connection-state'],
      ['getCurrentQr', 'wa:get-current-qr'],
      ['requestQr', 'wa:request-qr'],
      ['logout', 'wa:logout']
    ] as const)('%s → invoke(%s)', async (method, channel) => {
      const api = createApi(ipc, env)
      await api.wa[method]()
      expect(ipc.invoke).toHaveBeenCalledWith(channel)
    })
  })

  describe('subscriptions', () => {
    it('onConnectionState wires to wa:connection-state and unwraps payload', () => {
      const api = createApi(ipc, env)
      const cb = vi.fn()
      const off = api.wa.onConnectionState(cb)
      expect(ipc.on).toHaveBeenCalledWith('wa:connection-state', expect.any(Function))
      ipc._emit('wa:connection-state', 'open')
      expect(cb).toHaveBeenCalledWith('open')
      off()
      expect(ipc.off).toHaveBeenCalled()
    })

    it('onQr emits the qr string', () => {
      const api = createApi(ipc, env)
      const cb = vi.fn()
      api.wa.onQr(cb)
      ipc._emit('wa:qr', 'QR-PAYLOAD')
      expect(cb).toHaveBeenCalledWith('QR-PAYLOAD')
    })

    it('onLoggedOut emits with no payload', () => {
      const api = createApi(ipc, env)
      const cb = vi.fn()
      api.wa.onLoggedOut(cb)
      ipc._emit('wa:logged-out', undefined)
      expect(cb).toHaveBeenCalledTimes(1)
    })

    it('unsubscribe stops further deliveries', () => {
      const api = createApi(ipc, env)
      const cb = vi.fn()
      const off = api.wa.onConnectionState(cb)
      ipc._emit('wa:connection-state', 'open')
      off()
      ipc._emit('wa:connection-state', 'disconnected')
      expect(cb).toHaveBeenCalledTimes(1)
      expect(cb).toHaveBeenCalledWith('open')
    })

    it('multiple subscribers receive events independently', () => {
      const api = createApi(ipc, env)
      const a = vi.fn()
      const b = vi.fn()
      api.wa.onConnectionState(a)
      api.wa.onConnectionState(b)
      ipc._emit('wa:connection-state', 'connecting')
      expect(a).toHaveBeenCalledWith('connecting')
      expect(b).toHaveBeenCalledWith('connecting')
    })

    it('unsubscribing one keeps others alive', () => {
      const api = createApi(ipc, env)
      const a = vi.fn()
      const b = vi.fn()
      const offA = api.wa.onConnectionState(a)
      api.wa.onConnectionState(b)
      offA()
      ipc._emit('wa:connection-state', 'open')
      expect(a).not.toHaveBeenCalled()
      expect(b).toHaveBeenCalledWith('open')
    })

    it('onMessagesBatch wires to app:messages-batch', () => {
      const api = createApi(ipc, env)
      const cb = vi.fn()
      const off = api.app.onMessagesBatch(cb)
      const batch = [
        {
          id: 1,
          wa_msg_id: 'a',
          timestamp: 1,
          text: 'hi',
          source: 'realtime' as const
        }
      ]
      ipc._emit('app:messages-batch', batch)
      expect(cb).toHaveBeenCalledWith(batch)
      off()
      ipc._emit('app:messages-batch', batch)
      expect(cb).toHaveBeenCalledTimes(1)
    })

    it('onSyncStateChanged wires to sync:state-changed', () => {
      const api = createApi(ipc, env)
      const cb = vi.fn()
      api.app.onSyncStateChanged(cb)
      const status = {
        state: 'idle',
        label: 'Al dia',
        lastPrimaryActivityAt: null,
        stalePrimaryDays: 0,
        newMessages: 0
      }
      ipc._emit('sync:state-changed', status)
      expect(cb).toHaveBeenCalledWith(status)
    })

    it('onError wires to app:error', () => {
      const api = createApi(ipc, env)
      const cb = vi.fn()
      api.app.onError(cb)
      const error = { code: 'x', message: 'Boom', recoverable: true }
      ipc._emit('app:error', error)
      expect(cb).toHaveBeenCalledWith(error)
    })

    it('onModelProgress and import progress wire to their channels', () => {
      const api = createApi(ipc, env)
      const model = vi.fn()
      const progress = vi.fn()
      api.search.onModelProgress(model)
      api.export.onProgress(progress)
      ipc._emit('search:model-progress', { status: 'ready' })
      ipc._emit('sync:progress', {
        processed: 1,
        total: 1,
        inserted: 1,
        skipped: 0,
        done: true
      })
      expect(model).toHaveBeenCalledWith({ status: 'ready' })
      expect(progress).toHaveBeenCalledWith(
        expect.objectContaining({ processed: 1, done: true })
      )
    })
  })
})
