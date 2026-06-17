import type { IpcRenderer, IpcRendererEvent } from 'electron'
import type { WAConnectionState } from './services/whatsapp-state'
import type { RecentMessage } from './services/ingest'
import type {
  AiConfig,
  AiChatResponse,
  AppErrorEvent,
  ChatMessage,
  DashboardReportResult,
  DbChat,
  DbChatMessage,
  DbStats,
  ImportProgress,
  ModelProgress,
  OllamaInstallProgress,
  OllamaModel,
  OllamaPullProgress,
  OllamaStatus,
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
    readImage: (msgId: number) => Promise<string | null>
    reprocessImage: (msgId: number) => Promise<boolean>
    getSyncStatus: () => Promise<SyncStatus>
    setTitleBarOverlay: (opts: { color: string; symbolColor: string }) => Promise<void>
    getSettings: () => Promise<UserSettings>
    setSettings: (settings: Partial<UserSettings>) => Promise<UserSettings>
    getDbStats: () => Promise<DbStats>
    generateDashboardReport: () => Promise<DashboardReportResult>
    openUserDataFolder: () => Promise<void>
    onMessagesBatch: (cb: (batch: RecentMessage[]) => void) => Unsubscribe
    onSyncStateChanged: (cb: (status: SyncStatus) => void) => Unsubscribe
    onError: (cb: (error: AppErrorEvent) => void) => Unsubscribe
    onTranscribing: (cb: (payload: { msgId: number }) => void) => Unsubscribe
    onTranscribed: (cb: (payload: { msgId: number; transcript: string }) => void) => Unsubscribe
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
  ignore: {
    toggle: (msgId: number) => Promise<boolean>
    getIds: () => Promise<number[]>
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
  logs: {
    info: (module: string, message: string, meta?: Record<string, unknown>) => Promise<void>
    error: (module: string, error: unknown, message?: string, meta?: Record<string, unknown>) => Promise<void>
    openFile: () => Promise<void>
    getFilePath: () => Promise<string>
  }
  ollama: {
    getStatus: (serverUrl?: string) => Promise<OllamaStatus>
    install: () => Promise<void>
    uninstall: () => Promise<void>
    startServer: () => Promise<void>
    stopServer: () => Promise<void>
    listModels: (serverUrl?: string) => Promise<OllamaModel[]>
    pullModel: (name: string) => Promise<void>
    cancelPull: () => Promise<void>
    deleteModel: (name: string) => Promise<void>
    onPullProgress: (cb: (p: OllamaPullProgress) => void) => Unsubscribe
    onInstallProgress: (cb: (p: OllamaInstallProgress) => void) => Unsubscribe
    onStatusChange: (cb: (status: OllamaStatus) => void) => Unsubscribe
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
      readImage: (msgId: number) => ipcRenderer.invoke('media:read-image', msgId),
      reprocessImage: (msgId: number) => ipcRenderer.invoke('media:reprocess-image', msgId),
      getSyncStatus: () => ipcRenderer.invoke('app:get-sync-status'),
      setTitleBarOverlay: (opts: { color: string; symbolColor: string }) =>
        ipcRenderer.invoke('app:set-title-bar-overlay', opts),
      getSettings: () => ipcRenderer.invoke('settings:get'),
      setSettings: (settings: Partial<UserSettings>) =>
        ipcRenderer.invoke('settings:set', settings),
      getDbStats: () => ipcRenderer.invoke('db:stats'),
      generateDashboardReport: () => ipcRenderer.invoke('app:generate-dashboard-report'),
      openUserDataFolder: () => ipcRenderer.invoke('app:open-userdata-folder'),
      onMessagesBatch: subscribe<RecentMessage[]>('app:messages-batch'),
      onSyncStateChanged: subscribe<SyncStatus>('sync:state-changed'),
      onError: subscribe<AppErrorEvent>('app:error'),
      onTranscribing: subscribe<{ msgId: number }>('audio:transcribing'),
      onTranscribed: subscribe<{ msgId: number; transcript: string }>('audio:transcribed')
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
    ignore: {
      toggle: (msgId: number) => ipcRenderer.invoke('ignore:toggle', msgId),
      getIds: () => ipcRenderer.invoke('ignore:get-ids')
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
    },
    logs: {
      info: (module: string, message: string, meta?: Record<string, unknown>) =>
        ipcRenderer.invoke('logs:info', module, message, meta),
      error: (module: string, error: unknown, message?: string, meta?: Record<string, unknown>) =>
        ipcRenderer.invoke('logs:error', module, error, message, meta),
      openFile: () => ipcRenderer.invoke('logs:open'),
      getFilePath: () => ipcRenderer.invoke('logs:path')
    },
    ollama: {
      getStatus: (serverUrl?: string) => ipcRenderer.invoke('ollama:get-status', serverUrl),
      install: () => ipcRenderer.invoke('ollama:install'),
      uninstall: () => ipcRenderer.invoke('ollama:uninstall'),
      startServer: () => ipcRenderer.invoke('ollama:start-server'),
      stopServer: () => ipcRenderer.invoke('ollama:stop-server'),
      listModels: (serverUrl?: string) => ipcRenderer.invoke('ollama:list-models', serverUrl),
      pullModel: (name: string) => ipcRenderer.invoke('ollama:pull-model', name),
      cancelPull: () => ipcRenderer.invoke('ollama:cancel-pull'),
      deleteModel: (name: string) => ipcRenderer.invoke('ollama:delete-model', name),
      onPullProgress: subscribe<OllamaPullProgress>('ollama:on-pull-progress'),
      onInstallProgress: subscribe<OllamaInstallProgress>('ollama:on-install-progress'),
      onStatusChange: subscribe<OllamaStatus>('ollama:on-status')
    }
  }
}
