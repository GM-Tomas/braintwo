import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AiConfig } from '@shared/types'

const CONFIG_FILE = 'ai-config.json'

export function readAiConfig(userDataPath: string): AiConfig | null {
  try {
    const raw = readFileSync(join(userDataPath, CONFIG_FILE), 'utf8')
    return JSON.parse(raw) as AiConfig
  } catch {
    return null
  }
}

export function writeAiConfig(userDataPath: string, patch: Partial<AiConfig>): void {
  const current = readAiConfig(userDataPath) ?? {}
  const next = { ...current, ...patch }
  writeFileSync(join(userDataPath, CONFIG_FILE), JSON.stringify(next, null, 2), 'utf8')
}
