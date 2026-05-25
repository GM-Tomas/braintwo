import type { AiConfig, ChatMessage, AiChatResponse, DbChat, DbChatMessage } from '@shared/types'

export interface IAiService {
  getConfig(): Promise<AiConfig | null>
  setConfig(config: Partial<AiConfig>): Promise<void>
  send(messages: ChatMessage[], goodSourceId?: number, chatId?: number): Promise<AiChatResponse>
  listChats(): Promise<DbChat[]>
  getChatMessages(chatId: number): Promise<DbChatMessage[]>
  createChat(title: string): Promise<number>
  deleteChat(chatId: number): Promise<void>
  renameChat(chatId: number, title: string): Promise<void>
  saveChatMessage(chatId: number, role: 'user' | 'assistant', content: string, sources: string | null): Promise<number>
  deleteLastMessage(chatId: number): Promise<void>
}
