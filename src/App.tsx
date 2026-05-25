import { useCallback, useEffect, useState } from 'react'
import type { AppErrorEvent, DbChat, View, WAConnectionState } from '@shared/types'
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
  const { connectionService, settingsRepository, aiService } = useDependencies()
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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('braintwo:theme')
      return (saved === 'light' || saved === 'dark') ? saved : 'dark'
    } catch {
      return 'dark'
    }
  })

  // Chat management state
  const [chats, setChats] = useState<DbChat[]>([])
  const [activeChatId, setActiveChatId] = useState<number | null>(null)
  const [editingChatId, setEditingChatId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [deleteConfirmChatId, setDeleteConfirmChatId] = useState<number | null>(null)

  const loadChats = useCallback(async () => {
    try {
      const list = await aiService.listChats()
      setChats(list)
    } catch (err) {
      console.error('Error loading chats:', err)
    }
  }, [aiService])

  const startNewChat = useCallback(() => {
    setActiveChatId(null)
    setEditingChatId(null)
  }, [])

  const handleDeleteChat = useCallback(async (id: number) => {
    try {
      await aiService.deleteChat(id)
      setDeleteConfirmChatId(null)
      if (activeChatId === id) {
        startNewChat()
      }
      await loadChats()
    } catch (err) {
      console.error('Error deleting chat:', err)
    }
  }, [aiService, activeChatId, startNewChat, loadChats])

  const saveRename = useCallback(async () => {
    if (editingChatId === null) return
    const title = editingTitle.trim()
    if (!title) {
      setEditingChatId(null)
      return
    }
    try {
      await aiService.renameChat(editingChatId, title)
      setEditingChatId(null)
      await loadChats()
    } catch (err) {
      console.error('Error renaming chat:', err)
    }
  }, [aiService, editingChatId, editingTitle, loadChats])

  useEffect(() => {
    if (view === 'chat') {
      void loadChats()
    }
  }, [view, loadChats])

  useEffect(() => {
    try {
      localStorage.setItem('braintwo:theme', theme)
    } catch {
      // ignore
    }
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

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
        theme={theme}
        toggleTheme={toggleTheme}
        chats={chats}
        activeChatId={activeChatId}
        editingChatId={editingChatId}
        editingTitle={editingTitle}
        onSelectChat={(id) => {
          setView('chat')
          setActiveChatId(id)
        }}
        onNewChat={() => {
          setView('chat')
          startNewChat()
        }}
        onDeleteChat={setDeleteConfirmChatId}
        onStartRename={(id, title) => {
          setEditingChatId(id)
          setEditingTitle(title)
        }}
        onSaveRename={saveRename}
        onCancelRename={() => setEditingChatId(null)}
        setEditingTitle={setEditingTitle}
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        {view === 'onboarding' && <Onboarding />}
        {view === 'search' && <Search />}
        {view === 'timeline' && <Timeline />}
        {view === 'chat' && (
          <Chat
            onNavigate={setView}
            activeChatId={activeChatId}
            setActiveChatId={setActiveChatId}
            loadChats={loadChats}
          />
        )}
        {view === 'settings' && <Settings onLogout={() => setShowLogoutConfirm(true)} />}
      </main>
      {appError && (
        <div className="fixed bottom-5 right-5 z-50 max-w-[360px] rounded-[8px] border border-bt-red/40 bg-bt-surf px-4 py-3 text-sm text-bt-text shadow-bt-modal">
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
            className="w-full max-w-[360px] rounded-[8px] border border-bt-border bg-bt-surf p-5 shadow-bt-modal"
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
      {deleteConfirmChatId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px]"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-chat-title"
            className="w-full max-w-[360px] rounded-[12px] border border-bt-border bg-bt-surf p-5 shadow-bt-modal animate-fade-in text-bt-text"
          >
            <h3 id="delete-chat-title" className="font-display text-[18px] font-semibold text-bt-text">
              ¿Eliminar conversación?
            </h3>
            <p className="mt-2 text-[13px] text-bt-muted leading-relaxed">
              Esta acción no se puede deshacer. Se borrarán de forma permanente todos los mensajes de esta conversación.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmChatId(null)}
                className="h-8 rounded-[8px] border border-bt-border px-3.5 text-[12px] font-medium text-bt-muted hover:bg-bt-hover hover:text-bt-text transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteChat(deleteConfirmChatId)}
                className="h-8 rounded-[8px] bg-bt-red px-3.5 text-[12px] font-semibold text-white hover:bg-bt-red/90 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
