import type { MessageKind } from '@shared/types'
import { KIND_STYLE } from './timeline-constants'

export function EmptyState() {
  return (
    <div className="py-20 text-center text-[13px] text-bt-dim">
      <p>Aún no hay mensajes.</p>
      <p className="mt-1">
        Apenas BrainTwo se conecte y reciba algo en tu chat conmigo mismo, vas a
        verlo acá.
      </p>
    </div>
  )
}

export function FilteredEmpty({ kind }: { kind: MessageKind }) {
  const label = KIND_STYLE[kind]?.label.toLowerCase() ?? 'otro'
  return (
    <div className="py-16 text-center text-[13px] text-bt-dim">
      No hay mensajes del tipo <span className="text-bt-text">{label}</span>.
    </div>
  )
}
