import { ipcMain, dialog } from 'electron'
import type { AppContext } from '../app-context'
import { importExportFile, type ImportProgress } from '../services/export-parser'
import { logError } from '../services/logger'

export class ExportIpcController {
  static register(context: AppContext) {
    ipcMain.handle('export:import', async () => {
      try {
        const selected = await dialog.showOpenDialog({
          title: 'Importar export de WhatsApp',
          properties: ['openFile'],
          filters: [{ name: 'WhatsApp export', extensions: ['txt'] }]
        })
        if (selected.canceled || selected.filePaths.length === 0) {
          return { processed: 0, total: 0, inserted: 0, skipped: 0, done: true } satisfies ImportProgress
        }
        if (!context.db.value) {
          throw new Error('Storage is not ready')
        }
        const result = await importExportFile(selected.filePaths[0]!, {
          db: context.db.value,
          onProgress: (progress) => context.broadcast('sync:progress', progress)
        })
        if (context.search.value) {
          void context.search.value.backfillMissing(50_000).catch((err: unknown) => {
            logError('export:backfill', err, 'Failed to backfill missing after export import')
            context.reportError('search.backfill_failed', err instanceof Error ? err.message : String(err))
          })
        }
        return result
      } catch (err) {
        logError('export:import', err, 'Error importing WhatsApp export file')
        throw err
      }
    })
  }
}
