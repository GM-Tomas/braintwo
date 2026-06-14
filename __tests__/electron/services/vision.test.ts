import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { AiConfig } from '@shared/types'

vi.mock('../../../electron/services/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn()
}))

const callProvider = vi.fn()
vi.mock('../../../electron/services/ai-provider', async () => {
  const actual = await vi.importActual<typeof import('../../../electron/services/ai-provider')>(
    '../../../electron/services/ai-provider'
  )
  return { ...actual, callProvider }
})

const { describeImage } = await import('../../../electron/services/vision')

function baseConfig(overrides: Partial<AiConfig> = {}): AiConfig {
  return {
    provider: 'openai-compat',
    apiKey: 'key',
    ...overrides
  }
}

describe('vision service', () => {
  beforeEach(() => {
    callProvider.mockReset()
  })

  it('resolves the configured visionModel and sends the image as base64', async () => {
    callProvider.mockResolvedValue('Una foto de un perro en el parque.')
    const config = baseConfig({ visionModel: 'gpt-4o-vision' })
    const buffer = Buffer.from('fake-image-bytes')

    const result = await describeImage(config, buffer, 'image/jpeg', 'Mirá esto')

    expect(result).toBe('Una foto de un perro en el parque.')
    expect(callProvider).toHaveBeenCalledTimes(1)
    const call = callProvider.mock.calls[0][0]
    expect(call.config.model).toBe('gpt-4o-vision')
    expect(call.messages[0].images).toEqual([
      { mimetype: 'image/jpeg', data: buffer.toString('base64') }
    ])
    expect(call.messages[0].content).toContain('Mirá esto')
  })

  it('falls back to DEFAULT_VISION_MODELS when visionModel is not set', async () => {
    callProvider.mockResolvedValue('Descripción')
    const config = baseConfig()

    await describeImage(config, Buffer.from('x'), 'image/png', '')

    const call = callProvider.mock.calls[0][0]
    expect(call.config.model).toBe('gpt-4o-mini')
    expect(call.messages[0].content).toContain('Sin pie de foto')
  })

  it('uses ollama.visionModel for the ollama provider', async () => {
    callProvider.mockResolvedValue('Descripción')
    const config = baseConfig({
      provider: 'ollama',
      ollama: { enabled: true, mode: 'ollama', serverUrl: 'http://localhost:11434', activeModel: 'qwen3:1.7b', visionModel: 'qwen3.5:4b', autoStart: true }
    })

    await describeImage(config, Buffer.from('x'), 'image/png', '')

    const call = callProvider.mock.calls[0][0]
    expect(call.config.model).toBe('qwen3.5:4b')
  })

  it('returns null and does not throw when callProvider fails', async () => {
    callProvider.mockRejectedValue(new Error('network down'))
    const config = baseConfig()

    const result = await describeImage(config, Buffer.from('x'), 'image/jpeg', '')

    expect(result).toBeNull()
  })

  it('returns null when the provider returns an empty description', async () => {
    callProvider.mockResolvedValue('   ')
    const config = baseConfig()

    const result = await describeImage(config, Buffer.from('x'), 'image/jpeg', '')

    expect(result).toBeNull()
  })
})
