import type { App } from 'electron'
import type { UserSettings } from '@shared/types'

export function readSettings(app: Pick<App, 'getLoginItemSettings' | 'getPath'>): UserSettings {
  return {
    autostart: app.getLoginItemSettings().openAtLogin,
    userDataPath: app.getPath('userData')
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
  return readSettings(app)
}
