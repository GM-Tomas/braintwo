import { ipcMain, dialog } from 'electron'
import type { AppContext } from '../app-context'
import { importExportFile, type ImportProgress } from '../services/export-parser'
import { logError } from '../services/logger'

export class ExportIpcController {
  static register(appContext: AppContext) {
    ipcMain.handle('export:import', async () => {
      if (!appContext.db.value) {
        throw new Error('Storage is not ready')
      }
      const selected = await dialog.showOpenDialog({
        title: 'Importar export de WhatsApp',
        properties: ['openFile'],
        filters: [{ name: 'WhatsApp export', extensions: ['txt'] }]
      })
      if (selected.canceled || selected.filePaths.length === 0) {
        return { processed: 0, total: 0, inserted: 0, skipped: 0, done: true } satisfies ImportProgress
      }
      try {
        const result = await importExportFile(selected.filePaths[0]!, {
          db: appContext.db.value,
          onProgress: (progress) => appContext.broadcast('sync:progress', progress)
        })
        void appContext.search.value?.backfillMissing(50_000).catch((err: unknown) => {
          logError('export:backfill', err, 'Failed to backfill missing after export import')
          const errMsg = err instanceof Error ? err.message : String(err)
          appContext.reportError('search.backfill_failed', errMsg)
        })
        return result
      } catch (err) {
        logError('export:import', err, 'Error importing WhatsApp export file')
        throw err
      }
    })
  }
}
