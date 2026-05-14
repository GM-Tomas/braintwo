import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [selected, setSelected] = useState<RecentMessage | null>(null)

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

  // Close panel when Escape is pressed
  useEffect(() => {
    if (!selected) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selected])

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

      <div className="flex flex-1 overflow-hidden">
        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-10 pb-14 pt-2">
          <div className="w-full">
            {messages.length === 0 ? (
              <EmptyState />
            ) : visible.length === 0 ? (
              <FilteredEmpty kind={filter as MessageKind} />
            ) : (
              <ul className="w-full">
                {visible.map((m) => (
                  <NoteRow
                    key={m.id}
                    message={m}
                    formatted={formatter.format(new Date(m.timestamp))}
                    isSelected={selected?.id === m.id}
                    onClick={() => setSelected(prev => prev?.id === m.id ? null : m)}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <MessageDetailPanel
            message={selected}
            onClose={() => setSelected(null)}
          />
        )}
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
  formatted,
  isSelected,
  onClick
}: {
  message: RecentMessage
  formatted: string
  isSelected: boolean
  onClick: () => void
}) {
  const style = KIND_STYLE[message.kind] ?? KIND_STYLE.other
  return (
    <li>
      <article
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
        aria-pressed={isSelected}
        className={`group grid min-h-[92px] cursor-pointer grid-cols-[36px_minmax(0,1fr)_16px] items-start gap-[18px] border-b border-bt-border px-4 py-5 transition-colors duration-100 outline-none focus-visible:ring-1 focus-visible:ring-bt-primary/40 ${
          isSelected
            ? 'bg-bt-primary/[0.06] border-l-2 border-l-bt-primary'
            : 'hover:bg-white/[0.018]'
        }`}
      >
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
        <Icon
          name="chev"
          size={14}
          className={`mt-1 transition-colors ${isSelected ? 'rotate-90 text-bt-primary' : 'text-bt-dim group-hover:text-bt-muted'}`}
        />
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

// ── Detail Panel ────────────────────────────────────────────────────────────

function MessageDetailPanel({
  message,
  onClose
}: {
  message: RecentMessage
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const style = KIND_STYLE[message.kind] ?? KIND_STYLE.other

  const longFormatter = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
    timeStyle: 'medium'
  })

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'ID SQLite', value: message.id },
    { label: 'WhatsApp ID', value: <code className="break-all font-mono text-[11px]">{message.wa_msg_id}</code> },
    {
      label: 'Timestamp',
      value: (
        <span>
          {longFormatter.format(new Date(message.timestamp))}
          <span className="ml-2 text-bt-dim text-[11px]">({message.timestamp})</span>
        </span>
      )
    },
    ...(message.createdAt != null
      ? [{
          label: 'Insertado en BD',
          value: (
            <span>
              {longFormatter.format(new Date(message.createdAt))}
              <span className="ml-2 text-bt-dim text-[11px]">({Math.floor(message.createdAt / 1000)})</span>
            </span>
          )
        }]
      : []),
    { label: 'Tipo', value: <span className={`capitalize ${style.iconColor}`}>{message.kind}</span> },
    { label: 'Fuente', value: SOURCE_LABEL[message.source] },
    { label: 'Enviado por mí', value: message.fromMe ? 'Sí' : 'No' },
  ]

  return (
    <aside
      ref={panelRef}
      className="flex w-[360px] shrink-0 flex-col overflow-hidden border-l border-bt-border bg-bt-surf animate-fade-in"
      aria-label="Detalle del mensaje"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-bt-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]"
            style={{ background: style.bg, border: `1px solid ${style.border}` }}
          >
            <Icon name={style.icon} size={13} className={style.iconColor} />
          </div>
          <span className="text-[13px] font-medium text-bt-text">Detalle del mensaje</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar panel"
          className="rounded-md p-1.5 text-bt-muted transition-colors hover:bg-bt-hover hover:text-bt-text"
        >
          <Icon name="x" size={14} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Text content */}
        {message.text ? (
          <section>
            <SectionLabel>Contenido</SectionLabel>
            <p className="mt-2 whitespace-pre-wrap rounded-lg border border-bt-border bg-bt-hover px-3 py-2.5 text-[13px] leading-relaxed text-bt-text">
              {message.text}
            </p>
          </section>
        ) : null}

        {/* Context note — generated by AI for semantic search enrichment */}
        <section>
          <SectionLabel>Contexto para búsqueda</SectionLabel>
          {message.contextNote ? (
            <p className="mt-2 whitespace-pre-wrap rounded-lg border border-bt-primary/20 bg-bt-primary/[0.06] px-3 py-2.5 text-[13px] leading-relaxed text-bt-text">
              {message.contextNote}
            </p>
          ) : (
            <p className="mt-2 rounded-lg border border-bt-border bg-bt-hover px-3 py-2.5 text-[12px] text-bt-dim italic">
              Pendiente — se genera en background cuando hay IA configurada
            </p>
          )}
        </section>

        {/* All SQLite fields */}
        <section>
          <SectionLabel>Datos SQLite</SectionLabel>
          <dl className="mt-2 divide-y divide-bt-border rounded-lg border border-bt-border overflow-hidden">
            {rows.map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5 px-3 py-2.5">
                <dt className="text-[10.5px] font-medium uppercase tracking-wider text-bt-dim">{label}</dt>
                <dd className="text-[12.5px] text-bt-text break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Media metadata */}
        {message.media ? (
          <section>
            <SectionLabel>Metadata de media</SectionLabel>
            <dl className="mt-2 divide-y divide-bt-border rounded-lg border border-bt-border overflow-hidden">
              {Object.entries(message.media)
                .filter(([, v]) => v != null)
                .map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-0.5 px-3 py-2.5">
                    <dt className="text-[10.5px] font-medium uppercase tracking-wider text-bt-dim">{key}</dt>
                    <dd className="text-[12.5px] text-bt-text break-words">
                      {typeof value === 'boolean'
                        ? value ? 'Sí' : 'No'
                        : key === 'fileLengthBytes'
                        ? formatBytes(value as number)
                        : key === 'durationSec'
                        ? formatDuration(value as number)
                        : String(value)}
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        ) : null}
      </div>
    </aside>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10.5px] font-semibold uppercase tracking-widest text-bt-dim">
      {children}
    </p>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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
