import type { ISettingsRepository } from '../ports/ISettingsRepository'
import type { UserSettings, DbStats } from '@shared/types'

export class IpcSettingsRepository implements ISettingsRepository {
  async getSettings(): Promise<UserSettings> {
    return window.braintwo.app.getSettings()
  }

  async setSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
    return window.braintwo.app.setSettings(settings)
  }

  async getDbStats(): Promise<DbStats> {
    return window.braintwo.app.getDbStats()
  }

  async openUserDataFolder(): Promise<void> {
    return window.braintwo.app.openUserDataFolder()
  }

  async getVersion(): Promise<string> {
    return window.braintwo.app.getVersion()
  }

  async getPlatform(): Promise<string> {
    return window.braintwo.app.getPlatform()
  }
}
