import { useState } from 'react'
import type { View } from '@shared/types'
import { Onboarding } from './views/Onboarding'
import { Search } from './views/Search'
import { Timeline } from './views/Timeline'

const VIEWS: { id: View; label: string }[] = [
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'search', label: 'Buscar' },
  { id: 'timeline', label: 'Timeline' }
]

export default function App() {
  const [view, setView] = useState<View>('onboarding')

  return (
    <div className="flex h-full flex-col bg-bt-bg text-bt-text">
      <header className="flex items-center justify-between border-b border-bt-border px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-bt-accent" />
          <h1 className="text-lg font-semibold tracking-tight">BrainTwo</h1>
          <span className="ml-2 text-xs text-bt-muted">
            Iniciando…
          </span>
        </div>
        <nav className="flex gap-1 text-sm">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`rounded-md px-3 py-1.5 transition ${
                view === v.id
                  ? 'bg-bt-primary text-white'
                  : 'text-bt-muted hover:bg-bt-surface hover:text-bt-text'
              }`}
            >
              {v.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="flex-1 overflow-auto p-6">
        {view === 'onboarding' && <Onboarding />}
        {view === 'search' && <Search />}
        {view === 'timeline' && <Timeline />}
      </main>
    </div>
  )
}
