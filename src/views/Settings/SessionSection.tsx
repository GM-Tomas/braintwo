import type { UserSettings } from '@shared/types'
import { useDependencies } from '@/core/infrastructure/DependenciesContext'
import { Icon } from '@/lib/icons'

interface SessionSectionProps {
  settings: UserSettings | null
  onSettingsChange: (settings: UserSettings) => void
  onLogout: () => void
}

export function SessionSection({ settings, onSettingsChange, onLogout }: SessionSectionProps) {
  const { settingsRepository } = useDependencies()
  return (
    <section className="rounded-[8px] border border-bt-border bg-bt-surf p-5">
      <h2 className="text-[15px] font-semibold text-bt-text">Sesion</h2>
      <div className="mt-4 flex flex-col gap-4">
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-bt-red/30 px-4 text-[13px] font-medium text-bt-text transition-colors hover:bg-bt-red/10"
        >
          <Icon name="logout" size={16} />
          Desvincular WhatsApp
        </button>

        <div className="border-t border-bt-border/60 pt-4">
          <label className="flex items-center justify-between gap-4 text-sm text-bt-muted cursor-pointer select-none">
            <span>Iniciar BrainTwo con Windows</span>
            <input
              type="checkbox"
              checked={settings?.autostart ?? false}
              onChange={(e) => {
                const autostart = e.target.checked
                void settingsRepository.setSettings({ autostart }).then(onSettingsChange)
              }}
              className="h-4 w-4 accent-bt-primary cursor-pointer"
            />
          </label>
        </div>
      </div>
    </section>
  )
}
