import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

vi.mock('electron', () => ({
  app: { getPath: () => process.env.APPDATA || tmpdir() }
}))

vi.mock('../../../electron/services/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn()
}))

const { readAiConfig, writeAiConfig } = await import('../../../electron/services/ai-config')

describe('ai-config service', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bt-aicfg-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  describe('readAiConfig (defaults)', () => {
    it('seeds a default config file on first read', () => {
      const cfg = readAiConfig(dir)
      expect(cfg).not.toBeNull()
      expect(existsSync(join(dir, 'ai-config.json'))).toBe(true)
    })

    it('default config includes the opencode-zen provider', () => {
      const cfg = readAiConfig(dir)!
      expect(cfg.provider).toBe('opencode-zen')
      expect(cfg.model).toBe('big-pickle')
      expect(cfg.providers?.['opencode-zen']).toBeDefined()
    })

    it('default config exposes a groq section sourced from GROQ_API_KEY env', () => {
      process.env.GROQ_API_KEY = 'secret-test-key'
      const cfg = readAiConfig(dir)!
      expect(cfg.groq).toBeDefined()
      expect(cfg.groq?.apiKey).toBe('secret-test-key')
      delete process.env.GROQ_API_KEY
    })

    it('default config includes a default profile', () => {
      const cfg = readAiConfig(dir)!
      expect(cfg.activeProfileId).toBe('profile-default')
      expect(cfg.profiles?.length).toBe(1)
      expect(cfg.profiles?.[0]?.name).toBe('BigPickle')
    })
  })

  describe('readAiConfig (existing files)', () => {
    it('preserves a valid existing config without overwriting', () => {
      const custom = {
        provider: 'opencode-zen',
        apiKey: 'custom-key',
        baseUrl: 'https://example.com/v1',
        model: 'custom-model',
        providers: { 'opencode-zen': { apiKey: 'custom-key', baseUrl: 'https://example.com/v1', model: 'custom-model' } },
        activeProfileId: 'p1',
        profiles: [{ id: 'p1', name: 'Custom', provider: 'opencode-zen', apiKey: 'k', baseUrl: 'u', model: 'm', providers: {} }],
        groq: { apiKey: 'my-groq-key' }
      }
      writeFileSync(join(dir, 'ai-config.json'), JSON.stringify(custom), 'utf8')
      const cfg = readAiConfig(dir)!
      expect(cfg.apiKey).toBe('custom-key')
      expect(cfg.groq?.apiKey).toBe('my-groq-key')
    })

    it('heals invalid configs by merging in defaults while preserving any valid fields', () => {
      writeFileSync(join(dir, 'ai-config.json'), JSON.stringify({ provider: '' }), 'utf8')
      const cfg = readAiConfig(dir)!
      expect(cfg.provider).toBe('opencode-zen')
      expect(cfg.profiles?.length).toBeGreaterThan(0)
    })

    it('returns null when the file is unparseable JSON', () => {
      writeFileSync(join(dir, 'ai-config.json'), '{not valid', 'utf8')
      expect(readAiConfig(dir)).toBeNull()
    })

    it('preserves an existing groq.apiKey when healing', () => {
      writeFileSync(
        join(dir, 'ai-config.json'),
        JSON.stringify({ provider: '', groq: { apiKey: 'kept' } }),
        'utf8'
      )
      const cfg = readAiConfig(dir)!
      expect(cfg.groq?.apiKey).toBe('kept')
    })
  })

  describe('writeAiConfig', () => {
    it('persists the patched fields and keeps untouched fields intact', () => {
      readAiConfig(dir) // seed default
      writeAiConfig(dir, { groq: { apiKey: 'rotated' } })
      const persisted = JSON.parse(readFileSync(join(dir, 'ai-config.json'), 'utf8'))
      expect(persisted.groq.apiKey).toBe('rotated')
      expect(persisted.provider).toBe('opencode-zen')
    })

    it('creates the user data directory if it does not exist', () => {
      const fresh = join(dir, 'nested', 'newdir')
      writeAiConfig(fresh, { provider: 'opencode-zen', apiKey: 'x', model: 'y' })
      expect(existsSync(join(fresh, 'ai-config.json'))).toBe(true)
    })
  })
})
