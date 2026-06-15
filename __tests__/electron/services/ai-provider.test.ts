import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { AiConfig, ChatMessage } from '@shared/types'

vi.mock('../../../electron/services/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn()
}))

const { callProvider } = await import('../../../electron/services/ai-provider')

function baseConfig(overrides: Partial<AiConfig> = {}): AiConfig {
  return {
    provider: 'openai-compat',
    apiKey: 'key',
    baseUrl: 'https://example.com/v1',
    ...overrides
  }
}

const image = { mimetype: 'image/png', data: 'YmFzZTY0' }

describe('ai-provider image content', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('callOpenAiCompat sends image_url content blocks when images are present', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'desc' } }] })
    })

    const messages: ChatMessage[] = [{ role: 'user', content: 'describí esto', images: [image] }]
    const result = await callProvider({ config: baseConfig(), systemPrompt: 'sys', messages })

    expect(result).toBe('desc')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const userMsg = body.messages[1]
    expect(Array.isArray(userMsg.content)).toBe(true)
    expect(userMsg.content[0]).toEqual({ type: 'text', text: 'describí esto' })
    expect(userMsg.content[1]).toEqual({
      type: 'image_url',
      image_url: { url: `data:${image.mimetype};base64,${image.data}` }
    })
  })

  it('callOpenAiCompat keeps plain string content when there are no images', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'desc' } }] })
    })

    const messages: ChatMessage[] = [{ role: 'user', content: 'hola' }]
    await callProvider({ config: baseConfig(), systemPrompt: 'sys', messages })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages[1].content).toBe('hola')
  })

  it('callAnthropic sends image content blocks when images are present', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'desc' }] })
    })

    const messages: ChatMessage[] = [{ role: 'user', content: 'describí esto', images: [image] }]
    const result = await callProvider({
      config: baseConfig({ provider: 'anthropic' }),
      systemPrompt: 'sys',
      messages
    })

    expect(result).toBe('desc')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const userMsg = body.messages[0]
    expect(Array.isArray(userMsg.content)).toBe(true)
    expect(userMsg.content[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: image.mimetype, data: image.data }
    })
    expect(userMsg.content[1]).toEqual({ type: 'text', text: 'describí esto' })
  })

  it('callGemini sends inline_data parts when images are present', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'desc' }] } }] })
    })

    const messages: ChatMessage[] = [{ role: 'user', content: 'describí esto', images: [image] }]
    const result = await callProvider({
      config: baseConfig({ provider: 'gemini', apiKey: 'key' }),
      systemPrompt: 'sys',
      messages
    })

    expect(result).toBe('desc')
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    const parts = body.contents[0].parts
    expect(parts[0]).toEqual({ inline_data: { mime_type: image.mimetype, data: image.data } })
    expect(parts[1]).toEqual({ text: 'describí esto' })
  })
})
