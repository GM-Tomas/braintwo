import { ipcMain } from 'electron'
import type { AppContext } from '../app-context'

export class SearchIpcController {
  static register(context: AppContext) {
    ipcMain.handle('search:query', async (_e, text: string, k = 12) => {
      return context.search.value?.query(text, k) ?? []
    })
  }
}
