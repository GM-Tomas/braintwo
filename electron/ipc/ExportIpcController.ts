import { ipcMain, dialog } from 'electron'
import type { AppContext } from '../app-context'
import { importExportFile, type ImportProgress } from '../services/export-parser'

export class ExportIpcController {
  static register(context: AppContext) {
    ipcMain.handle('export:import', async () => {
      if (!context.db.value) {
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
      const result = await importExportFile(selected.filePaths[0]!, {
        db: context.db.value,
        onProgress: (progress) => context.broadcast('sync:progress', progress)
      })
      void context.search.value?.backfillMissing(50_000).catch((err: unknown) => {
        context.reportError('search.backfill_failed', err instanceof Error ? err.message : String(err))
      })
      return result
    })
  }
}
