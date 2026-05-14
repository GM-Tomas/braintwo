export type View = 'onboarding' | 'search' | 'timeline' | 'settings' | 'chat'

export type ConnectionState =
  | 'connecting'
  | 'open'
  | 'catching-up'
  | 'idle'
  | 'disconnected'
  | 'logged-out'
  | 'stale-primary'

export type WAConnectionState =
  | 'connecting'
  | 'open'
  | 'disconnected'
  | 'logged-out'

export type Unsubscribe = () => void

export type MessageSource = 'export' | 'history-sync' | 'realtime' | 'offline-sync'

export type MessageKind =
  | 'text'
  | 'audio'
  | 'image'
  | 'video'
  | 'document'
  | 'sticker'
  | 'other'

export interface MediaMeta {
  durationSec?: number
  fileName?: string
  fileLengthBytes?: number
  mimetype?: string
  /** Pre-existing transcript / OCR if WhatsApp/Baileys provided one. */
  transcript?: string
  /** True if the audio came as a voice note (push-to-talk) vs a regular file. */
  ptt?: boolean
}

export interface RecentMessage {
  id: number
  wa_msg_id: string
  timestamp: number
  text: string
  source: MessageSource
  kind: MessageKind
  media?: MediaMeta | null
  fromMe?: boolean
  createdAt?: number
  contextNote?: string | null
}

export interface SearchResult extends RecentMessage {
  distance: number
  similarity: number
  matchSource?: 'semantic' | 'keyword' | 'both'
}

export interface ModelProgress {
  status: 'idle' | 'downloading' | 'ready' | 'fallback' | 'error'
  message?: string
  progress?: number
}

export interface ImportProgress {
  processed: number
  total: number
  inserted: number
  skipped: number
  done: boolean
}

export interface DbStats {
  messages: number
  embeddings: number
  sizeBytes: number
  lastIngestAt: number | null
}

export interface SyncStatus {
  state: ConnectionState
  label: string
  lastPrimaryActivityAt: number | null
  stalePrimaryDays: number
  newMessages: number
}

export interface UserSettings {
  autostart: boolean
  userDataPath: string
}

export interface AppErrorEvent {
  code: string
  message: string
  recoverable: boolean
}

// ── AI Chat ────────────────────────────────────────────────────────────────

export type AiProvider = 'anthropic' | 'openai-compat' | 'gemini'

export interface AiConfig {
  provider: AiProvider
  apiKey: string
  /** For openai-compat: base URL of the endpoint (e.g. http://localhost:11434/v1) */
  baseUrl?: string
  /** Model string. Empty = per-provider default. */
  model?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface RetrievedContext {
  id: number
  text: string
  timestamp: number
  similarity?: number
}

export interface AiChatResponse {
  content: string
  sources: RetrievedContext[]
  action?: { action: 'navigate'; view: string }
}

// ── Bridge ─────────────────────────────────────────────────────────────────

export interface BrainTwoBridge {
  platform: NodeJS.Platform
  versions: {
    electron: string
    node: string
    chrome: string
  }
  app: {
    openWindow: () => Promise<void>
    quit: () => Promise<void>
    getVersion: () => Promise<string>
    getPlatform: () => Promise<NodeJS.Platform>
    getMessageCount: () => Promise<number>
    getRecentMessages: (limit: number) => Promise<RecentMessage[]>
    getSyncStatus: () => Promise<SyncStatus>
    getSettings: () => Promise<UserSettings>
    setSettings: (settings: Partial<UserSettings>) => Promise<UserSettings>
    getDbStats: () => Promise<DbStats>
    openUserDataFolder: () => Promise<void>
    onMessagesBatch: (cb: (batch: RecentMessage[]) => void) => Unsubscribe
    onSyncStateChanged: (cb: (status: SyncStatus) => void) => Unsubscribe
    onError: (cb: (error: AppErrorEvent) => void) => Unsubscribe
  }
  search: {
    query: (text: string, k?: number) => Promise<SearchResult[]>
    onModelProgress: (cb: (progress: ModelProgress) => void) => Unsubscribe
  }
  export: {
    importTxt: () => Promise<ImportProgress>
    onProgress: (cb: (progress: ImportProgress) => void) => Unsubscribe
  }
  wa: {
    getConnectionState: () => Promise<WAConnectionState>
    getCurrentQr: () => Promise<string | null>
    requestQr: () => Promise<void>
    logout: () => Promise<void>
    onConnectionState: (cb: (state: WAConnectionState) => void) => Unsubscribe
    onQr: (cb: (qr: string) => void) => Unsubscribe
    onLoggedOut: (cb: () => void) => Unsubscribe
  }
  ai: {
    getConfig: () => Promise<AiConfig | null>
    setConfig: (config: Partial<AiConfig>) => Promise<void>
    send: (messages: ChatMessage[]) => Promise<AiChatResponse>
  }
}

declare global {
  interface Window {
    braintwo: BrainTwoBridge
  }
}
