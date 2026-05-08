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
  connecting: 'Conectando...',
  open: 'Conectado',
  disconnected: 'Reconectando...',
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
      className="flex w-[208px] shrink-0 flex-col border-r border-bt-border bg-[#070c14] px-4 py-5"
      aria-label="Navegación principal"
    >
      <section
        className="mb-5 flex items-center gap-2.5 rounded-[8px] border border-bt-border bg-white/[0.025] px-3 py-2.5"
        aria-label="Estado de conexión"
        title={STATUS_LABEL[connectionState]}
      >
        <span
          className={`h-2 w-2 rounded-full ${STATUS_DOT[connectionState]}`}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-eyebrow text-bt-dim">
            WhatsApp
          </p>
          <p
            aria-live="polite"
            className="truncate text-[13px] font-medium text-bt-text"
          >
            {STATUS_LABEL[connectionState]}
          </p>
        </div>
      </section>

      <div className="mb-8 flex items-center gap-3 px-1" title="BrainTwo">
        <BrainMark size={30} />
        <div className="min-w-0">
          <p className="font-display text-[17px] leading-none text-bt-text">
            BrainTwo
          </p>
          <p className="mt-1 text-[11px] text-bt-dim">Memoria personal</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5">
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
              className={`relative flex h-10 w-full items-center gap-3 rounded-[8px] px-3 text-left text-[13px] font-medium transition-colors duration-150 ${
                active
                  ? 'bg-bt-hover text-bt-text shadow-[inset_0_0_0_1px_rgba(26,143,227,0.18)]'
                  : 'text-bt-muted hover:bg-bt-hover/60 hover:text-bt-text'
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute bottom-2.5 left-0 top-2.5 w-0.5 rounded-sm"
                  style={{ background: 'linear-gradient(135deg,#1a8fe3,#2ec4a5)' }}
                />
              )}
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className="mt-6 border-t border-bt-border pt-4">
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            aria-label="Cerrar sesión de WhatsApp"
            title="Cerrar sesión de WhatsApp"
            className="flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-bt-border text-[12px] font-medium text-bt-muted transition-colors hover:border-bt-red/40 hover:bg-bt-red/10 hover:text-bt-text"
          >
            <Icon name="logout" size={16} />
            <span>Cerrar sesión</span>
          </button>
        )}
        <div className="mt-4 flex items-center justify-between gap-3 px-0.5 text-[11px] text-bt-dim">
          <span>by Syntropy</span>
          {(version || platform) && (
            <span className="truncate text-right">
              {version ? `v${version}` : ''}
              {version && platform ? ' | ' : ''}
              {platform ?? ''}
            </span>
          )}
        </div>
      </div>
    </aside>
  )
}
