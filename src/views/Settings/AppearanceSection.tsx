import type { UserSettings } from '@shared/types'
import { useDependencies } from '@/core/infrastructure/DependenciesContext'

interface AppearanceSectionProps {
  textSize: UserSettings['textSize']
  onTextSizeChange: (size: UserSettings['textSize']) => void
  onSettingsChange: (settings: UserSettings) => void
}

const TEXT_SIZE_OPTIONS: Array<{
  value: UserSettings['textSize']
  label: string
}> = [
  { value: 'small', label: 'Chico' },
  { value: 'medium', label: 'Medio' },
  { value: 'large', label: 'Grande' }
]

export function AppearanceSection({
  textSize,
  onTextSizeChange,
  onSettingsChange
}: AppearanceSectionProps) {
  const { settingsRepository } = useDependencies()

  function updateTextSize(next: UserSettings['textSize']) {
    onTextSizeChange(next)
    void settingsRepository
      .setSettings({ textSize: next })
      .then(onSettingsChange)
      .catch(() => onTextSizeChange(textSize))
  }

  return (
    <section className="rounded-[8px] border border-bt-border bg-bt-surf p-5">
      <h2 className="text-[15px] font-semibold text-bt-text">Apariencia</h2>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-4">
          <span className="text-[12px] font-medium text-bt-muted">Tamaño de letra</span>
          <span className="text-[11px] text-bt-dim">Vista de la app</span>
        </div>
        <div className="grid grid-cols-3 rounded-[8px] border border-bt-border bg-bt-bg p-1">
          {TEXT_SIZE_OPTIONS.map((option) => {
            const selected = option.value === textSize
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => updateTextSize(option.value)}
                className={`h-8 rounded-[6px] text-[12px] font-medium transition-colors ${
                  selected
                    ? 'bg-bt-primary text-white'
                    : 'text-bt-muted hover:bg-bt-hover hover:text-bt-text'
                }`}
                aria-pressed={selected}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
