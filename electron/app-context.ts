import type { App, Tray, BrowserWindow } from 'electron'
import type { WhatsAppService } from './services/whatsapp'
import type { DbInstance } from './services/db'
import type { IngestPipeline } from './services/ingest'
import type { SearchService } from './services/search'
import type { AiChatService } from './services/ai-chat'
import type { ContextService } from './services/context'
import type { SyncStatusTracker } from './services/sync-status'
import type { MessageBatcher } from './main-helpers'
import type { RecentMessage } from './services/ingest'
import type { WAConnectionState } from './services/whatsapp-state'

export interface AppContext {
  app: App
  mainWindow: { value: BrowserWindow | null }
  tray: { value: Tray | null }
  whatsapp: { value: WhatsAppService | null }
  db: { value: DbInstance | null }
  ingest: { value: IngestPipeline | null }
  search: { value: SearchService | null }
  aiChat: { value: AiChatService | null }
  contextSvc: { value: ContextService | null }
  syncStatus: SyncStatusTracker
  messageBatcher: { value: MessageBatcher<RecentMessage> | null }
  dbPath: { value: string | null }
  isQuitting: { value: boolean }
  lastConnectionState: { value: WAConnectionState }
  lastQr: { value: string | null }
  showWindow: () => void
  broadcast: (channel: string, payload: unknown) => void
  reportError: (code: string, message: string, recoverable?: boolean) => void
}
