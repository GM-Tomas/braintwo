import type { AiConfig, ChatMessage, AiChatResponse } from '@shared/types'

export interface IAiService {
  getConfig(): Promise<AiConfig | null>
  setConfig(config: Partial<AiConfig>): Promise<void>
  send(messages: ChatMessage[]): Promise<AiChatResponse>
}
