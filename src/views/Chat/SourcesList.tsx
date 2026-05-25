import type { RetrievedContext } from '@shared/types'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import { Icon } from '@/lib/icons'

interface SourcesListProps {
  sources: RetrievedContext[]
  onOpenMessage: (id: number) => void
  onFeedbackGood?: (sourceId: number) => void
}

export function SourcesList({ sources, onOpenMessage, onFeedbackGood }: SourcesListProps) {
  const fmt = useDateFormatter({ dateStyle: 'short', timeStyle: 'short' })
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {sources.map((s, i) => (
        <li
          key={s.id}
          className="flex items-center justify-between gap-3 rounded-[8px] border border-bt-border bg-bt-bg px-3 py-2 text-[12px] transition-colors hover:border-bt-primary/40 hover:bg-bt-hover"
        >
          <button
            type="button"
            onClick={() => onOpenMessage(s.id)}
            className="flex-1 text-left"
          >
            <span className="mr-2 text-bt-dim">[{s.index ?? (i + 1)}]</span>
            <time className="mr-2 text-bt-dim">{fmt.format(new Date(s.timestamp))}</time>
            {s.similarity !== undefined && (
              <span className="mr-2 text-bt-accent">{Math.round(s.similarity * 100)}%</span>
            )}
            <span className="text-bt-muted">
              {s.text.length > 120 ? `${s.text.slice(0, 120)}…` : s.text}
            </span>
          </button>
          {onFeedbackGood && (
            <button
              type="button"
              onClick={() => onFeedbackGood(s.id)}
              title="Buena respuesta: aumentar contexto con este chat"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-bt-muted hover:bg-bt-hover hover:text-bt-accent transition-all"
            >
              <Icon name="check" size={13} />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
