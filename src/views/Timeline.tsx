import { useEffect, useMemo, useState } from 'react'
import type { MessageSource, RecentMessage } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '@/lib/icons'

const RECENT_LIMIT = 50

const SOURCE_LABEL: Record<MessageSource, string> = {
  realtime: 'Tiempo real',
  'offline-sync': 'Catch-up',
  'history-sync': 'Histórico',
  export: 'Importado'
}

const SOURCE_DOT: Record<MessageSource, string> = {
  realtime: 'bg-bt-accent',
  'offline-sync': 'bg-bt-amber',
  'history-sync': 'bg-bt-primary',
  export: 'bg-bt-red'
}

export function Timeline() {
  const [count, setCount] = useState<number>(0)
  const [messages, setMessages] = useState<RecentMessage[]>([])

  useEffect(() => {
    let mounted = true
    void window.braintwo.app.getMessageCount().then((c) => {
      if (mounted) setCount(c)
    })
    void window.braintwo.app.getRecentMessages(RECENT_LIMIT).then((rows) => {
      if (mounted) setMessages(rows)
    })

    const off = window.braintwo.app.onMessagesBatch((batch) => {
      if (!mounted || batch.length === 0) return
      setCount((prev) => prev + batch.length)
      setMessages((prev) => mergeRecent(batch, prev, RECENT_LIMIT))
    })

    return () => {
      mounted = false
      off()
    }
  }, [])

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'short',
        timeStyle: 'short'
      }),
    []
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-fade-in">
      <PageHeader
        eyebrow="Tu cerebro"
        title="Timeline"
        subtitle="Todo lo que mandaste a BrainTwo, ordenado cronológicamente."
        action={
          <span
            className="text-sm text-bt-muted"
            aria-label="Total de mensajes"
          >
            {count.toLocaleString()} {count === 1 ? 'mensaje' : 'mensajes'}
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto px-14 pb-14 pt-2">
        <div className="max-w-[760px]">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            <ul>
              {messages.map((m) => (
                <NoteRow
                  key={m.id}
                  message={m}
                  formatted={formatter.format(new Date(m.timestamp))}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
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

function NoteRow({
  message,
  formatted
}: {
  message: RecentMessage
  formatted: string
}) {
  return (
    <li>
      <article className="flex items-start gap-[18px] border-b border-bt-border py-5 transition-colors duration-100 hover:bg-white/[0.015]">
        <div
          aria-hidden
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{
            background: 'rgba(26,143,227,0.08)',
            border: '1px solid rgba(26,143,227,0.2)'
          }}
        >
          <Icon name="bolt" size={15} className="text-bt-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-2 line-clamp-2 whitespace-pre-wrap text-[14.5px] leading-relaxed text-bt-text">
            {message.text}
          </p>
          <div className="flex items-center gap-2.5 text-[11.5px] text-bt-dim">
            <span className="inline-flex items-center gap-1.5 text-bt-muted">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${SOURCE_DOT[message.source]}`}
              />
              {SOURCE_LABEL[message.source]}
            </span>
            <span>·</span>
            <time
              dateTime={new Date(message.timestamp).toISOString()}
              className="text-bt-dim"
            >
              {formatted}
            </time>
          </div>
        </div>
        <Icon name="chev" size={14} className="mt-1 text-bt-dim" />
      </article>
    </li>
  )
}

// Prepends the new batch in front of the existing list, deduping by id, then
// truncates to `limit`. Pure to keep the test surface trivial.
export function mergeRecent(
  batch: RecentMessage[],
  prev: RecentMessage[],
  limit: number
): RecentMessage[] {
  if (batch.length === 0) return prev
  const seen = new Set<number>()
  const merged: RecentMessage[] = []
  // Sort the batch newest-first so later iteration produces the right order.
  const sortedBatch = [...batch].sort((a, b) => b.timestamp - a.timestamp)
  for (const m of sortedBatch) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    merged.push(m)
  }
  for (const m of prev) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    merged.push(m)
  }
  return merged.slice(0, limit)
}
