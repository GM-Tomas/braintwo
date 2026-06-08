export type AiProvider = 'anthropic' | 'openai-compat' | 'gemini' | 'deepseek' | 'opencode-zen' | 'ollama'

export interface ProviderSpecificConfig {
  apiKey: string
  baseUrl?: string
  model?: string
}

export interface AiConfigProfile {
  id: string
  name: string
  provider: AiProvider
  apiKey: string
  baseUrl?: string
  model?: string
  providers?: {
    [key in AiProvider]?: ProviderSpecificConfig
  }
}

export interface OllamaConfig {
  enabled: boolean
  mode: 'ollama' | 'manual'
  serverUrl: string
  activeModel: string
  autoStart: boolean
}

export type OllamaStatus =
  | 'not-installed'
  | 'installing'
  | 'not-running'
  | 'starting'
  | 'running'
  | 'error'

export interface OllamaModel {
  name: string
  size: number
  modifiedAt: string
}

export interface OllamaPullProgress {
  model: string
  status: string
  completed?: number
  total?: number
  done: boolean
}

export interface OllamaInstallProgress {
  stage: 'downloading' | 'installing' | 'done' | 'error'
  percent?: number
  message?: string
}


export interface AiConfig {
  provider: AiProvider
  apiKey: string
  /** For openai-compat: base URL of the endpoint (e.g. http://localhost:11434/v1) */
  baseUrl?: string
  /** Model string. Empty = per-provider default. */
  model?: string
  /** Per-provider settings saved so switching providers doesn't wipe credentials */
  providers?: {
    [key in AiProvider]?: ProviderSpecificConfig
  }
  activeProfileId?: string
  profiles?: AiConfigProfile[]
  ollama?: Partial<OllamaConfig>
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: RetrievedContext[]
  created_at?: number
}

export interface DbChat {
  id: number
  title: string
  created_at: number
}

export interface DbChatMessage {
  id: number
  chat_id: number
  role: 'user' | 'assistant'
  content: string
  sources: string | null
  created_at: number
}

export interface RetrievedContext {
  id: number
  text: string
  timestamp: number
  similarity?: number
  index?: number
}

export interface AiChatResponse {
  content: string
  sources: RetrievedContext[]
  action?: { action: 'navigate'; view: string }
}
