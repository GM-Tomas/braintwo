import { useEffect, useState } from 'react'
import type { AppErrorEvent, View, WAConnectionState } from '@shared/types'
import { Onboarding, FTU } from './views/Onboarding'
import { Search } from './views/Search'
import { Timeline } from './views/Timeline'
import { Settings } from './views/Settings'
import { Chat } from './views/Chat'
import { Sidebar } from './components/Sidebar'
import { useDependencies } from '@/core/infrastructure/DependenciesContext'
import { ConnectionEntity } from '@shared/domain/connection.entity'

type Phase = 'welcome' | 'qr' | 'app'

const FTU_KEY = 'braintwo:ftu-seen'
const ONBOARDED_KEY = 'braintwo:onboarded'

function readFlag(key: string): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    if (value) window.localStorage?.setItem(key, '1')
    else window.localStorage?.removeItem(key)
  } catch {
    // ignore
  }
}

function initialPhase(): Phase {
  if (readFlag(ONBOARDED_KEY)) return 'app'
  if (readFlag(FTU_KEY)) return 'qr'
  return 'welcome'
}

export default function App() {
  const { connectionService, settingsRepository } = useDependencies()
  const [phase, setPhase] = useState<Phase>(() => initialPhase())
  const [view, setView] = useState<View>(() =>
    readFlag(ONBOARDED_KEY) ? 'search' : 'onboarding'
  )
  const [autoRouted, setAutoRouted] = useState(false)
  const [waState, setWaState] = useState<WAConnectionState>('connecting')
  const [version, setVersion] = useState<string>('')
  const [platform, setPlatform] = useState<NodeJS.Platform | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [syncStatus, setSyncStatus] = useState<ConnectionEntity | null>(null)
  const [appError, setAppError] = useState<AppErrorEvent | null>(null)

  useEffect(() => {
    void connectionService.getConnectionState().then(setWaState)
    void settingsRepository.getVersion().then(setVersion)
    void settingsRepository.getPlatform().then((p) => setPlatform(p as NodeJS.Platform))
    void connectionService.getSyncStatus().then(setSyncStatus)
    
    void connectionService.getCurrentQr().then((qr) => {
      if (qr) {
        setPhase((prev) => {
          if (prev !== 'app') return prev
          setView('onboarding')
          return 'qr'
        })
      }
    })

    const off = connectionService.onConnectionState((state) => {
      setWaState(state)
      setSyncStatus((prev) =>
        prev
          ? new ConnectionEntity({
              state: state === 'open' ? 'idle' : state,
              label:
                state === 'open'
                  ? 'Al dia'
                  : state === 'disconnected'
                    ? 'Reconectando'
                    : state === 'logged-out'
                      ? 'Sesion cerrada'
                      : 'Conectando',
              lastPrimaryActivityAt: prev.lastPrimaryActivityAt,
              stalePrimaryDays: prev.stalePrimaryDays,
              newMessages: prev.newMessages
            })
          : prev
      )
    })

    const offQr = connectionService.onQr(() => {
      setPhase((prev) => {
        if (prev !== 'app') return prev
        setView('onboarding')
        return 'qr'
      })
    })

    const offSync = connectionService.onSyncStateChanged(setSyncStatus)
    const offError = connectionService.onError((err) => {
      setAppError(err)
      window.setTimeout(() => setAppError(null), 5000)
    })

    return () => {
      off()
      offQr()
      offSync()
      offError()
    }
  }, [connectionService, settingsRepository])

  useEffect(() => {
    if (waState === 'open') {
      writeFlag(ONBOARDED_KEY, true)
      writeFlag(FTU_KEY, true)
      if (phase !== 'app') setPhase('app')
      if (!autoRouted) {
        setView('search')
        setAutoRouted(true)
      }
      return
    }
    if (waState === 'logged-out') {
      setPhase(readFlag(ONBOARDED_KEY) || readFlag(FTU_KEY) ? 'qr' : 'welcome')
      writeFlag(ONBOARDED_KEY, false)
      setView('onboarding')
      setShowLogoutConfirm(false)
    }
  }, [waState, autoRouted, phase])

  if (phase === 'welcome' || phase === 'qr') {
    return (
      <div className="flex h-full bg-bt-bg text-bt-text font-sans">
        <main className="flex flex-1 flex-col overflow-hidden">
          <FTU startAtQr={phase === 'qr'} />
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-bt-bg text-bt-text font-sans">
      <Sidebar
        view={view}
        setView={setView}
        connectionState={waState}
        syncStatus={syncStatus}
        version={version}
        platform={platform}
        onLogout={() => setShowLogoutConfirm(true)}
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        {view === 'onboarding' && <Onboarding />}
        {view === 'search' && <Search />}
        {view === 'timeline' && <Timeline />}
        {view === 'chat' && <Chat onNavigate={setView} />}
        {view === 'settings' && <Settings onLogout={() => setShowLogoutConfirm(true)} />}
      </main>
      {appError && (
        <div className="fixed bottom-5 right-5 z-50 max-w-[360px] rounded-[8px] border border-bt-red/40 bg-[#160b10] px-4 py-3 text-sm text-bt-text shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
          {appError.message}
        </div>
      )}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-6 backdrop-blur-[2px]"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            className="w-full max-w-[360px] rounded-[8px] border border-bt-border bg-[#0a101b] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]"
          >
            <h2
              id="logout-title"
              className="font-display text-[20px] leading-tight text-bt-text"
            >
              Cerrar sesión de WhatsApp
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-bt-muted">
              Para volver a conectar BrainTwo vas a tener que escanear el QR de
              nuevo.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="h-9 rounded-[8px] border border-bt-border px-4 text-[13px] font-medium text-bt-muted transition-colors hover:bg-bt-hover hover:text-bt-text"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false)
                  void connectionService.logout()
                }}
                className="h-9 rounded-[8px] bg-bt-red px-4 text-[13px] font-semibold text-white transition-colors hover:bg-bt-red/90"
              >
                Cerrar sesión
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
