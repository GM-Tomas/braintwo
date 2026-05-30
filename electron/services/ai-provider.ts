import type { AiConfig, ChatMessage } from '@shared/types'

export interface ProviderCallArgs {
  config: AiConfig
  systemPrompt: string
  messages: ChatMessage[]
}

const DEFAULT_MODELS: Record<AiConfig['provider'], string> = {
  anthropic: 'claude-haiku-4-5',
  'openai-compat': 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  deepseek: 'deepseek-v4-pro',
  'opencode-zen': 'big-pickle',
  ollama: 'qwen3:1.7b'
}

export async function callProvider(args: ProviderCallArgs): Promise<string> {
  try {
    switch (args.config.provider) {
      case 'anthropic':     return await callAnthropic(args)
      case 'openai-compat': return await callOpenAiCompat(args)
      case 'gemini':        return await callGemini(args)
      case 'deepseek':      return await callDeepSeek(args)
      case 'opencode-zen':  return await callOpenCodeZen(args)
      case 'ollama':        return await callOllama(args)
      default:
        throw new Error(`Proveedor no soportado: ${args.config.provider}`)
    }
  } catch (err) {
    // Wrap low-level network errors (ECONNRESET, ENOTFOUND, etc.) that manifest
    // as "fetch failed" into a user-readable message. These usually mean the
    // provider's API is temporarily unreachable or a rate limit closed the connection.
    if (err instanceof TypeError && err.message === 'fetch failed') {
      const cause = (err as { cause?: { code?: string } }).cause
      const code = cause?.code ?? 'red de conexión'
      throw new Error(
        `No se pudo conectar con ${args.config.provider} (${code}). ` +
        `Revisá tu conexión o esperá un momento si excediste el límite de solicitudes.`
      )
    }
    throw err
  }
}

// ── Anthropic ────────────────────────────────────────────────────────────────

async function callAnthropic({ config, systemPrompt, messages }: ProviderCallArgs): Promise<string> {
  const model = config.model?.trim() || DEFAULT_MODELS.anthropic
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content }))
    })
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Anthropic ${res.status}: ${text}`)
  }
  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  return data.content.find((b) => b.type === 'text')?.text ?? ''
}

// ── OpenAI-compatible (OpenAI, Groq, Ollama, LM Studio, Together AI) ─────────

async function callOpenAiCompat({ config, systemPrompt, messages }: ProviderCallArgs): Promise<string> {
  const model = config.model?.trim() || DEFAULT_MODELS['openai-compat']
  const baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  // Ollama and some local servers don't require an Authorization header
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content }))
      ]
    })
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${baseUrl} ${res.status}: ${text}`)
  }
  const data = await res.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message.content ?? ''
}

// ── Google Gemini ─────────────────────────────────────────────────────────────

async function callGemini({ config, systemPrompt, messages }: ProviderCallArgs): Promise<string> {
  const model = config.model?.trim() || DEFAULT_MODELS.gemini
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`

  // Gemini requires strictly alternating user/model turns; filter leading assistant turn
  const turns = messages[0]?.role === 'assistant' ? messages.slice(1) : messages

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: turns.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }))
    })
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Gemini ${res.status}: ${text}`)
  }
  const data = await res.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>
  }
  return data.candidates[0]?.content.parts[0]?.text ?? ''
}

// ── DeepSeek ─────────────────────────────────────────────────────────────────

async function callDeepSeek(args: ProviderCallArgs): Promise<string> {
  const model = args.config.model?.trim() || DEFAULT_MODELS.deepseek
  const baseUrl = args.config.baseUrl?.replace(/\/$/, '') || 'https://api.deepseek.com'
  const configCopy = { ...args.config, model, baseUrl }
  return callOpenAiCompat({ ...args, config: configCopy })
}

// ── OpenCode Zen ─────────────────────────────────────────────────────────────

async function callOpenCodeZen(args: ProviderCallArgs): Promise<string> {
  const model = args.config.model?.trim() || DEFAULT_MODELS['opencode-zen']
  const baseUrl = args.config.baseUrl?.replace(/\/$/, '') || 'https://opencode.ai/zen/v1'
  const configCopy = { ...args.config, model, baseUrl }
  return callOpenAiCompat({ ...args, config: configCopy })
}

// ── Ollama (local) ────────────────────────────────────────────────────────────

async function callOllama(args: ProviderCallArgs): Promise<string> {
  const model = args.config.model?.trim() || DEFAULT_MODELS['ollama']
  const serverUrl = (args.config.ollama?.serverUrl ?? 'http://localhost:11434').replace(/\/$/, '')
  const configCopy = { ...args.config, model, baseUrl: `${serverUrl}/v1`, apiKey: '' }
  return callOpenAiCompat({ ...args, config: configCopy })
}
