import { useEffect, useState } from 'react'
import type { View, WAConnectionState } from '@shared/types'
import { Onboarding } from './views/Onboarding'
import { Search } from './views/Search'
import { Timeline } from './views/Timeline'

const VIEWS: { id: View; label: string }[] = [
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'search', label: 'Buscar' },
  { id: 'timeline', label: 'Timeline' }
]

const STATUS_LABEL: Record<WAConnectionState, string> = {
  connecting: 'Conectando…',
  open: 'Conectado',
  disconnected: 'Reconectando…',
  'logged-out': 'Sesión cerrada'
}

const STATUS_TONE: Record<WAConnectionState, string> = {
  connecting: 'bg-bt-surface text-bt-muted',
  open: 'bg-emerald-900/30 text-bt-accent',
  disconnected: 'bg-amber-900/30 text-amber-300',
  'logged-out': 'bg-rose-900/30 text-rose-300'
}

export default function App() {
  const [view, setView] = useState<View>('onboarding')
  const [autoRouted, setAutoRouted] = useState(false)
  const [version, setVersion] = useState<string>('')
  const [platform, setPlatform] = useState<NodeJS.Platform | null>(null)
  const [waState, setWaState] = useState<WAConnectionState>('connecting')

  useEffect(() => {
    void window.braintwo.app.getVersion().then(setVersion)
    void window.braintwo.app.getPlatform().then(setPlatform)
    void window.braintwo.wa.getConnectionState().then(setWaState)
    const off = window.braintwo.wa.onConnectionState(setWaState)
    return () => off()
  }, [])

  useEffect(() => {
    if (!autoRouted && waState === 'open') {
      setView('search')
      setAutoRouted(true)
    }
    if (waState === 'logged-out') {
      setView('onboarding')
    }
  }, [waState, autoRouted])

  return (
    <div className="flex h-full flex-col bg-bt-bg text-bt-text">
      <header className="flex items-center justify-between border-b border-bt-border px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-bt-accent" aria-hidden />
          <h1 className="text-lg font-semibold tracking-tight">BrainTwo</h1>
          <span
            className={`ml-1 rounded-md px-2 py-0.5 text-xs ${STATUS_TONE[waState]}`}
          >
            {STATUS_LABEL[waState]}
          </span>
        </div>
        <nav className="flex items-center gap-1 text-sm">
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
          <span className="ml-3 text-xs text-bt-muted">
            {version ? `v${version}` : ''}
            {platform ? ` · ${platform}` : ''}
          </span>
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
