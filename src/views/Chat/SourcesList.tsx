import { useState } from 'react'
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
  const [accepted, setAccepted] = useState<Set<number>>(new Set())
  const [feedbackSent, setFeedbackSent] = useState<Set<number>>(new Set())

  function handleFeedback(id: number) {
    if (!onFeedbackGood || accepted.has(id)) return
    setAccepted((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    setFeedbackSent((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    onFeedbackGood(id)

    setTimeout(() => {
      setFeedbackSent((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 2500)
  }

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
            <span className="text-bt-muted">
              {s.text.length > 120 ? `${s.text.slice(0, 120)}…` : s.text}
            </span>
          </button>
          {onFeedbackGood && (
            <div className="flex h-6 items-center shrink-0">
              {feedbackSent.has(s.id) ? (
                <span className="flex items-center gap-1 text-[11px] font-medium text-bt-accent animate-fade-in">
                  <Icon name="check" size={12} />
                  Enviado
                </span>
              ) : accepted.has(s.id) ? null : (
                <button
                  type="button"
                  onClick={() => handleFeedback(s.id)}
                  title="Buena respuesta: mejorar contexto"
                  className="flex h-6 w-6 items-center justify-center rounded-full text-bt-muted transition-all hover:bg-bt-hover hover:text-bt-accent"
                >
                  <Icon name="check" size={13} />
                </button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
