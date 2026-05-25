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

    ipcMain.handle('ai:send', async (_e, messages: ChatMessage[], goodSourceId?: number, chatId?: number) => {
      if (!context.aiChat.value) throw new Error('Storage not ready')
      const config = readAiConfig(context.app.getPath('userData'))
      if (!config?.apiKey) throw new Error('IA no configurada. Configurá un proveedor en Settings.')
      const today = new Date().toISOString().split('T')[0]!
      return context.aiChat.value.send(config, messages, today, goodSourceId, chatId)
    })

    ipcMain.handle('ai:list-chats', () => {
      if (!context.db.value) throw new Error('Database not ready')
      return context.db.value.listChats()
    })

    ipcMain.handle('ai:get-chat-messages', (_e, chatId: number) => {
      if (!context.db.value) throw new Error('Database not ready')
      return context.db.value.getChatMessages(chatId)
    })

    ipcMain.handle('ai:create-chat', (_e, title: string) => {
      if (!context.db.value) throw new Error('Database not ready')
      return context.db.value.createChat(title)
    })

    ipcMain.handle('ai:delete-chat', (_e, chatId: number) => {
      if (!context.db.value) throw new Error('Database not ready')
      return context.db.value.deleteChat(chatId)
    })

    ipcMain.handle('ai:rename-chat', (_e, chatId: number, title: string) => {
      if (!context.db.value) throw new Error('Database not ready')
      return context.db.value.renameChat(chatId, title)
    })

    ipcMain.handle('ai:save-chat-message', (_e, chatId: number, role: 'user' | 'assistant', content: string, sources: string | null) => {
      if (!context.db.value) throw new Error('Database not ready')
      return context.db.value.insertChatMessage(chatId, role, content, sources)
    })

    ipcMain.handle('ai:delete-last-message', (_e, chatId: number) => {
      if (!context.db.value) throw new Error('Database not ready')
      context.db.value.raw.prepare(
        "DELETE FROM chat_messages WHERE id = (SELECT MAX(id) FROM chat_messages WHERE chat_id = ? AND role = 'assistant')"
      ).run(chatId)
    })
  }
}
