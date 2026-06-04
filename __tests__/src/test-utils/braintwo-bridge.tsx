import { vi } from 'vitest'
import type {
  AppErrorEvent,
  BrainTwoBridge,
  ConnectionState,
  ImportProgress,
  ModelProgress,
  RecentMessage,
  SearchResult,
  SyncStatus,
  WAConnectionState
} from '@shared/types'

export interface BridgeHandle {
  bridge: BrainTwoBridge
  emitConnectionState: (state: WAConnectionState) => void
  emitQr: (qr: string) => void
  emitLoggedOut: () => void
  emitMessagesBatch: (batch: RecentMessage[]) => void
  emitSyncStateChanged: (status: SyncStatus) => void
  emitModelProgress: (progress: ModelProgress) => void
  emitImportProgress: (progress: ImportProgress) => void
  emitError: (error: AppErrorEvent) => void
  spies: {
    requestQr: ReturnType<typeof vi.fn>
    logout: ReturnType<typeof vi.fn>
    openWindow: ReturnType<typeof vi.fn>
    quit: ReturnType<typeof vi.fn>
    getVersion: ReturnType<typeof vi.fn>
    getPlatform: ReturnType<typeof vi.fn>
    getConnectionState: ReturnType<typeof vi.fn>
    getCurrentQr: ReturnType<typeof vi.fn>
    getMessageCount: ReturnType<typeof vi.fn>
    getRecentMessages: ReturnType<typeof vi.fn>
    getMessageById: ReturnType<typeof vi.fn>
    getSyncStatus: ReturnType<typeof vi.fn>
    getSettings: ReturnType<typeof vi.fn>
    setSettings: ReturnType<typeof vi.fn>
    getDbStats: ReturnType<typeof vi.fn>
    openUserDataFolder: ReturnType<typeof vi.fn>
    searchQuery: ReturnType<typeof vi.fn>
    importTxt: ReturnType<typeof vi.fn>
  }
}

export interface BridgeOpts {
  initialState?: WAConnectionState
  initialQr?: string | null
  version?: string
  platform?: NodeJS.Platform
  initialMessageCount?: number
  initialRecent?: RecentMessage[]
  searchResults?: SearchResult[]
}

export function installBraintwoBridge(opts: BridgeOpts = {}): BridgeHandle {
  const stateListeners: ((s: WAConnectionState) => void)[] = []
  const qrListeners: ((qr: string) => void)[] = []
  const loggedOutListeners: (() => void)[] = []
  const batchListeners: ((batch: RecentMessage[]) => void)[] = []
  const syncListeners: ((status: SyncStatus) => void)[] = []
  const modelProgressListeners: ((progress: ModelProgress) => void)[] = []
  const importProgressListeners: ((progress: ImportProgress) => void)[] = []
  const errorListeners: ((error: AppErrorEvent) => void)[] = []

  const spies = {
    requestQr: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    openWindow: vi.fn(async () => {}),
    quit: vi.fn(async () => {}),
    getVersion: vi.fn(async () => opts.version ?? '0.1.0'),
    getPlatform: vi.fn(async () => opts.platform ?? 'win32'),
    getConnectionState: vi.fn(async () => opts.initialState ?? 'connecting'),
    getCurrentQr: vi.fn(async () => opts.initialQr ?? null),
    getMessageCount: vi.fn(async () => opts.initialMessageCount ?? 0),
    getRecentMessages: vi.fn(async () => opts.initialRecent ?? []),
    getMessageById: vi.fn(async () => null),
    getSyncStatus: vi.fn(async () => ({
      state: (opts.initialState === 'open' ? 'idle' : opts.initialState ?? 'connecting') as ConnectionState,
      label: opts.initialState === 'open' ? 'Al dia' : 'Conectando',
      lastPrimaryActivityAt: null,
      stalePrimaryDays: 0,
      newMessages: 0
    })),
    getSettings: vi.fn(async () => ({
      autostart: true,
      userDataPath: 'C:\\Users\\admin\\AppData\\Roaming\\BrainTwo'
    })),
    setSettings: vi.fn(async (patch) => ({
      autostart: patch.autostart ?? true,
      userDataPath: 'C:\\Users\\admin\\AppData\\Roaming\\BrainTwo'
    })),
    getDbStats: vi.fn(async () => ({
      messages: opts.initialMessageCount ?? 0,
      embeddings: 0,
      sizeBytes: 0,
      lastIngestAt: null
    })),
    openUserDataFolder: vi.fn(async () => {}),
    setTitleBarOverlay: vi.fn(async () => {}),
    searchQuery: vi.fn(async () => opts.searchResults ?? []),
    importTxt: vi.fn(async () => ({
      processed: 0,
      total: 0,
      inserted: 0,
      skipped: 0,
      done: true
    })),
    aiGetConfig: vi.fn(async () => null),
    aiSetConfig: vi.fn(async () => {}),
    aiSend: vi.fn(async () => ({ content: 'respuesta mock', sources: [], action: undefined }))
  }

  const bridge: BrainTwoBridge = {
    platform: opts.platform ?? 'win32',
    versions: { electron: '33.0.0', node: '20.0.0', chrome: '130.0.0' },
    app: {
      openWindow: spies.openWindow,
      quit: spies.quit,
      getVersion: spies.getVersion,
      getPlatform: spies.getPlatform,
      getMessageCount: spies.getMessageCount as unknown as () => Promise<number>,
      getRecentMessages: spies.getRecentMessages as unknown as (
        limit: number
      ) => Promise<RecentMessage[]>,
      getMessageById: spies.getMessageById as unknown as (
        id: number
      ) => Promise<RecentMessage | null>,
      getSyncStatus: spies.getSyncStatus,
      getSettings: spies.getSettings,
      setSettings: spies.setSettings,
      getDbStats: spies.getDbStats,
      openUserDataFolder: spies.openUserDataFolder,
      setTitleBarOverlay: spies.setTitleBarOverlay,
      onMessagesBatch: (cb) => {
        batchListeners.push(cb)
        return () => {
          const i = batchListeners.indexOf(cb)
          if (i >= 0) batchListeners.splice(i, 1)
        }
      },
      onSyncStateChanged: (cb) => {
        syncListeners.push(cb)
        return () => {
          const i = syncListeners.indexOf(cb)
          if (i >= 0) syncListeners.splice(i, 1)
        }
      },
      onError: (cb) => {
        errorListeners.push(cb)
        return () => {
          const i = errorListeners.indexOf(cb)
          if (i >= 0) errorListeners.splice(i, 1)
        }
      }
    },
    search: {
      query: spies.searchQuery,
      onModelProgress: (cb) => {
        modelProgressListeners.push(cb)
        return () => {
          const i = modelProgressListeners.indexOf(cb)
          if (i >= 0) modelProgressListeners.splice(i, 1)
        }
      }
    },
    export: {
      importTxt: spies.importTxt,
      onProgress: (cb) => {
        importProgressListeners.push(cb)
        return () => {
          const i = importProgressListeners.indexOf(cb)
          if (i >= 0) importProgressListeners.splice(i, 1)
        }
      }
    },
    wa: {
      getConnectionState: spies.getConnectionState as unknown as () => Promise<WAConnectionState>,
      getCurrentQr: spies.getCurrentQr as unknown as () => Promise<string | null>,
      requestQr: spies.requestQr,
      logout: spies.logout,
      onConnectionState: (cb) => {
        stateListeners.push(cb)
        return () => {
          const i = stateListeners.indexOf(cb)
          if (i >= 0) stateListeners.splice(i, 1)
        }
      },
      onQr: (cb) => {
        qrListeners.push(cb)
        return () => {
          const i = qrListeners.indexOf(cb)
          if (i >= 0) qrListeners.splice(i, 1)
        }
      },
      onLoggedOut: (cb) => {
        loggedOutListeners.push(cb)
        return () => {
          const i = loggedOutListeners.indexOf(cb)
          if (i >= 0) loggedOutListeners.splice(i, 1)
        }
      }
    },
    ai: {
      getConfig: spies.aiGetConfig,
      setConfig: spies.aiSetConfig,
      send: spies.aiSend,
      listChats: vi.fn(async () => []),
      getChatMessages: vi.fn(async () => []),
      createChat: vi.fn(async () => 1),
      deleteChat: vi.fn(async () => {}),
      renameChat: vi.fn(async () => {}),
      saveChatMessage: vi.fn(async () => 1),
      deleteLastMessage: vi.fn(async () => {})
    }
  }

  ;(window as unknown as { braintwo: BrainTwoBridge }).braintwo = bridge

  return {
    bridge,
    emitConnectionState: (state) => stateListeners.forEach((l) => l(state)),
    emitQr: (qr) => qrListeners.forEach((l) => l(qr)),
    emitLoggedOut: () => loggedOutListeners.forEach((l) => l()),
    emitMessagesBatch: (batch) => batchListeners.forEach((l) => l(batch)),
    emitSyncStateChanged: (status) => syncListeners.forEach((l) => l(status)),
    emitModelProgress: (progress) => modelProgressListeners.forEach((l) => l(progress)),
    emitImportProgress: (progress) => importProgressListeners.forEach((l) => l(progress)),
    emitError: (error) => errorListeners.forEach((l) => l(error)),
    spies
  }
}
