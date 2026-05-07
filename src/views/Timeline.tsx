import { useEffect, useMemo, useState } from 'react'
import type { MessageSource, RecentMessage } from '@shared/types'

const RECENT_LIMIT = 50

const SOURCE_LABEL: Record<MessageSource, string> = {
  realtime: 'Tiempo real',
  'offline-sync': 'Catch-up',
  'history-sync': 'Histórico',
  export: 'Importado'
}

const SOURCE_TONE: Record<MessageSource, string> = {
  realtime: 'bg-emerald-900/30 text-bt-accent',
  'offline-sync': 'bg-amber-900/30 text-amber-300',
  'history-sync': 'bg-sky-900/30 text-sky-300',
  export: 'bg-bt-surface text-bt-muted'
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
    <div className="mx-auto max-w-2xl pt-4">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Timeline</h2>
        <span className="text-sm text-bt-muted" aria-label="Total de mensajes">
          {count.toLocaleString()} {count === 1 ? 'mensaje' : 'mensajes'}
        </span>
      </header>

      {messages.length === 0 ? (
        <div className="rounded-lg border border-bt-border bg-bt-surface p-6 text-sm text-bt-muted">
          Aún no hay mensajes. Apenas BrainTwo se conecte y reciba algo en tu
          chat conmigo mismo, vas a verlo acá.
        </div>
      ) : (
        <ul className="space-y-2">
          {messages.map((m) => (
            <li
              key={m.id}
              className="rounded-lg border border-bt-border bg-bt-surface p-3"
            >
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className={`rounded px-2 py-0.5 ${SOURCE_TONE[m.source]}`}>
                  {SOURCE_LABEL[m.source]}
                </span>
                <time className="text-bt-muted" dateTime={new Date(m.timestamp).toISOString()}>
                  {formatter.format(new Date(m.timestamp))}
                </time>
              </div>
              <p className="whitespace-pre-wrap text-sm">{m.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
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
