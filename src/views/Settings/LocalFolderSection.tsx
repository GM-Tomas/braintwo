import type { UserSettings } from '@shared/types'
import { useDependencies } from '@/core/infrastructure/DependenciesContext'
import { Icon } from '@/lib/icons'

interface LocalFolderSectionProps {
  settings: UserSettings | null
}

export function LocalFolderSection({ settings }: LocalFolderSectionProps) {
  const { settingsRepository } = useDependencies()
  return (
    <section className="rounded-[8px] border border-bt-border bg-bt-surf p-5">
      <h2 className="text-[15px] font-semibold text-bt-text">Carpeta local</h2>
      <p className="mt-3 break-all text-[12.5px] leading-relaxed text-bt-muted">
        {settings?.userDataPath ?? 'Cargando...'}
      </p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => void settingsRepository.openUserDataFolder()}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-bt-border px-4 text-[13px] font-medium text-bt-muted transition-colors hover:bg-bt-hover hover:text-bt-text"
        >
          <Icon name="folder" size={16} />
          Abrir carpeta
        </button>
        <button
          type="button"
          onClick={() => void window.braintwo.logs.openFile()}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-bt-border px-4 text-[13px] font-medium text-bt-muted transition-colors hover:bg-bt-hover hover:text-bt-text"
        >
          <Icon name="file" size={16} />
          Ver Logs
        </button>
      </div>
    </section>
  )
}
