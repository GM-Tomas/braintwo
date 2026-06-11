import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MessageKind, ModelProgress, SearchResult, MessageSource } from '@shared/types'
import { PageHeader } from '../../components/PageHeader'
import { useIpcSubscription } from '@/hooks/useIpcSubscription'
import { useDependencies } from '@/core/infrastructure/DependenciesContext'
import { MessageEntity } from '@shared/domain/message.entity'
import { Icon } from '@/lib/icons'
import { KindFilter } from './KindFilter'
import { SOURCE_LABEL } from './timeline-constants'
import { EmptyState, FilteredEmpty } from './EmptyStates'
import { NoteRow } from './NoteRow'
import { MessageDetail } from './MessageDetail'

const RECENT_LIMIT = 50
const SEARCH_LIMIT = 80

export function Timeline() {
  const { messageRepository, aiService } = useDependencies()
  const [count, setCount] = useState<number>(0)
  const [noGroqKey, setNoGroqKey] = useState(false)
  const [messages, setMessages] = useState<MessageEntity[]>([])
  const [recentLoaded, setRecentLoaded] = useState(false)
  const [filter, setFilter] = useState<MessageKind | 'all'>('all')
  const [selected, setSelected] = useState<MessageEntity | null>(null)

  const [showFilters, setShowFilters] = useState<boolean>(() => {
    try {
      return localStorage.getItem('braintwo:show-filters') === '1'
    } catch {
      return false
    }
  })
  const [dateRange, setDateRange] = useState<'all' | 'today' | '7days' | 'month'>('all')
  const [messageSource, setMessageSource] = useState<'all' | MessageSource>('all')
  const [direction, setDirection] = useState<'all' | 'sent' | 'received'>('all')
  const [ignoredIds, setIgnoredIds] = useState<Set<number>>(new Set())

  const handleToggleIgnore = useCallback(async (msgId: number) => {
    try {
      const newState = await window.braintwo.ignore.toggle(msgId)
      setIgnoredIds((prev) => {
        const next = new Set(prev)
        if (newState) next.add(msgId)
        else next.delete(msgId)
        return next
      })
    } catch (err) {
      console.error('Error toggling ignore:', err)
    }
  }, [])

  const toggleFilters = () => {
    setShowFilters((prev) => {
      const next = !prev
      try {
        localStorage.setItem('braintwo:show-filters', next ? '1' : '0')
      } catch {
        // ignore
      }
      return next
    })
  }

  // Transcription state
  const [transcriptions, setTranscriptions] = useState<Record<number, { transcribing: boolean; transcript?: string }>>({})

  useIpcSubscription(window.braintwo.app.onTranscribing, ({ msgId }) => {
    setTranscriptions((prev) => ({ ...prev, [msgId]: { transcribing: true } }))
  })

  useIpcSubscription(window.braintwo.app.onTranscribed, ({ msgId, transcript }) => {
    setTranscriptions((prev) => ({ ...prev, [msgId]: { transcribing: false, transcript } }))
  })

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
      if (mounted) {
        setMessages(rows)
        setRecentLoaded(true)
      }
    })
    void aiService.getConfig().then((cfg) => {
      if (mounted) setNoGroqKey(!cfg?.groq?.apiKey)
    })
    void window.braintwo.ignore.getIds().then((ids) => {
      if (mounted) setIgnoredIds(new Set(ids))
    })
    return () => {
      mounted = false
    }
  }, [messageRepository, aiService])

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

  const formatRelativeTime = useCallback((ts: number) => {
    const diff = Date.now() - ts
    const s = Math.floor(diff / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    const d = Math.floor(h / 24)
    if (s < 60) return 'Ahora'
    if (m < 60) return `Hace ${m} min`
    if (h < 24) return `Hace ${h} h`
    if (d === 1) return 'Ayer'
    if (d < 7) return `Hace ${d} días`
    const date = new Date(ts)
    const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    return `${date.getDate()} ${months[date.getMonth()]}`
  }, [])

  const filteredForCounts = useMemo(() => {
    return messages.filter((m) => {
      if (dateRange !== 'all') {
        const now = new Date()
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        if (dateRange === 'today' && m.timestamp < startOfToday) return false
        if (dateRange === '7days' && m.timestamp < startOfToday - 7 * 24 * 60 * 60 * 1000) return false
        if (dateRange === 'month' && m.timestamp < startOfToday - 30 * 24 * 60 * 60 * 1000) return false
      }
      if (messageSource !== 'all' && m.source !== messageSource) return false
      if (direction !== 'all') {
        if (direction === 'sent' && !m.fromMe) return false
        if (direction === 'received' && m.fromMe) return false
      }
      return true
    })
  }, [messages, dateRange, messageSource, direction])

  const visible = useMemo<MessageEntity[]>(() => {
    return filteredForCounts.filter((m) => {
      if (filter !== 'all' && m.kind !== filter) return false
      return true
    })
  }, [filteredForCounts, filter])

  const counts = useMemo(() => kindCounts(filteredForCounts), [filteredForCounts])

  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-fade-in">
      {selected ? (
        <MessageDetail message={selected} onClose={() => setSelected(null)} onToggleIgnore={handleToggleIgnore} />
      ) : (
        <>
          <PageHeader
            eyebrow="Tu cerebro"
            title="Mis mensajes"
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
          <div className="px-10 pb-3 pt-6">
            <div
              className="flex items-center gap-3 rounded-[12px] border bg-bt-bg px-4 py-3 transition-colors duration-150 focus-within:shadow-[0_0_0_2px_var(--bt-input-focus-border)]"
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
              <button
                type="button"
                onClick={toggleFilters}
                className={`ml-auto flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-semibold transition-all ${
                  showFilters
                    ? 'border-bt-primary/30 bg-bt-primary-faint text-bt-primary'
                    : 'border-bt-border/60 bg-transparent text-bt-muted hover:border-bt-primary/20 hover:text-bt-text'
                }`}
                title="Alternar filtros avanzados"
              >
                <span>Filtros</span>
                <Icon name="chev" size={10} className={`transition-transform duration-200 ${showFilters ? 'rotate-90' : ''}`} />
              </button>
            </div>
            {(modelProgress.status !== 'idle' && modelProgress.status !== 'ready') && (
              <div className="mt-2 flex items-center gap-3 rounded-[8px] border border-bt-border bg-white/[0.025] px-3 py-2">
                <div className="flex-1">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-bt-border/40">
                    <div
                      className="h-full rounded-full bg-bt-accent transition-all duration-300"
                      style={{
                        width: modelProgress.status === 'downloading' && typeof modelProgress.progress === 'number'
                          ? `${Math.round(modelProgress.progress * 100)}%`
                          : '60%'
                      }}
                    />
                  </div>
                </div>
                <span className="shrink-0 text-[11px] text-bt-muted">
                  {modelProgress.status === 'downloading'
                    ? `Modelo semántico${typeof modelProgress.progress === 'number' ? ` ${Math.round(modelProgress.progress * 100)}%` : ''}`
                    : modelProgress.message ?? 'Preparando…'}
                </span>
              </div>
            )}
          </div>

          {/* Collapsible filters */}
          <div className={`transition-all duration-500 ease-in-out ${
            showFilters && !isSearching
              ? 'max-h-[400px] opacity-100 overflow-visible border-b border-bt-border/50'
              : 'max-h-0 opacity-0 pointer-events-none overflow-hidden'
          }`}>
            <div className="flex flex-col gap-4 px-10 pb-4 pt-3">
              <KindFilter active={filter} onChange={setFilter} counts={counts} total={messages.length} className="px-0 pt-0" />
              <div className="flex flex-wrap items-center gap-4">
                {/* Date Range */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-medium text-bt-dim uppercase">Rango de Fecha</label>
                  <div className="flex rounded-lg border border-bt-border bg-bt-bg p-0.5">
                    {(['all', 'today', '7days', 'month'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setDateRange(r)}
                        className={`rounded-[6px] px-3 py-1 text-[11px] font-medium transition-colors ${
                          dateRange === r
                            ? 'bg-bt-hover text-bt-text shadow-bt-nav-active'
                            : 'text-bt-muted hover:text-bt-text'
                        }`}
                      >
                        {r === 'all' ? 'Historico' : r === 'today' ? 'Hoy' : r === '7days' ? '7 dias' : 'Este mes'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Source */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-medium text-bt-dim uppercase">Origen</label>
                  <div className="flex rounded-lg border border-bt-border bg-bt-bg p-0.5">
                    {(['all', 'realtime', 'offline-sync', 'history-sync', 'export'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setMessageSource(s)}
                        className={`rounded-[6px] px-3 py-1 text-[11px] font-medium transition-colors ${
                          messageSource === s
                            ? 'bg-bt-hover text-bt-text shadow-bt-nav-active'
                            : 'text-bt-muted hover:text-bt-text'
                        }`}
                      >
                        {s === 'all' ? 'Todos' : SOURCE_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Direction */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-medium text-bt-dim uppercase">Remitente</label>
                  <div className="flex rounded-lg border border-bt-border bg-bt-bg p-0.5">
                    {(['all', 'sent', 'received'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDirection(d)}
                        className={`rounded-[6px] px-3 py-1 text-[11px] font-medium transition-colors ${
                          direction === d
                            ? 'bg-bt-hover text-bt-text shadow-bt-nav-active'
                            : 'text-bt-muted hover:text-bt-text'
                        }`}
                      >
                        {d === 'all' ? 'Todos' : d === 'sent' ? 'Enviados' : 'Recibidos'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {isSearching ? (
            <div className="flex-1 overflow-y-auto px-10 py-8">
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
                  <ul className="w-full">
                    {searchResults.map((r, idx) => {
                      const m = new MessageEntity(r)
                      return (
                        <NoteRow
                          key={r.id}
                          message={m}
                          formatted={formatRelativeTime(r.timestamp)}
                          isSelected={false}
                          onClick={() => setSelected(m)}
                          similarity={r.similarity}
                          matchSource={r.matchSource}
                          lowRelevance={r.lowRelevance}
                          transcribing={transcriptions[m.id]?.transcribing}
                          transcript={transcriptions[m.id]?.transcript}
                          noApiKey={noGroqKey && m.kind === 'audio' && !transcriptions[m.id]?.transcribing && !transcriptions[m.id]?.transcript}
                          onToggleIgnore={handleToggleIgnore}
                          isIgnored={ignoredIds.has(r.id)}
                          highlight={q}
                          delayMs={idx * 35}
                        />
                      )
                    })}
                  </ul>
                </section>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 overflow-y-auto px-10 pb-8">
                  <div className="w-full">
                    {!recentLoaded && messages.length === 0 ? (
                      <SkeletonList />
                    ) : messages.length === 0 ? (
                      <EmptyState />
                    ) : visible.length === 0 ? (
                      <FilteredEmpty kind={filter as MessageKind} />
                    ) : (
                      <ul className="w-full">
                        {visible.map((m, idx) => (
                          <NoteRow
                            key={m.id}
                            message={m}
                            formatted={formatRelativeTime(m.timestamp)}
                            isSelected={selected ? (selected as MessageEntity).id === m.id : false}
                            onClick={() => setSelected(m)}
                            transcribing={transcriptions[m.id]?.transcribing}
                            transcript={transcriptions[m.id]?.transcript}
                            noApiKey={noGroqKey && m.kind === 'audio' && !transcriptions[m.id]?.transcribing && !transcriptions[m.id]?.transcript}
                            onToggleIgnore={handleToggleIgnore}
                            isIgnored={ignoredIds.has(m.id)}
                            highlight={q}
                            delayMs={idx * 35}
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



function SkeletonList() {
  return (
    <ul className="w-full">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex min-h-[80px] animate-pulse items-start gap-[18px] border-b border-bt-border px-4 py-4">
          <div className="mt-0.5 h-9 w-9 shrink-0 rounded-[10px] bg-bt-hover/50" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-3/4 rounded bg-bt-hover/40" />
            <div className="mt-2 h-3 w-1/2 rounded bg-bt-hover/30" />
          </div>
        </li>
      ))}
    </ul>
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
