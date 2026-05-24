import type { RetrievedContext } from '@shared/types'
import { useDateFormatter } from '@/hooks/useDateFormatter'

interface SourcesListProps {
  sources: RetrievedContext[]
}

export function SourcesList({ sources }: SourcesListProps) {
  const fmt = useDateFormatter({ dateStyle: 'short', timeStyle: 'short' })
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {sources.map((s, i) => (
        <li
          key={s.id}
          className="rounded-[8px] border border-bt-border bg-bt-bg px-3 py-2 text-[12px]"
        >
          <span className="mr-2 text-bt-dim">[{i + 1}]</span>
          <time className="mr-2 text-bt-dim">{fmt.format(new Date(s.timestamp))}</time>
          {s.similarity !== undefined && (
            <span className="mr-2 text-bt-accent">{Math.round(s.similarity * 100)}%</span>
          )}
          <span className="text-bt-muted">
            {s.text.length > 120 ? `${s.text.slice(0, 120)}…` : s.text}
          </span>
        </li>
      ))}
    </ul>
  )
}
