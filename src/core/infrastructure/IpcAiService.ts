import type { IAiService } from '../ports/IAiService'
import type { AiConfig, ChatMessage, AiChatResponse, DbChat, DbChatMessage } from '@shared/types'

export class IpcAiService implements IAiService {
  async getConfig(): Promise<AiConfig | null> {
    return window.braintwo.ai.getConfig()
  }

  async setConfig(config: Partial<AiConfig>): Promise<void> {
    return window.braintwo.ai.setConfig(config)
  }

  async send(messages: ChatMessage[], goodSourceId?: number, chatId?: number): Promise<AiChatResponse> {
    return window.braintwo.ai.send(messages, goodSourceId, chatId)
  }

  async listChats(): Promise<DbChat[]> {
    return window.braintwo.ai.listChats()
  }

  async getChatMessages(chatId: number): Promise<DbChatMessage[]> {
    return window.braintwo.ai.getChatMessages(chatId)
  }

  async createChat(title: string): Promise<number> {
    return window.braintwo.ai.createChat(title)
  }

  async deleteChat(chatId: number): Promise<void> {
    return window.braintwo.ai.deleteChat(chatId)
  }

  async renameChat(chatId: number, title: string): Promise<void> {
    return window.braintwo.ai.renameChat(chatId, title)
  }

  async saveChatMessage(chatId: number, role: 'user' | 'assistant', content: string, sources: string | null): Promise<number> {
    return window.braintwo.ai.saveChatMessage(chatId, role, content, sources)
  }

  async deleteLastMessage(chatId: number): Promise<void> {
    return window.braintwo.ai.deleteLastMessage(chatId)
  }
}
