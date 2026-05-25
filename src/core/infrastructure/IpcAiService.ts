import type { IAiService } from '../ports/IAiService'
import type { AiConfig, ChatMessage, AiChatResponse } from '@shared/types'

export class IpcAiService implements IAiService {
  async getConfig(): Promise<AiConfig | null> {
    return window.braintwo.ai.getConfig()
  }

  async setConfig(config: Partial<AiConfig>): Promise<void> {
    return window.braintwo.ai.setConfig(config)
  }

  async send(messages: ChatMessage[], goodSourceId?: number): Promise<AiChatResponse> {
    return window.braintwo.ai.send(messages, goodSourceId)
  }
}
