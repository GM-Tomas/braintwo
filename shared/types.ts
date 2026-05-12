export type View = 'onboarding' | 'search' | 'timeline' | 'settings'

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
}

export interface SearchResult extends RecentMessage {
  distance: number
  similarity: number
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
}

declare global {
  interface Window {
    braintwo: BrainTwoBridge
  }
}
