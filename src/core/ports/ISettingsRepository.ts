import type { UserSettings, DbStats } from '@shared/types'

export interface ISettingsRepository {
  getSettings(): Promise<UserSettings>
  setSettings(settings: Partial<UserSettings>): Promise<UserSettings>
  getDbStats(): Promise<DbStats>
  openUserDataFolder(): Promise<void>
  getVersion(): Promise<string>
  getPlatform(): Promise<string>
}
