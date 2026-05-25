import type { IpcRenderer, IpcRendererEvent } from 'electron'
import type { WAConnectionState } from './services/whatsapp-state'
import type { RecentMessage } from './services/ingest'
import type {
  AiConfig,
  AiChatResponse,
  AppErrorEvent,
  ChatMessage,
  DbChat,
  DbChatMessage,
  DbStats,
  ImportProgress,
  ModelProgress,
  SearchResult,
  SyncStatus,
  UserSettings
} from '@shared/types'

export type Unsubscribe = () => void

export interface BrainTwoApi {
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
    send: (messages: ChatMessage[], goodSourceId?: number, chatId?: number) => Promise<AiChatResponse>
    listChats: () => Promise<DbChat[]>
    getChatMessages: (chatId: number) => Promise<DbChatMessage[]>
    createChat: (title: string) => Promise<number>
    deleteChat: (chatId: number) => Promise<void>
    renameChat: (chatId: number, title: string) => Promise<void>
    saveChatMessage: (chatId: number, role: 'user' | 'assistant', content: string, sources: string | null) => Promise<number>
    deleteLastMessage: (chatId: number) => Promise<void>
  }
}

export interface PreloadEnv {
  platform: NodeJS.Platform
  versions: {
    electron?: string
    node?: string
    chrome?: string
  }
}

export function createApi(
  ipcRenderer: Pick<IpcRenderer, 'invoke' | 'on' | 'off'>,
  env: PreloadEnv = {
    platform: process.platform,
    versions: {
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome
    }
  }
): BrainTwoApi {
  function subscribe<T>(
    channel: string
  ): (listener: (payload: T) => void) => Unsubscribe {
    return (listener) => {
      const wrapped = (_e: IpcRendererEvent, payload: T): void => listener(payload)
      ipcRenderer.on(channel, wrapped as (event: IpcRendererEvent, ...args: unknown[]) => void)
      return () => {
        ipcRenderer.off(channel, wrapped as (event: IpcRendererEvent, ...args: unknown[]) => void)
      }
    }
  }

  return {
    platform: env.platform,
    versions: {
      electron: env.versions.electron ?? '',
      node: env.versions.node ?? '',
      chrome: env.versions.chrome ?? ''
    },
    app: {
      openWindow: () => ipcRenderer.invoke('app:open-window'),
      quit: () => ipcRenderer.invoke('app:quit'),
      getVersion: () => ipcRenderer.invoke('app:get-version'),
      getPlatform: () => ipcRenderer.invoke('app:get-platform'),
      getMessageCount: () => ipcRenderer.invoke('app:get-message-count'),
      getRecentMessages: (limit: number) =>
        ipcRenderer.invoke('app:get-recent-messages', limit),
      getMessageById: (id: number) => ipcRenderer.invoke('app:get-message-by-id', id),
      getSyncStatus: () => ipcRenderer.invoke('app:get-sync-status'),
      getSettings: () => ipcRenderer.invoke('settings:get'),
      setSettings: (settings: Partial<UserSettings>) =>
        ipcRenderer.invoke('settings:set', settings),
      getDbStats: () => ipcRenderer.invoke('db:stats'),
      openUserDataFolder: () => ipcRenderer.invoke('app:open-userdata-folder'),
      onMessagesBatch: subscribe<RecentMessage[]>('app:messages-batch'),
      onSyncStateChanged: subscribe<SyncStatus>('sync:state-changed'),
      onError: subscribe<AppErrorEvent>('app:error')
    },
    search: {
      query: (text: string, k = 12) => ipcRenderer.invoke('search:query', text, k),
      onModelProgress: subscribe<ModelProgress>('search:model-progress')
    },
    export: {
      importTxt: () => ipcRenderer.invoke('export:import'),
      onProgress: subscribe<ImportProgress>('sync:progress')
    },
    wa: {
      getConnectionState: () => ipcRenderer.invoke('wa:get-connection-state'),
      getCurrentQr: () => ipcRenderer.invoke('wa:get-current-qr'),
      requestQr: () => ipcRenderer.invoke('wa:request-qr'),
      logout: () => ipcRenderer.invoke('wa:logout'),
      onConnectionState: subscribe<WAConnectionState>('wa:connection-state'),
      onQr: subscribe<string>('wa:qr'),
      onLoggedOut: subscribe<void>('wa:logged-out')
    },
    ai: {
      getConfig: () => ipcRenderer.invoke('ai:get-config'),
      setConfig: (config: Partial<AiConfig>) => ipcRenderer.invoke('ai:set-config', config),
      send: (messages: ChatMessage[], goodSourceId?: number, chatId?: number) => ipcRenderer.invoke('ai:send', messages, goodSourceId, chatId),
      listChats: () => ipcRenderer.invoke('ai:list-chats'),
      getChatMessages: (chatId: number) => ipcRenderer.invoke('ai:get-chat-messages', chatId),
      createChat: (title: string) => ipcRenderer.invoke('ai:create-chat', title),
      deleteChat: (chatId: number) => ipcRenderer.invoke('ai:delete-chat', chatId),
      renameChat: (chatId: number, title: string) => ipcRenderer.invoke('ai:rename-chat', chatId, title),
      saveChatMessage: (chatId: number, role: 'user' | 'assistant', content: string, sources: string | null) => ipcRenderer.invoke('ai:save-chat-message', chatId, role, content, sources),
      deleteLastMessage: (chatId: number) => ipcRenderer.invoke('ai:delete-last-message', chatId)
    }
  }
}
