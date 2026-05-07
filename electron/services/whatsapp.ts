import { EventEmitter } from 'node:events'
import { rm } from 'node:fs/promises'
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys'
import pino, { type Logger } from 'pino'
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

interface MinimalSocket {
  ev: MinimalEv
  end?: (err?: Error) => void
  logout?: () => Promise<void> | void
  user?: { id?: string }
}

interface MinimalAuthState {
  state: { creds: unknown; keys: unknown }
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
  on(event: 'qr', listener: (qr: string) => void): this
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
    await this.connect()
  }

  async stop(): Promise<void> {
    this.stopped = true
    this.clearReconnect()
    if (this.socket?.end) {
      try {
        this.socket.end(undefined)
      } catch {
        /* socket may already be closed */
      }
    }
    this.socket = null
  }

  async logout(): Promise<void> {
    this.stopped = true
    this.clearReconnect()
    if (this.socket?.logout) {
      try {
        await this.socket.logout()
      } catch {
        /* if server already kicked us, the call may fail */
      }
    }
    this.socket = null
    await this.rmAuth(this.authPath)
    this.transitionTo('logged-out')
    this.currentQr = null
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

      const auth = await this.authStateFactory(this.authPath)
      const { version } = await this.versionFactory()

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

      this.socket.ev.on('creds.update', (...args: unknown[]) => {
        void Promise.resolve(auth.saveCreds(...(args as []))).catch((err: unknown) => {
          this.logger.warn({ err }, 'saveCreds failed')
        })
      })

      this.socket.ev.on('connection.update', (...args: unknown[]) => {
        const update = (args[0] ?? {}) as Parameters<typeof deriveTransition>[0]
        this.handleConnectionUpdate(update)
      })

      this.socket.ev.on('messages.upsert', (...args: unknown[]) => {
        const evt = (args[0] ?? {}) as {
          type?: string
          messages?: WAMessageLike[]
        }
        this.handleMessagesUpsert(evt)
      })

      this.socket.ev.on('messaging-history.set', (...args: unknown[]) => {
        const evt = (args[0] ?? {}) as { messages?: WAMessageLike[] }
        this.handleHistorySet(evt)
      })
    } catch (err) {
      this.logger.error({ err }, 'whatsapp connect failed')
      this.scheduleReconnectIfNeeded()
    } finally {
      this.connecting = false
    }
  }

  private handleConnectionUpdate(
    update: Parameters<typeof deriveTransition>[0]
  ): void {
    const t = deriveTransition(update)

    if (t.qr) {
      this.currentQr = t.qr
      this.emit('qr', t.qr)
    }

    this.transitionTo(t.state)

    if (t.state === 'open') {
      this.currentBackoffMs = 0
      this.currentQr = null
    }

    if (t.isLoggedOut) {
      this.handleServerLoggedOut()
    } else if (t.shouldReconnect) {
      this.scheduleReconnectIfNeeded()
    }
  }

  private handleMessagesUpsert(evt: {
    type?: string
    messages?: WAMessageLike[]
  }): void {
    const myJid = this.socket?.user?.id
    if (!myJid || !evt.messages) return
    // type === 'append' is offline catch-up; 'notify' (and others) are realtime.
    const source: MessageSource =
      evt.type === 'append' ? 'offline-sync' : 'realtime'
    for (const msg of evt.messages) {
      if (!isSelfChat(msg.key?.remoteJid, myJid)) continue
      this.emit('message', { raw: msg, source })
    }
  }

  private handleHistorySet(evt: { messages?: WAMessageLike[] }): void {
    const myJid = this.socket?.user?.id
    if (!myJid || !evt.messages) return
    for (const msg of evt.messages) {
      if (!isSelfChat(msg.key?.remoteJid, myJid)) continue
      this.emit('message', { raw: msg, source: 'history-sync' })
    }
  }

  private handleServerLoggedOut(): void {
    this.clearReconnect()
    this.socket = null
    void this.rmAuth(this.authPath).catch((err: unknown) => {
      this.logger.warn({ err }, 'rmAuth after server logout failed')
    })
    this.emit('logged-out')
  }

  private scheduleReconnectIfNeeded(): void {
    if (this.stopped) return
    this.clearReconnect()
    this.currentBackoffMs = nextBackoff(
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
