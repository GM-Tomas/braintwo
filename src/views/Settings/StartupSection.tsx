import type { UserSettings } from '@shared/types'
import { useDependencies } from '@/core/infrastructure/DependenciesContext'

interface StartupSectionProps {
  settings: UserSettings | null
  onSettingsChange: (settings: UserSettings) => void
}

export function StartupSection({ settings, onSettingsChange }: StartupSectionProps) {
  const { settingsRepository } = useDependencies()
  return (
    <section className="rounded-[8px] border border-bt-border bg-bt-surf p-5">
      <h2 className="text-[15px] font-semibold text-bt-text">Arranque</h2>
      <label className="mt-4 flex items-center justify-between gap-4 text-sm text-bt-muted">
        <span>Iniciar BrainTwo con Windows</span>
        <input
          type="checkbox"
          checked={settings?.autostart ?? false}
          onChange={(e) => {
            const autostart = e.target.checked
            void settingsRepository.setSettings({ autostart }).then(onSettingsChange)
          }}
          className="h-4 w-4 accent-[#1a8fe3]"
        />
      </label>
    </section>
  )
}
