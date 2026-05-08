import type { View, WAConnectionState } from '@shared/types'
import { BrainMark, Icon, type IconName } from '@/lib/icons'

interface NavItem {
  id: View
  icon: IconName
  label: string
}

const NAV: NavItem[] = [
  { id: 'search', icon: 'search', label: 'Buscar' },
  { id: 'timeline', icon: 'home', label: 'Timeline' }
]

const STATUS_DOT: Record<WAConnectionState, string> = {
  connecting: 'bg-bt-dim',
  open: 'bg-bt-accent shadow-bt-glow-teal',
  disconnected: 'bg-bt-amber',
  'logged-out': 'bg-bt-red'
}

const STATUS_LABEL: Record<WAConnectionState, string> = {
  connecting: 'Conectando…',
  open: 'Conectado',
  disconnected: 'Reconectando…',
  'logged-out': 'Sesión cerrada'
}

interface SidebarProps {
  view: View
  setView: (v: View) => void
  connectionState: WAConnectionState
  version?: string
  platform?: NodeJS.Platform | null
  onLogout?: () => void
}

export function Sidebar({
  view,
  setView,
  connectionState,
  version,
  platform,
  onLogout
}: SidebarProps) {
  return (
    <aside
      className="flex w-20 shrink-0 flex-col items-center border-r border-bt-border bg-bt-bg py-4"
      aria-label="Navegación principal"
    >
      <div className="mb-6 p-1.5" title="BrainTwo">
        <BrainMark size={26} />
        <span className="sr-only">BrainTwo</span>
      </div>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {NAV.map((item) => {
          const active = view === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              title={item.label}
              className={`relative flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors duration-150 ${
                active
                  ? 'bg-bt-hover text-bt-text'
                  : 'text-bt-muted hover:bg-bt-hover/60 hover:text-bt-text'
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute -left-3 top-2.5 bottom-2.5 w-0.5 rounded-sm bg-bt-grad"
                  style={{ background: 'linear-gradient(135deg,#1a8fe3,#2ec4a5)' }}
                />
              )}
              <Icon name={item.icon} size={18} />
            </button>
          )
        })}
      </nav>

      <div className="flex w-full flex-col items-center gap-2 px-1 pb-1">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-[10px]"
          aria-label="Estado de conexión"
          title={STATUS_LABEL[connectionState]}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[connectionState]}`}
            aria-hidden
          />
        </div>
        <span
          aria-live="polite"
          className="w-full text-[10px] uppercase text-bt-dim text-center leading-tight"
        >
          {STATUS_LABEL[connectionState]}
        </span>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            aria-label="Cerrar sesión de WhatsApp"
            title="Cerrar sesión de WhatsApp"
            className="mt-1 flex w-full flex-col items-center gap-1 rounded-[10px] py-1.5 text-bt-muted transition-colors hover:bg-bt-hover/60 hover:text-bt-text"
          >
            <Icon name="logout" size={16} />
            <span className="text-[9px] uppercase leading-tight">
              Cerrar sesión
            </span>
          </button>
        )}
        {(version || platform) && (
          <span className="mt-1 text-[9px] uppercase text-bt-dim text-center leading-tight">
            {version ? `v${version}` : ''}
            {version && platform ? ' · ' : ''}
            {platform ?? ''}
          </span>
        )}
        <span
          aria-hidden
          className="mt-2 text-[8px] uppercase tracking-ribbon text-bt-dim"
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)'
          }}
        >
          by Syntropy
        </span>
      </div>
    </aside>
  )
}
