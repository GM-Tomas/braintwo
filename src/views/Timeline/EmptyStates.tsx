import type { MessageKind } from '@shared/types'
import { KIND_STYLE } from './timeline-constants'
import { Icon } from '@/lib/icons'

export function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-bt-border bg-bt-surf text-bt-dim">
        <Icon name="archive" size={22} />
      </div>
      <div>
        <p className="text-[14px] font-medium text-bt-text">Todavia no hay mensajes</p>
        <p className="mt-1 max-w-[300px] text-[13px] leading-relaxed text-bt-muted">
          Apenas BrainTwo se conecte y sincronice tu chat de WhatsApp, los mensajes
          van a aparecer aca automaticamente.
        </p>
      </div>
    </div>
  )
}

export function FilteredEmpty({ kind }: { kind: MessageKind }) {
  const label = KIND_STYLE[kind]?.label.toLowerCase() ?? 'otro'
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-bt-border bg-bt-surf text-bt-dim">
        <Icon name={KIND_STYLE[kind]?.icon ?? 'help'} size={18} />
      </div>
      <p className="text-[13px] text-bt-dim">
        No hay mensajes del tipo <span className="text-bt-text">{label}</span>.
      </p>
    </div>
  )
}
