import { useEffect, useMemo, useState } from 'react'
import type { MessageKind, MessageSource, RecentMessage } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Icon, type IconName } from '@/lib/icons'

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

interface KindStyle {
  icon: IconName
  label: string
  iconColor: string
  bg: string
  border: string
}

const KIND_STYLE: Record<MessageKind, KindStyle> = {
  text: {
    icon: 'bolt',
    label: 'Texto',
    iconColor: 'text-bt-primary',
    bg: 'rgba(26,143,227,0.08)',
    border: 'rgba(26,143,227,0.20)'
  },
  audio: {
    icon: 'mic',
    label: 'Audio',
    iconColor: 'text-bt-amber',
    bg: 'rgba(232,184,78,0.10)',
    border: 'rgba(232,184,78,0.25)'
  },
  image: {
    icon: 'image',
    label: 'Imagen',
    iconColor: 'text-bt-accent',
    bg: 'rgba(46,196,165,0.10)',
    border: 'rgba(46,196,165,0.25)'
  },
  video: {
    icon: 'video',
    label: 'Video',
    iconColor: 'text-bt-red',
    bg: 'rgba(232,93,93,0.10)',
    border: 'rgba(232,93,93,0.25)'
  },
  document: {
    icon: 'file',
    label: 'Documento',
    iconColor: 'text-bt-text',
    bg: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.10)'
  },
  sticker: {
    icon: 'sticker',
    label: 'Sticker',
    iconColor: 'text-bt-accent',
    bg: 'rgba(46,196,165,0.08)',
    border: 'rgba(46,196,165,0.18)'
  },
  other: {
    icon: 'help',
    label: 'Otro',
    iconColor: 'text-bt-muted',
    bg: 'rgba(122,146,176,0.08)',
    border: 'rgba(122,146,176,0.18)'
  }
}

export function Timeline() {
  const [count, setCount] = useState<number>(0)
  const [messages, setMessages] = useState<RecentMessage[]>([])
  const [filter, setFilter] = useState<MessageKind | 'all'>('all')

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

  const visible = useMemo(
    () =>
      filter === 'all'
        ? messages
        : messages.filter((m) => m.kind === filter),
    [messages, filter]
  )

  const counts = useMemo(() => kindCounts(messages), [messages])

  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-fade-in">
      <PageHeader
        eyebrow="Tu cerebro"
        title="Timeline"
        subtitle="Todo lo que mandaste a BrainTwo, ordenado cronológicamente — texto, audios, imágenes, videos y archivos."
        action={
          <span
            className="text-sm text-bt-muted"
            aria-label="Total de mensajes"
          >
            {count.toLocaleString()} {count === 1 ? 'mensaje' : 'mensajes'}
          </span>
        }
      />

      <KindFilter active={filter} onChange={setFilter} counts={counts} total={messages.length} />

      <div className="flex-1 overflow-y-auto px-14 pb-14 pt-2">
        <div className="max-w-[760px]">
          {messages.length === 0 ? (
            <EmptyState />
          ) : visible.length === 0 ? (
            <FilteredEmpty kind={filter as MessageKind} />
          ) : (
            <ul>
              {visible.map((m) => (
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

function KindFilter({
  active,
  onChange,
  counts,
  total
}: {
  active: MessageKind | 'all'
  onChange: (k: MessageKind | 'all') => void
  counts: Record<MessageKind, number>
  total: number
}) {
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

function FilteredEmpty({ kind }: { kind: MessageKind }) {
  return (
    <div className="py-16 text-center text-[13px] text-bt-dim">
      No hay mensajes del tipo <span className="text-bt-text">{KIND_STYLE[kind].label.toLowerCase()}</span>.
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
  const style = KIND_STYLE[message.kind] ?? KIND_STYLE.other
  return (
    <li>
      <article className="flex items-start gap-[18px] border-b border-bt-border py-5 transition-colors duration-100 hover:bg-white/[0.015]">
        <div
          aria-hidden
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{
            background: style.bg,
            border: `1px solid ${style.border}`
          }}
        >
          <Icon name={style.icon} size={15} className={style.iconColor} />
        </div>
        <div className="min-w-0 flex-1">
          <NotePreview message={message} kindLabel={style.label} />
          <div className="mt-2 flex items-center gap-2.5 text-[11.5px] text-bt-dim">
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
            {message.fromMe ? (
              <>
                <span>·</span>
                <span className="text-bt-dim">enviado</span>
              </>
            ) : null}
          </div>
        </div>
        <Icon name="chev" size={14} className="mt-1 text-bt-dim" />
      </article>
    </li>
  )
}

function NotePreview({
  message,
  kindLabel
}: {
  message: RecentMessage
  kindLabel: string
}) {
  if (message.text) {
    return (
      <p className="line-clamp-2 whitespace-pre-wrap text-[14.5px] leading-relaxed text-bt-text">
        {message.text}
      </p>
    )
  }
  return (
    <div className="flex items-baseline gap-2 text-[14.5px] leading-relaxed">
      <span className="text-bt-text">{kindLabel}</span>
      <span className="text-[12.5px] text-bt-muted">{mediaSummary(message)}</span>
    </div>
  )
}

function mediaSummary(message: RecentMessage): string {
  const m = message.media
  if (!m) return 'Sin contenido textual'
  const parts: string[] = []
  if (typeof m.durationSec === 'number' && m.durationSec > 0) {
    parts.push(formatDuration(m.durationSec))
  }
  if (m.fileName) parts.push(m.fileName)
  if (!m.fileName && typeof m.fileLengthBytes === 'number') {
    parts.push(formatBytes(m.fileLengthBytes))
  }
  if (m.ptt) parts.push('Nota de voz')
  if (m.transcript) parts.push(`"${m.transcript.slice(0, 60)}…"`)
  return parts.length ? parts.join(' · ') : 'Sin descripción'
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function kindCounts(list: RecentMessage[]): Record<MessageKind, number> {
  const out: Record<MessageKind, number> = {
    text: 0,
    audio: 0,
    image: 0,
    video: 0,
    document: 0,
    sticker: 0,
    other: 0
  }
  for (const m of list) out[m.kind] = (out[m.kind] ?? 0) + 1
  return out
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
