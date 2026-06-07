import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { logError } from './logger'
import { join } from 'node:path'
import type { AiConfig } from '@shared/types'

const CONFIG_FILE = 'ai-config.json'

export function readAiConfig(userDataPath: string): AiConfig | null {
  const configPath = join(userDataPath, CONFIG_FILE)
  
  const defaultId = 'profile-default'
  const defaultConfig: AiConfig = {
    provider: 'opencode-zen',
    apiKey: 'public',
    baseUrl: 'https://opencode.ai/zen/v1',
    model: 'big-pickle',
    providers: {
      'opencode-zen': {
        apiKey: 'public',
        baseUrl: 'https://opencode.ai/zen/v1',
        model: 'big-pickle'
      }
    },
    activeProfileId: defaultId,
    profiles: [
      {
        id: defaultId,
        name: 'BigPickle',
        provider: 'opencode-zen',
        apiKey: 'public',
        baseUrl: 'https://opencode.ai/zen/v1',
        model: 'big-pickle',
        providers: {
          'opencode-zen': {
            apiKey: 'public',
            baseUrl: 'https://opencode.ai/zen/v1',
            model: 'big-pickle'
          }
        }
      }
    ]
  }

  // Ensure user data directory exists
  if (!existsSync(userDataPath)) {
    try {
      mkdirSync(userDataPath, { recursive: true })
    } catch (err) {
      logError('ai-config:read', err, 'Failed to create user data directory')
    }
  }

  if (!existsSync(configPath)) {
    try {
      writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8')
      return defaultConfig
    } catch (err) {
      logError('ai-config:read', err, 'Failed to write default config')
      return defaultConfig
    }
  }

  try {
    const raw = readFileSync(configPath, 'utf8')
    const parsed = JSON.parse(raw) as AiConfig

    // Heal the config if it exists but is invalid, empty, or missing provider settings
    if (!parsed || !parsed.provider || !parsed.apiKey || !parsed.profiles || parsed.profiles.length === 0) {
      const healedConfig: AiConfig = {
        provider: parsed?.provider || defaultConfig.provider,
        apiKey: parsed?.apiKey || defaultConfig.apiKey,
        baseUrl: parsed?.baseUrl || defaultConfig.baseUrl,
        model: parsed?.model || defaultConfig.model,
        providers: {
          ...defaultConfig.providers,
          ...parsed?.providers
        },
        activeProfileId: parsed?.activeProfileId || defaultConfig.activeProfileId,
        profiles: parsed?.profiles && parsed.profiles.length > 0 ? parsed.profiles : defaultConfig.profiles
      }
      try {
        writeFileSync(configPath, JSON.stringify(healedConfig, null, 2), 'utf8')
      } catch (err) {
        logError('ai-config:read', err, 'Failed to write healed config')
      }
      return healedConfig
    }

    return parsed
  } catch (err) {
    logError('ai-config:read', err, 'Failed to read or parse config file')
    return null
  }
}

export function writeAiConfig(userDataPath: string, patch: Partial<AiConfig>): void {
  // Ensure user data directory exists
  if (!existsSync(userDataPath)) {
    try {
      mkdirSync(userDataPath, { recursive: true })
    } catch (err) {
      logError('ai-config:write', err, 'Failed to create user data directory')
    }
  }
  const current = readAiConfig(userDataPath) ?? {}
  const next = { ...current, ...patch }
  writeFileSync(join(userDataPath, CONFIG_FILE), JSON.stringify(next, null, 2), 'utf8')
}
