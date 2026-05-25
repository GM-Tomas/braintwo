import { ipcMain } from 'electron'
import type { AppContext } from '../app-context'
import { readAiConfig, writeAiConfig } from '../services/ai-config'
import type { ChatMessage } from '@shared/types'

export class AiIpcController {
  static register(context: AppContext) {
    ipcMain.handle('ai:get-config', () => {
      return readAiConfig(context.app.getPath('userData'))
    })

    ipcMain.handle('ai:set-config', (_e, patch) => {
      writeAiConfig(context.app.getPath('userData'), patch)
    })

    ipcMain.handle('ai:send', async (_e, messages: ChatMessage[], goodSourceId?: number) => {
      if (!context.aiChat.value) throw new Error('Storage not ready')
      const config = readAiConfig(context.app.getPath('userData'))
      if (!config?.apiKey) throw new Error('IA no configurada. Configurá un proveedor en Settings.')
      const today = new Date().toISOString().split('T')[0]!
      return context.aiChat.value.send(config, messages, today, goodSourceId)
    })
  }
}
