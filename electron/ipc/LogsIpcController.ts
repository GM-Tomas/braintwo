import { ipcMain, shell } from 'electron'
import { logInfo, logError, getLogFilePath } from '../services/logger'

export class LogsIpcController {
  static register(): void {
    ipcMain.handle('logs:info', (_e, module: string, message: string, meta?: Record<string, unknown>) => {
      logInfo(module, message, meta)
    })

    ipcMain.handle('logs:error', (_e, module: string, error: unknown, message?: string, meta?: Record<string, unknown>) => {
      logError(module, error, message, meta)
    })

    ipcMain.handle('logs:open', async () => {
      const path = getLogFilePath()
      const err = await shell.openPath(path)
      if (err) {
        // If it cannot open the file directly (e.g. no default JSON viewer), show it in folder.
        shell.showItemInFolder(path)
      }
    })

    ipcMain.handle('logs:path', () => {
      return getLogFilePath()
    })
  }
}
