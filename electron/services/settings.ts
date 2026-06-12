import type { App } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { UserSettings } from '@shared/types'

const SETTINGS_FILE = 'settings.json'

function settingsPath(app: Pick<App, 'getPath'>): string {
  return join(app.getPath('userData'), SETTINGS_FILE)
}

function readStoredSettings(app: Pick<App, 'getPath'>): Partial<UserSettings> {
  const file = settingsPath(app)
  if (!existsSync(file)) return {}

  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<UserSettings>
    return parsed
  } catch {
    return {}
  }
}

function isTextSize(value: unknown): value is UserSettings['textSize'] {
  return value === 'small' || value === 'medium' || value === 'large'
}

export function readSettings(app: Pick<App, 'getLoginItemSettings' | 'getPath'>): UserSettings {
  const stored = readStoredSettings(app)

  return {
    autostart: app.getLoginItemSettings().openAtLogin,
    userDataPath: app.getPath('userData'),
    textSize: isTextSize(stored.textSize) ? stored.textSize : 'small'
  }
}

export function writeSettings(
  app: Pick<App, 'getLoginItemSettings' | 'getPath' | 'setLoginItemSettings'>,
  patch: Partial<UserSettings>
): UserSettings {
  if (typeof patch.autostart === 'boolean') {
    app.setLoginItemSettings({
      openAtLogin: patch.autostart,
      openAsHidden: patch.autostart,
      args: patch.autostart ? ['--hidden'] : []
    })
  }

  if (isTextSize(patch.textSize)) {
    const current = readStoredSettings(app)
    writeFileSync(
      settingsPath(app),
      JSON.stringify({ ...current, textSize: patch.textSize }, null, 2),
      'utf8'
    )
  }

  return readSettings(app)
}
