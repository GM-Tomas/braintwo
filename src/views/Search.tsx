import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '@/lib/icons'

const SUGGESTIONS = [
  '¿Qué medidas le pasé al carpintero?',
  '¿Qué tengo pendiente esta semana?',
  'Ideas sobre BrainTwo',
  'Resumen de la última reunión'
]

export function Search() {
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100)
    return () => clearTimeout(t)
  }, [])

  const focused = q.length > 0

  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-fade-in">
      <PageHeader
        eyebrow="Búsqueda"
        title="Preguntale a tu cerebro"
        subtitle="Buscá en lenguaje natural. La IA entiende el contexto, no solo las palabras."
      />

      <div className="flex-1 overflow-y-auto px-14 py-8">
        <div className="mx-auto max-w-[720px]">
          <div
            className="flex items-center gap-3.5 rounded-[14px] border bg-bt-surf px-5 py-4 transition-colors duration-150"
            style={{
              borderColor: focused
                ? 'rgba(26,143,227,0.4)'
                : 'rgba(255,255,255,0.06)'
            }}
          >
            <Icon name="search" size={20} className="text-bt-primary" />
            <input
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Probá: ¿qué pendientes tengo de la reunión?"
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

          {!focused ? (
            <SuggestionsPanel onPick={(s) => setQ(s)} />
          ) : (
            <ComingSoonPanel query={q} />
          )}
        </div>
      </div>
    </div>
  )
}

function SuggestionsPanel({ onPick }: { onPick: (s: string) => void }) {
  return (
    <section className="mt-9">
      <div className="mb-3.5 text-[11px] uppercase tracking-eyebrow text-bt-dim">
        Probá preguntar
      </div>
      <ul className="flex flex-col gap-1.5">
        {SUGGESTIONS.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="group flex w-full items-center gap-3 rounded-[10px] border border-bt-border bg-transparent px-[18px] py-3.5 text-left text-[14.5px] text-bt-muted transition-colors duration-150 hover:border-bt-primary/30 hover:text-bt-text"
            >
              <Icon name="bolt" size={14} className="text-bt-accent" />
              <span>{s}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-7 text-[12px] leading-relaxed text-bt-dim">
        Búsqueda semántica disponible desde la Etapa 5. Por ahora podés
        ojear las búsquedas que tenés en mente.
      </p>
    </section>
  )
}

function ComingSoonPanel({ query }: { query: string }) {
  return (
    <section className="mt-7">
      <div className="mb-1 text-[11px] uppercase tracking-eyebrow text-bt-dim">
        Búsqueda
      </div>
      <div className="rounded-[10px] border border-bt-border bg-bt-surf px-5 py-6 text-sm text-bt-muted">
        <p>
          Búsqueda semántica disponible desde la Etapa 5. Tu consulta —
          <span className="text-bt-text"> "{query}" </span>— se va a resolver
          contra los embeddings de tus mensajes apenas tengamos esa capa.
        </p>
      </div>
    </section>
  )
}
