import { ipcMain, shell } from 'electron'
import type { AppContext } from '../app-context'
import { readSettings, writeSettings } from '../services/settings'

export class SettingsIpcController {
  static register(context: AppContext) {
    ipcMain.handle('settings:get', () => {
      return readSettings(context.app)
    })

    ipcMain.handle('settings:set', (_e, patch) => {
      return writeSettings(context.app, patch)
    })

    ipcMain.handle('db:stats', () => {
      return context.db.value?.stats(context.dbPath.value ?? undefined) ?? {
        messages: 0,
        embeddings: 0,
        sizeBytes: 0,
        lastIngestAt: null
      }
    })

    ipcMain.handle('app:open-userdata-folder', async () => {
      await shell.openPath(context.app.getPath('userData'))
    })
  }
}
