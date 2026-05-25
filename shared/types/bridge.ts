import type { RecentMessage } from './messages'
import type { SearchResult, ModelProgress } from './search'
import type { AiConfig, ChatMessage, AiChatResponse, DbChat, DbChatMessage } from './ai'
import type { WAConnectionState, SyncStatus, AppErrorEvent } from './sync'

export type View = 'onboarding' | 'search' | 'timeline' | 'settings' | 'chat'

export type Unsubscribe = () => void

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

export interface UserSettings {
  autostart: boolean
  userDataPath: string
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
    getMessageById: (id: number) => Promise<RecentMessage | null>
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
    send: (messages: ChatMessage[], goodSourceId?: number) => Promise<AiChatResponse>
    listChats: () => Promise<DbChat[]>
    getChatMessages: (chatId: number) => Promise<DbChatMessage[]>
    createChat: (title: string) => Promise<number>
    deleteChat: (chatId: number) => Promise<void>
    renameChat: (chatId: number, title: string) => Promise<void>
    saveChatMessage: (chatId: number, role: 'user' | 'assistant', content: string, sources: string | null) => Promise<number>
    deleteLastMessage: (chatId: number) => Promise<void>
  }
}

declare global {
  interface Window {
    braintwo: BrainTwoBridge
  }
}
