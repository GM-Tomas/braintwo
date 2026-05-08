import { useEffect, useState } from 'react'
import type { View, WAConnectionState } from '@shared/types'
import { Onboarding } from './views/Onboarding'
import { Search } from './views/Search'
import { Timeline } from './views/Timeline'
import { Sidebar } from './components/Sidebar'

export default function App() {
  const [view, setView] = useState<View>('onboarding')
  const [autoRouted, setAutoRouted] = useState(false)
  const [waState, setWaState] = useState<WAConnectionState>('connecting')
  const [version, setVersion] = useState<string>('')
  const [platform, setPlatform] = useState<NodeJS.Platform | null>(null)

  useEffect(() => {
    void window.braintwo.wa.getConnectionState().then(setWaState)
    void window.braintwo.app.getVersion().then(setVersion)
    void window.braintwo.app.getPlatform().then(setPlatform)
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
    <div className="flex h-full bg-bt-bg text-bt-text font-sans">
      <Sidebar
        view={view}
        setView={setView}
        connectionState={waState}
        version={version}
        platform={platform}
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        {view === 'onboarding' && <Onboarding />}
        {view === 'search' && <Search />}
        {view === 'timeline' && <Timeline />}
      </main>
    </div>
  )
}
