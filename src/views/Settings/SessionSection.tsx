import { useDependencies } from '@/core/infrastructure/DependenciesContext'
import { Icon } from '@/lib/icons'

interface SessionSectionProps {
  onLogout: () => void
}

export function SessionSection({ onLogout }: SessionSectionProps) {
  const { exportService } = useDependencies()
  return (
    <section className="rounded-[8px] border border-bt-border bg-bt-surf p-5">
      <h2 className="text-[15px] font-semibold text-bt-text">Sesion</h2>
      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-bt-red/30 px-4 text-[13px] font-medium text-bt-text transition-colors hover:bg-bt-red/10"
        >
          <Icon name="logout" size={16} />
          Desvincular WhatsApp
        </button>
        <button
          type="button"
          onClick={() => void exportService.importTxt()}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-bt-border px-4 text-[13px] font-medium text-bt-muted transition-colors hover:bg-bt-hover hover:text-bt-text"
        >
          <Icon name="file" size={16} />
          Reimportar export
        </button>
      </div>
    </section>
  )
}
