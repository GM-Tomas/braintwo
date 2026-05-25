import { ipcMain } from 'electron'
import type { AppContext } from '../app-context'
import { SqliteMessageRepository } from '../repositories/SqliteMessageRepository'

export class AppIpcController {
  static register(context: AppContext) {
    // Lazy instance: we wrap it in a getter or instantiate inside handlers where context.ingest.value is guaranteed
    const getMessageRepo = () => {
      if (!context.ingest.value) throw new Error('Ingest pipeline not ready')
      return new SqliteMessageRepository(context.ingest.value)
    }

    ipcMain.handle('app:open-window', () => {
      context.showWindow()
    })

    ipcMain.handle('app:quit', () => {
      context.isQuitting.value = true
      context.app.quit()
    })

    ipcMain.handle('app:get-version', () => {
      return context.app.getVersion()
    })

    ipcMain.handle('app:get-platform', () => {
      return process.platform
    })

    ipcMain.handle('app:get-message-count', () => {
      if (!context.ingest.value) return 0
      return getMessageRepo().getMessageCount()
    })

    ipcMain.handle('app:get-recent-messages', (_e, limit: number) => {
      if (!context.ingest.value) return []
      return getMessageRepo().getRecentMessages(Math.max(0, Math.min(limit, 500)) || 50)
    })

    ipcMain.handle('app:get-message-by-id', (_e, id: number) => {
      if (!context.ingest.value) return null
      return getMessageRepo().getMessageById(id)
    })

    ipcMain.handle('app:get-sync-status', () => {
      return context.syncStatus.get()
    })
  }
}
