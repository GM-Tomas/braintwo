export type AiProvider = 'anthropic' | 'openai-compat' | 'gemini'

export interface AiConfig {
  provider: AiProvider
  apiKey: string
  /** For openai-compat: base URL of the endpoint (e.g. http://localhost:11434/v1) */
  baseUrl?: string
  /** Model string. Empty = per-provider default. */
  model?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface RetrievedContext {
  id: number
  text: string
  timestamp: number
  similarity?: number
}

export interface AiChatResponse {
  content: string
  sources: RetrievedContext[]
  action?: { action: 'navigate'; view: string }
}
