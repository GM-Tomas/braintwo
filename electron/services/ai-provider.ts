import type { AiConfig, ChatMessage } from '@shared/types'

export interface ProviderCallArgs {
  config: AiConfig
  systemPrompt: string
  messages: ChatMessage[]
}

const DEFAULT_MODELS: Record<AiConfig['provider'], string> = {
  anthropic: 'claude-haiku-4-5',
  'openai-compat': 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash'
}

export async function callProvider(args: ProviderCallArgs): Promise<string> {
  switch (args.config.provider) {
    case 'anthropic':     return callAnthropic(args)
    case 'openai-compat': return callOpenAiCompat(args)
    case 'gemini':        return callGemini(args)
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
