import type { MessageKind } from '@shared/types'

interface KindFilterProps {
  active: MessageKind | 'all'
  onChange: (k: MessageKind | 'all') => void
  counts: Record<MessageKind, number>
  total: number
}

export function KindFilter({ active, onChange, counts, total }: KindFilterProps) {
  const items: { id: MessageKind | 'all'; label: string; count: number }[] = [
    { id: 'all', label: 'Todo', count: total },
    { id: 'text', label: 'Textos', count: counts.text },
    { id: 'audio', label: 'Audios', count: counts.audio },
    { id: 'image', label: 'Imágenes', count: counts.image },
    { id: 'video', label: 'Videos', count: counts.video },
    { id: 'document', label: 'Archivos', count: counts.document }
  ]
  return (
    <div className="flex flex-wrap items-center gap-2 px-14 pt-5">
      {items.map((f) => {
        const isActive = active === f.id
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            aria-pressed={isActive}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? 'border-bt-primary/30 bg-bt-hover text-bt-text'
                : 'border-bt-border bg-transparent text-bt-muted hover:border-bt-primary/20 hover:text-bt-text'
            }`}
          >
            <span>{f.label}</span>
            <span className="text-bt-dim">{f.count}</span>
          </button>
        )
      })}
    </div>
  )
}
