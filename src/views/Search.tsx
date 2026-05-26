import { useEffect, useRef, useState } from 'react'
import type { ModelProgress, SearchResult } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '@/lib/icons'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import { useIpcSubscription } from '@/hooks/useIpcSubscription'
import { MessageEntity } from '@shared/domain/message.entity'
import { NoteRow } from './Timeline/NoteRow'
import { MessageDetail } from './Timeline/MessageDetail'

const SUGGESTIONS = [
  'Que medidas le pase al carpintero?',
  'Que tengo pendiente esta semana?',
  'Ideas sobre BrainTwo',
  'Resumen de la ultima reunion'
]

const VISIBLE_LIMIT = 80

export function Search() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState<ModelProgress>({ status: 'idle' })
  const [selected, setSelected] = useState<MessageEntity | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useIpcSubscription(window.braintwo.search.onModelProgress, setModel)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100)
    return () => {
      clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    const clean = q.trim()
    setError(null)
    if (!clean) {
      setLoading(false)
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(() => {
      void window.braintwo.search
        .query(clean, 50)
        .then((rows) => {
          if (!cancelled) setResults(rows)
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setResults([])
            setError(err instanceof Error ? err.message : 'No se pudo buscar')
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
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

  const formatter = useDateFormatter({ dateStyle: 'medium', timeStyle: 'short' })

  const focused = q.trim().length > 0
  const visible = results.slice(0, VISIBLE_LIMIT)

  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-fade-in">
      {selected ? (
        <MessageDetail message={selected} onClose={() => setSelected(null)} />
      ) : (
        <>
          <PageHeader
            eyebrow="Busqueda"
            title="Preguntale a tu cerebro"
            subtitle="Busca en lenguaje natural. La IA entiende contexto, no solo palabras exactas."
          />

          <div className="flex-1 overflow-y-auto px-14 py-8">
            <div className="mx-auto max-w-[780px]">
              <div
                className="flex items-center gap-3.5 rounded-[14px] border bg-bt-surf px-5 py-4 transition-colors duration-150"
                style={{
                  borderColor: focused
                    ? 'var(--bt-input-focus-border)'
                    : 'var(--bt-border)'
                }}
              >
                <Icon name="search" size={20} className="text-bt-brand" />
                <input
                  ref={inputRef}
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Proba: que pendientes tengo de la reunion?"
                  aria-label="Buscar en BrainTwo"
                  className="flex-1 bg-transparent text-[17px] text-bt-text outline-none placeholder:text-bt-dim"
                />
                {q ? (
                  <button
                    type="button"
                    onClick={() => setQ('')}
                    className="text-xs text-bt-dim transition-colors hover:text-bt-text"
                  >
                    limpiar
                  </button>
                ) : null}
              </div>

              <ModelStatus progress={model} />

              {!focused ? (
                <SuggestionsPanel onPick={(s) => setQ(s)} />
              ) : (
                <ResultsPanel
                  loading={loading}
                  error={error}
                  results={visible}
                  hiddenCount={Math.max(0, results.length - visible.length)}
                  formatter={formatter}
                  selectedId={null}
                  onSelect={(m) => setSelected(m)}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ModelStatus({ progress }: { progress: ModelProgress }) {
  if (progress.status === 'idle' || progress.status === 'ready') return null
  const pct =
    typeof progress.progress === 'number' ? `${Math.round(progress.progress * 100)}%` : null
  return (
    <div className="mt-3 rounded-[8px] border border-bt-border bg-white/[0.025] px-4 py-2 text-[12px] text-bt-muted">
      {progress.status === 'downloading'
        ? `Descargando modelo semantico${pct ? ` ${pct}` : ''}`
        : progress.message ?? 'Busqueda local disponible'}
    </div>
  )
}

function SuggestionsPanel({ onPick }: { onPick: (s: string) => void }) {
  return (
    <section className="mt-9">
      <div className="mb-3.5 text-[11px] uppercase tracking-eyebrow text-bt-dim">
        Proba preguntar
      </div>
      <ul className="flex flex-col gap-1.5">
        {SUGGESTIONS.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="group flex w-full items-center gap-3 rounded-[10px] border border-bt-border bg-transparent px-[18px] py-3.5 text-left text-[14.5px] text-bt-muted transition-colors duration-150 hover:border-bt-brand/30 hover:text-bt-text"
            >
              <Icon name="bolt" size={14} className="text-bt-accent" />
              <span>{s}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ResultsPanel({
  loading,
  error,
  results,
  hiddenCount,
  formatter,
  selectedId,
  onSelect
}: {
  loading: boolean
  error: string | null
  results: SearchResult[]
  hiddenCount: number
  formatter: Intl.DateTimeFormat
  selectedId: number | null
  onSelect: (m: MessageEntity) => void
}) {
  if (loading) {
    return (
      <div className="py-16 text-center text-[13px] text-bt-dim">
        Buscando en tus mensajes...
      </div>
    )
  }
  if (error) {
    return <div className="py-16 text-center text-[13px] text-bt-red">{error}</div>
  }
  if (results.length === 0) {
    return (
      <div className="py-16 text-center text-[13px] text-bt-dim">
        No hay mensajes lo suficientemente relevantes para esa busqueda.
        <br />
        <span className="text-[12px] opacity-60">Proba con mas contexto o palabras clave distintas.</span>
      </div>
    )
  }
  return (
    <section className="mt-7">
      <div className="mb-3 text-[11px] uppercase tracking-eyebrow text-bt-dim">
        Resultados
      </div>
      <ul className="w-full">
        {results.map((r) => {
          const m = new MessageEntity(r)
          return (
            <NoteRow
              key={r.id}
              message={m}
              formatted={formatter.format(new Date(r.timestamp))}
              isSelected={selectedId === r.id}
              onClick={() => onSelect(m)}
              similarity={r.similarity}
              matchSource={r.matchSource}
              lowRelevance={r.lowRelevance}
            />
          )
        })}
      </ul>
      {hiddenCount > 0 ? (
        <p className="mt-3 text-[12px] text-bt-dim">
          Mostrando los primeros {VISIBLE_LIMIT}; hay {hiddenCount} mas.
        </p>
      ) : null}
    </section>
  )
}
