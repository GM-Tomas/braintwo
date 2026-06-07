import { EventEmitter } from 'node:events'
import { rm } from 'node:fs/promises'
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys'
import pino, { type Logger } from 'pino'
import { logError } from './logger'
import {
  deriveTransition,
  isSelfChat,
  nextBackoff,
  type WAConnectionState
} from './whatsapp-state'
import type { MessageSource } from './db'
import type { WAMessageLike } from './ingest'

interface MinimalEv {
  on: (event: string, handler: (...args: unknown[]) => void) => void
}

interface MinimalWaUser {
  id?: string
  phoneNumber?: string
  lid?: string
  name?: string
  notify?: string
}

interface MinimalSocket {
  ev: MinimalEv
  end?: (err?: Error) => void
  logout?: () => Promise<void> | void
  user?: {
    /** Preferred id — could be the LID (`@lid`) or PN (`@s.whatsapp.net`) form. */
    id?: string
    /** ID in PN format (`@s.whatsapp.net`). */
    phoneNumber?: string
    /** ID in LID format (`@lid`). */
    lid?: string
    name?: string
    notify?: string
  }
}

interface MinimalAuthState {
  state: { creds: { me?: MinimalWaUser } & Record<string, unknown>; keys: unknown }
  saveCreds: () => Promise<void> | void
}

export interface WhatsAppDeps {
  authPath: string
  logger?: Logger
  socketFactory?: (opts: unknown) => MinimalSocket
  authStateFactory?: (path: string) => Promise<MinimalAuthState>
  versionFactory?: () => Promise<{ version: unknown; isLatest?: boolean }>
  browser?: unknown
  makeKeyStore?: (keys: unknown, logger: unknown) => unknown
  rmAuth?: (path: string) => Promise<void>
  initialBackoffMs?: number
  maxBackoffMs?: number
  scheduleReconnect?: (cb: () => void, ms: number) => unknown
  cancelReconnect?: (handle: unknown) => void
}

export interface IngestableMessage {
  raw: WAMessageLike
  source: MessageSource
}

export interface WhatsAppService {
  start(): Promise<void>
  stop(): Promise<void>
  logout(): Promise<void>
  getState(): WAConnectionState
  getCurrentQr(): string | null
  on(event: 'qr', listener: (qr: string | null) => void): this
  on(event: 'connection-state', listener: (state: WAConnectionState) => void): this
  on(event: 'logged-out', listener: () => void): this
  on(event: 'message', listener: (msg: IngestableMessage) => void): this
  off(event: string, listener: (...args: unknown[]) => void): this
}

const defaultLogger = (): Logger =>
  pino({ level: 'silent' }) as unknown as Logger

class WhatsAppServiceImpl extends EventEmitter implements WhatsAppService {
  private state: WAConnectionState = 'disconnected'
  private currentQr: string | null = null
  private currentBackoffMs = 0
  private reconnectHandle: unknown = null
  private socket: MinimalSocket | null = null
  private authCreds: MinimalAuthState['state']['creds'] | null = null
  private pendingMessages: IngestableMessage[] = []
  private stopped = false
  private connecting = false

  private readonly authPath: string
  private readonly logger: Logger
  private readonly socketFactory: (opts: unknown) => MinimalSocket
  private readonly authStateFactory: (path: string) => Promise<MinimalAuthState>
  private readonly versionFactory: () => Promise<{ version: unknown; isLatest?: boolean }>
  private readonly browser: unknown
  private readonly makeKeyStore: (keys: unknown, logger: unknown) => unknown
  private readonly rmAuth: (path: string) => Promise<void>
  private readonly initialBackoffMs: number
  private readonly maxBackoffMs: number
  private readonly scheduleReconnect: (cb: () => void, ms: number) => unknown
  private readonly cancelReconnect: (handle: unknown) => void

  constructor(deps: WhatsAppDeps) {
    super()
    this.authPath = deps.authPath
    this.logger = deps.logger ?? defaultLogger()
    this.socketFactory =
      deps.socketFactory ?? ((opts) => makeWASocket(opts as never) as unknown as MinimalSocket)
    this.authStateFactory =
      deps.authStateFactory ?? ((path) => useMultiFileAuthState(path) as unknown as Promise<MinimalAuthState>)
    this.versionFactory =
      deps.versionFactory ?? (() => fetchLatestBaileysVersion())
    this.browser = deps.browser ?? Browsers.macOS('Desktop')
    this.makeKeyStore =
      deps.makeKeyStore ??
      ((keys, logger) => makeCacheableSignalKeyStore(keys as never, logger as never))
    this.rmAuth =
      deps.rmAuth ?? ((path) => rm(path, { recursive: true, force: true }))
    this.initialBackoffMs = deps.initialBackoffMs ?? 1000
    this.maxBackoffMs = deps.maxBackoffMs ?? 30_000
    this.scheduleReconnect =
      deps.scheduleReconnect ?? ((cb, ms) => setTimeout(cb, ms))
    this.cancelReconnect =
      deps.cancelReconnect ??
      ((handle) => {
        if (handle !== null && handle !== undefined) {
          clearTimeout(handle as ReturnType<typeof setTimeout>)
        }
      })
  }

  getState(): WAConnectionState {
    return this.state
  }

  getCurrentQr(): string | null {
    return this.currentQr
  }

  async start(): Promise<void> {
    this.stopped = false
    this.currentBackoffMs = 0
    await this.connect()
  }

  async stop(): Promise<void> {
    this.stopped = true
    this.clearReconnect()
    if (this.socket?.end) {
      try {
        this.socket.end(undefined)
      } catch (err) {
        logError('whatsapp:stop', err, 'Failed ending socket (socket may already be closed)')
      }
    }
    this.socket = null
    this.currentQr = null
    this.emit('qr', null)

    // Clear unauthenticated auth files to prevent stale pairing states
    if (!this.authCreds?.me) {
      try {
        await this.rmAuth(this.authPath)
      } catch (err) {
        logError('whatsapp:stop', err, 'Failed to clear unauthenticated auth path during stop')
      }
      this.authCreds = null
    }
  }

  async logout(): Promise<void> {
    this.stopped = true
    this.currentBackoffMs = 0
    this.clearReconnect()
    if (this.socket?.logout) {
      try {
        await this.socket.logout()
      } catch (err) {
        logError('whatsapp:logout', err, 'Failed socket.logout (if server already kicked us, this may fail)')
      }
    }
    this.socket = null
    this.authCreds = null
    this.pendingMessages = []
    await this.rmAuth(this.authPath)
    this.transitionTo('logged-out')
    this.currentQr = null
    this.emit('qr', null)
    this.emit('logged-out')
  }

  private clearReconnect(): void {
    if (this.reconnectHandle !== null && this.reconnectHandle !== undefined) {
      this.cancelReconnect(this.reconnectHandle)
      this.reconnectHandle = null
    }
  }

  private transitionTo(state: WAConnectionState): void {
    if (this.state === state) return
    this.state = state
    this.emit('connection-state', state)
  }

  private async connect(): Promise<void> {
    if (this.connecting || this.stopped) return
    this.connecting = true
    try {
      this.transitionTo('connecting')
      this.currentQr = null
      this.emit('qr', null)

      const auth = await this.authStateFactory(this.authPath)
      this.authCreds = auth.state.creds
      // fetchLatestBaileysVersion does an HTTP GET to a remote repo; if it
      // fails (offline, blocked, slow DNS) we don't want to block pairing.
      // Fall back to a known-good version so the socket still initializes.
      let version: unknown = [2, 3000, 1035194821]
      try {
        const fetched = await this.versionFactory()
        if (fetched?.version) version = fetched.version
      } catch (err) {
        logError('whatsapp:connect', err, 'fetchLatestBaileysVersion failed, using fallback')
      }

      this.socket = this.socketFactory({
        version,
        auth: {
          creds: auth.state.creds,
          keys: this.makeKeyStore(auth.state.keys, this.logger)
        },
        browser: this.browser,
        syncFullHistory: true,
        markOnlineOnConnect: false,
        keepAliveIntervalMs: 25_000,
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 60_000,
        retryRequestDelayMs: 1_000,
        maxMsgRetryCount: 5,
        getMessage: async () => undefined,
        logger: this.logger
      })

      // Capture the socket reference so that events arriving from a stale
      // socket (after stop/logout replaced or nulled this.socket) are ignored.
      const capturedSocket = this.socket

      this.socket.ev.on('creds.update', (...args: unknown[]) => {
        if (this.socket !== capturedSocket) return
        const update = args[0] as { me?: MinimalWaUser } | undefined
        if (update?.me) {
          this.authCreds = { ...(this.authCreds ?? {}), me: update.me }
        }
        void Promise.resolve(auth.saveCreds(...(args as []))).catch((err: unknown) => {
          logError('whatsapp:saveCreds', err, 'saveCreds failed')
        }).finally(() => {
          this.flushPendingMessages('creds.update')
        })
      })

      this.socket.ev.on('connection.update', (...args: unknown[]) => {
        if (this.socket !== capturedSocket) return
        const update = (args[0] ?? {}) as Parameters<typeof deriveTransition>[0]
        this.handleConnectionUpdate(update)
      })

      this.socket.ev.on('messages.upsert', (...args: unknown[]) => {
        if (this.socket !== capturedSocket) return
        const evt = (args[0] ?? {}) as {
          type?: string
          messages?: WAMessageLike[]
        }
        this.handleMessagesUpsert(evt)
      })

      this.socket.ev.on('messaging-history.set', (...args: unknown[]) => {
        if (this.socket !== capturedSocket) return
        const evt = (args[0] ?? {}) as { messages?: WAMessageLike[] }
        this.handleHistorySet(evt)
      })
    } catch (err) {
      this.logger.error({ err }, 'whatsapp connect failed')
      this.transitionTo('disconnected')
      this.scheduleReconnectIfNeeded()
    } finally {
      this.connecting = false
    }
  }

  private handleConnectionUpdate(
     update: Parameters<typeof deriveTransition>[0]
   ): void {
     if (this.stopped) return
     const t = deriveTransition(update, this.state)

    if (t.qr) {
      this.currentQr = t.qr
      this.currentBackoffMs = 0
      this.emit('qr', t.qr)
    } else if (t.state === 'disconnected' || t.state === 'logged-out' || t.state === 'open') {
      this.currentQr = null
      this.emit('qr', null)
    }

    if (t.isLoggedOut) {
      // Delay state transition and 'logged-out' event until auth files are
      // fully removed. This prevents a new connect() (triggered by the user
      // clicking "Generar QR de nuevo") from racing against a partial rmAuth
      // and loading stale revoked credentials — which causes WA to reject the QR.
      void this.handleServerLoggedOut()
      return
    }

    this.transitionTo(t.state)

    if (t.state === 'open') {
      this.currentBackoffMs = 0
      this.currentQr = null
      this.flushPendingMessages('connection.open')
    }

    if (t.shouldReconnect) {
      this.scheduleReconnectIfNeeded()
    }
  }

  private myJidVariants(): string[] {
    const seen = new Set<string>()
    const addUser = (u: MinimalWaUser | null | undefined) => {
      if (!u) return
      for (const jid of [u.id, u.phoneNumber, u.lid]) {
        if (typeof jid === 'string' && jid.length > 0) seen.add(jid)
      }
    }
    addUser(this.socket?.user)
    addUser(this.authCreds?.me)
    return Array.from(seen)
  }

  private handleMessagesUpsert(evt: {
    type?: string
    messages?: WAMessageLike[]
  }): void {
    if (!evt.messages) return
    // type === 'append' is offline catch-up; 'notify' (and others) are realtime.
    const source: MessageSource =
      evt.type === 'append' ? 'offline-sync' : 'realtime'
    this.processMessageBatch('messages.upsert', evt.messages, source, evt.type)
  }

  private handleHistorySet(evt: { messages?: WAMessageLike[] }): void {
    if (!evt.messages) return
    this.processMessageBatch('messaging-history.set', evt.messages, 'history-sync')
  }

  private processMessageBatch(
    event: string,
    messages: WAMessageLike[],
    source: MessageSource,
    type?: string
  ): void {
    const variants = this.myJidVariants()
    if (variants.length === 0) {
      this.queuePendingMessages(messages, source, event, type)
      return
    }
    if (this.pendingMessages.length > 0) {
      this.flushPendingMessages(`${event}.variants-known`)
    }

    let kept = 0
    let skipped = 0
    const sampleRemoteJids = new Set<string>()
    for (const msg of messages) {
      const remoteJid = msg.key?.remoteJid
      if (remoteJid) sampleRemoteJids.add(remoteJid)
      if (!isSelfChat(remoteJid, variants)) {
        skipped++
        continue
      }
      kept++
      this.emit('message', { raw: msg, source })
    }
    this.logger.info(
      {
        event,
        type,
        total: messages.length,
        kept,
        skipped,
        sample_remote_jids: Array.from(sampleRemoteJids).slice(0, 5),
        my_jid_variants: variants
      },
      `${event} processed`
    )
  }

  private queuePendingMessages(
    messages: WAMessageLike[],
    source: MessageSource,
    event: string,
    type?: string
  ): void {
    for (const raw of messages) this.pendingMessages.push({ raw, source })
    const sampleRemoteJids = new Set<string>()
    for (const msg of messages) {
      const remoteJid = msg.key?.remoteJid
      if (remoteJid) sampleRemoteJids.add(remoteJid)
    }
    this.logger.warn(
      {
        event,
        type,
        queued: messages.length,
        pending_total: this.pendingMessages.length,
        sample_remote_jids: Array.from(sampleRemoteJids).slice(0, 5)
      },
      `${event} queued until own JID variants are known`
    )
  }

  private flushPendingMessages(reason: string): void {
    if (this.pendingMessages.length === 0) return
    const variants = this.myJidVariants()
    if (variants.length === 0) return

    const pending = this.pendingMessages
    this.pendingMessages = []
    let kept = 0
    let skipped = 0
    const sampleRemoteJids = new Set<string>()
    for (const { raw, source } of pending) {
      const msg = raw
      const remoteJid = msg.key?.remoteJid
      if (remoteJid) sampleRemoteJids.add(remoteJid)
      if (!isSelfChat(remoteJid, variants)) {
        skipped++
        continue
      }
      kept++
      this.emit('message', { raw, source })
    }
    this.logger.info(
      {
        event: 'pending.flush',
        reason,
        total: pending.length,
        kept,
        skipped,
        sample_remote_jids: Array.from(sampleRemoteJids).slice(0, 5),
        my_jid_variants: variants
      },
      'queued WhatsApp messages processed'
    )
  }

  private async handleServerLoggedOut(): Promise<void> {
    this.stopped = true
    this.currentBackoffMs = 0
    this.clearReconnect()
    this.socket = null
    this.authCreds = null
    this.pendingMessages = []
    this.currentQr = null
    try {
      await this.rmAuth(this.authPath)
    } catch (err: unknown) {
      logError('whatsapp:handleServerLoggedOut', err, 'rmAuth after server logout failed')
    }
    this.transitionTo('logged-out')
    this.emit('qr', null)
    this.emit('logged-out')
  }

  private scheduleReconnectIfNeeded(): void {
    if (this.stopped) return
    this.clearReconnect()
    const isPairing = !this.authCreds?.me
    this.currentBackoffMs = isPairing
      ? this.initialBackoffMs
      : nextBackoff(
          this.currentBackoffMs,
          this.initialBackoffMs,
          this.maxBackoffMs
        )
    this.reconnectHandle = this.scheduleReconnect(() => {
      this.reconnectHandle = null
      void this.connect()
    }, this.currentBackoffMs)
  }
}

export function createWhatsAppService(deps: WhatsAppDeps): WhatsAppService {
  return new WhatsAppServiceImpl(deps)
}
