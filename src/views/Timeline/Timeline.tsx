import { useEffect, useMemo, useRef, useState } from 'react'
import type { MessageKind, ModelProgress, SearchResult } from '@shared/types'
import { PageHeader } from '../../components/PageHeader'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import { useIpcSubscription } from '@/hooks/useIpcSubscription'
import { useDependencies } from '@/core/infrastructure/DependenciesContext'
import { MessageEntity } from '@shared/domain/message.entity'
import { Icon } from '@/lib/icons'
import { KindFilter } from './KindFilter'
import { EmptyState, FilteredEmpty } from './EmptyStates'
import { NoteRow } from './NoteRow'
import { MessageDetail } from './MessageDetail'

const RECENT_LIMIT = 50
const SEARCH_LIMIT = 80

export function Timeline() {
  const { messageRepository } = useDependencies()
  const [count, setCount] = useState<number>(0)
  const [messages, setMessages] = useState<MessageEntity[]>([])
  const [filter, setFilter] = useState<MessageKind | 'all'>('all')
  const [selected, setSelected] = useState<MessageEntity | null>(null)

  // Search state
  const [q, setQ] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [modelProgress, setModelProgress] = useState<ModelProgress>({ status: 'idle' })
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const isSearching = q.trim().length > 0

  useEffect(() => {
    let mounted = true
    void messageRepository.getMessageCount().then((c) => {
      if (mounted) setCount(c)
    })
    void messageRepository.getRecentMessages(RECENT_LIMIT).then((rows) => {
      if (mounted) setMessages(rows)
    })
    return () => {
      mounted = false
    }
  }, [messageRepository])

  useIpcSubscription(messageRepository.onMessagesBatch, (batch) => {
    if (batch.length === 0) return
    setCount((prev) => prev + batch.length)
    setMessages((prev) => mergeRecent(batch, prev, RECENT_LIMIT))
  })

  useIpcSubscription(window.braintwo.search.onModelProgress, setModelProgress)

  useEffect(() => {
    const clean = q.trim()
    setSearchError(null)
    if (!clean) {
      setSearchLoading(false)
      setSearchResults([])
      return
    }
    let cancelled = false
    setSearchLoading(true)
    const t = setTimeout(() => {
      void window.braintwo.search
        .query(clean, SEARCH_LIMIT)
        .then((rows) => { if (!cancelled) setSearchResults(rows) })
        .catch((err: unknown) => {
          if (!cancelled) {
            setSearchResults([])
            setSearchError(err instanceof Error ? err.message : 'No se pudo buscar')
          }
        })
        .finally(() => { if (!cancelled) setSearchLoading(false) })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [q])

  // Close detail panel on Escape
  useEffect(() => {
    if (!selected) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selected])

  const formatter = useDateFormatter({ dateStyle: 'short', timeStyle: 'short' })
  const searchFormatter = useDateFormatter({ dateStyle: 'medium', timeStyle: 'short' })

  const visible = useMemo<MessageEntity[]>(
    () => filter === 'all' ? messages : messages.filter((m) => m.kind === filter),
    [messages, filter]
  )

  const counts = useMemo(() => kindCounts(messages), [messages])

  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-fade-in">
      {selected ? (
        <MessageDetail message={selected} onClose={() => setSelected(null)} />
      ) : (
        <>
          <PageHeader
            eyebrow="Tu cerebro"
            title="Timeline"
            subtitle="Explorá y buscá en tu historial de WhatsApp."
            action={
              !isSearching ? (
                <span className="text-sm text-bt-muted" aria-label="Total de mensajes">
                  {count.toLocaleString()} {count === 1 ? 'mensaje' : 'mensajes'}
                </span>
              ) : undefined
            }
          />

          {/* Search bar */}
          <div className="px-10 pb-3 pt-1">
            <div
              className="flex items-center gap-3 rounded-[12px] border bg-bt-surf px-4 py-3 transition-colors duration-150"
              style={{ borderColor: isSearching ? 'var(--bt-input-focus-border)' : 'var(--bt-border)' }}
            >
              <Icon name="search" size={18} className="shrink-0 text-bt-brand" />
              <input
                ref={searchInputRef}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscá en tus mensajes…"
                aria-label="Buscar mensajes"
                className="flex-1 bg-transparent text-[15px] text-bt-text outline-none placeholder:text-bt-dim"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ('')}
                  className="text-xs text-bt-dim transition-colors hover:text-bt-text"
                >
                  limpiar
                </button>
              )}
            </div>
            {(modelProgress.status !== 'idle' && modelProgress.status !== 'ready') && (
              <div className="mt-2 rounded-[8px] border border-bt-border bg-white/[0.025] px-3 py-1.5 text-[11px] text-bt-muted">
                {modelProgress.status === 'downloading'
                  ? `Descargando modelo semántico${typeof modelProgress.progress === 'number' ? ` ${Math.round(modelProgress.progress * 100)}%` : ''}`
                  : modelProgress.message ?? 'Preparando búsqueda…'}
              </div>
            )}
          </div>

          {isSearching ? (
            <div className="flex-1 overflow-y-auto px-10 pb-14">
              {searchLoading ? (
                <div className="py-16 text-center text-[13px] text-bt-dim">
                  Buscando en tus mensajes...
                </div>
              ) : searchError ? (
                <div className="py-16 text-center text-[13px] text-bt-red">{searchError}</div>
              ) : searchResults.length === 0 ? (
                <div className="py-16 text-center text-[13px] text-bt-dim">
                  No hay mensajes lo suficientemente relevantes para esa búsqueda.
                  <br />
                  <span className="text-[12px] opacity-60">Probá con más contexto o palabras clave distintas.</span>
                </div>
              ) : (
                <section className="mt-4">
                  <div className="mb-3 text-[11px] uppercase tracking-eyebrow text-bt-dim">
                    {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
                  </div>
                  <ul className="divide-y divide-bt-border border-y border-bt-border">
                    {searchResults.map((r) => (
                      <li key={r.id} className="py-4">
                        <div className="flex items-start justify-between gap-5">
                          <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-bt-text">
                            {r.text || 'Mensaje sin texto'}
                          </p>
                          <MatchBadge source={r.matchSource} similarity={r.similarity} />
                        </div>
                        <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-bt-dim">
                          <time dateTime={new Date(r.timestamp).toISOString()}>
                            {searchFormatter.format(new Date(r.timestamp))}
                          </time>
                          <span>|</span>
                          <span>{r.source}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          ) : (
            <>
              <KindFilter active={filter} onChange={setFilter} counts={counts} total={messages.length} />
              <div className="flex flex-1 overflow-hidden">
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
                            isSelected={selected ? (selected as MessageEntity).id === m.id : false}
                            onClick={() => setSelected(m)}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function MatchBadge({ source, similarity }: { source?: 'semantic' | 'keyword' | 'both'; similarity: number }) {
  if (source === 'keyword') {
    return (
      <span className="shrink-0 rounded-full border border-bt-accent/30 px-2.5 py-1 text-[11px] text-bt-accent">
        exacto
      </span>
    )
  }
  if (source === 'both') {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-full border border-bt-accent/30 px-2.5 py-1 text-[11px] text-bt-accent">exacto</span>
        <span className="rounded-full border border-bt-brand/30 px-2.5 py-1 text-[11px] text-bt-brand">
          {Math.round(similarity * 100)}%
        </span>
      </div>
    )
  }
  return (
    <span className="shrink-0 rounded-full border border-bt-brand/30 px-2.5 py-1 text-[11px] text-bt-brand">
      {Math.round(similarity * 100)}%
    </span>
  )
}

function kindCounts(list: MessageEntity[]): Record<MessageKind, number> {
  const out: Record<MessageKind, number> = {
    text: 0, audio: 0, image: 0, video: 0, document: 0, sticker: 0, other: 0
  }
  for (const m of list) out[m.kind] = (out[m.kind] ?? 0) + 1
  return out
}

export function mergeRecent<T extends { id: number; timestamp: number }>(
  batch: T[],
  prev: T[],
  limit: number
): T[] {
  if (batch.length === 0) return prev
  const seen = new Set<number>()
  const merged: T[] = []
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
