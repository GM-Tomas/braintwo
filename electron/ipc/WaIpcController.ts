import { ipcMain } from 'electron'
import type { AppContext } from '../app-context'

export class WaIpcController {
  static register(context: AppContext) {
    ipcMain.handle('wa:get-connection-state', () => {
      return context.lastConnectionState.value
    })

    ipcMain.handle('wa:get-current-qr', () => {
      return context.lastQr.value
    })

    ipcMain.handle('wa:request-qr', async () => {
      if (!context.whatsapp.value) return
      await context.whatsapp.value.stop()
      await context.whatsapp.value.start()
    })

    ipcMain.handle('wa:logout', async () => {
      await context.whatsapp.value?.logout()
    })
  }
}
