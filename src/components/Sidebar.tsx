import { useState } from 'react'
import type { SyncStatus, View, WAConnectionState, DbChat } from '@shared/types'
import { BrainMark, Icon, type IconName } from '@/lib/icons'
import { SyncStatusBadge } from './SyncStatusBadge'

interface NavItem {
  id: View
  icon: IconName
  label: string
}

const NAV: NavItem[] = [
  { id: 'search', icon: 'search', label: 'Buscar' },
  { id: 'timeline', icon: 'home', label: 'Timeline' },
  { id: 'chat', icon: 'chat', label: 'Chat IA' },
  { id: 'settings', icon: 'settings', label: 'Settings' }
]

interface SidebarProps {
  view: View
  setView: (v: View) => void
  connectionState: WAConnectionState
  syncStatus?: SyncStatus | null
  version?: string
  platform?: NodeJS.Platform | null
  onLogout?: () => void
  theme?: 'light' | 'dark'
  toggleTheme?: () => void
  // Chat list props
  chats?: DbChat[]
  activeChatId?: number | null
  editingChatId?: number | null
  editingTitle?: string
  onSelectChat?: (id: number) => void
  onNewChat?: () => void
  onDeleteChat?: (id: number) => void
  onStartRename?: (id: number, title: string) => void
  onSaveRename?: () => void
  onCancelRename?: () => void
  setEditingTitle?: (title: string) => void
}

export function Sidebar({
  view,
  setView,
  connectionState,
  syncStatus,
  version,
  platform,
  onLogout,
  theme = 'dark',
  toggleTheme = () => {},
  chats = [],
  activeChatId = null,
  editingChatId = null,
  editingTitle = '',
  onSelectChat = () => {},
  onNewChat = () => {},
  onDeleteChat = () => {},
  onStartRename = () => {},
  onSaveRename = () => {},
  onCancelRename = () => {},
  setEditingTitle = () => {}
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('braintwo:sidebar-collapsed') === '1'
    } catch {
      return false
    }
  })

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('braintwo:sidebar-collapsed', next ? '1' : '0')
      } catch {
        // ignore
      }
      return next
    })
  }

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-bt-border bg-bt-sidebar-bg py-5 transition-all duration-300 ${
        collapsed ? 'w-[68px] px-3.5 items-center' : 'w-[208px] px-4'
      }`}
      aria-label="Navegacion principal"
    >
      {/* Cabecera con Marca y Botón de Colapsar */}
      <div
        className={`mb-6 flex ${
          collapsed ? 'justify-center items-center w-full' : 'w-full flex-col'
        }`}
      >
        {!collapsed ? (
          <div className="w-full flex flex-col">
            <div className="flex items-center justify-between w-full px-1">
              <div className="flex items-center gap-3" title="BrainTwo">
                <BrainMark size={30} className="shrink-0" />
                <p className="font-display text-[17px] leading-none text-bt-text">
                  BrainTwo
                </p>
              </div>
              <button
                type="button"
                onClick={toggleCollapse}
                aria-label="Colapsar menú"
                title="Colapsar menú"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-bt-dim hover:bg-bt-hover hover:text-bt-text transition-colors duration-150"
              >
                <Icon name="panel-left-close" size={16} />
              </button>
            </div>
            <p className="pl-[46px] mt-0.5 text-[11px] text-bt-dim">Memoria personal</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label="Expandir menú"
            title="Expandir menú"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-bt-border/30 bg-white/[0.015] text-bt-dim hover:bg-bt-hover hover:text-bt-text transition-colors duration-150"
          >
            <Icon name="panel-left-open" size={18} />
          </button>
        )}
      </div>

      {/* Indicador de Estado */}
      <SyncStatusBadge
        connectionState={connectionState}
        syncStatus={syncStatus}
        collapsed={collapsed}
      />

      <nav className={`flex flex-col gap-1.5 shrink-0 ${
        (collapsed || view !== 'chat') ? 'flex-1' : ''
      } ${collapsed ? 'w-full items-center' : 'w-full'}`}>
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
              className={`relative flex h-10 items-center rounded-[8px] text-[13px] font-medium transition-colors duration-150 ${
                collapsed
                  ? 'w-10 justify-center px-0'
                  : 'w-full gap-3 px-3 text-left'
              } ${
                active
                  ? 'bg-bt-hover text-bt-text shadow-bt-nav-active'
                  : 'text-bt-muted hover:bg-bt-hover/60 hover:text-bt-text'
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute bottom-2.5 left-0 top-2.5 w-0.5 rounded-sm"
                  style={{ background: 'linear-gradient(135deg,var(--bt-primary),var(--bt-accent))' }}
                />
              )}
              <Icon name={item.icon} size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {!collapsed && view === 'chat' && (
        <div className="mt-4 flex flex-1 flex-col overflow-hidden border-t border-bt-border pt-4">
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-[10px] font-bold tracking-wider text-bt-dim uppercase select-none">Recientes</span>
            <button
              type="button"
              onClick={onNewChat}
              className="p-1 text-bt-dim hover:text-bt-text rounded hover:bg-bt-hover transition-colors duration-150"
              title="Nuevo Chat"
            >
              <Icon name="plus" size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
            {chats.map((chat) => {
              const isActive = activeChatId === chat.id
              const isEditing = editingChatId === chat.id
              return (
                <div
                  key={chat.id}
                  onClick={() => !isEditing && onSelectChat(chat.id)}
                  className={`group relative flex items-center justify-between rounded-[8px] px-2.5 py-1.5 text-[12.5px] transition-all duration-150 cursor-pointer ${
                    isActive
                      ? 'bg-bt-hover border border-bt-primary/20 text-bt-text font-medium shadow-bt-nav-active-shadow'
                      : 'text-bt-muted hover:bg-bt-hover/40 hover:text-bt-text border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Icon name="chat" size={13} className={isActive ? 'text-bt-primary' : 'text-bt-dim'} />
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={onSaveRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onSaveRename()
                          if (e.key === 'Escape') onCancelRename()
                        }}
                        autoFocus
                        className="flex-1 bg-bt-surf border border-bt-border rounded px-1 py-0.5 text-[11px] text-bt-text outline-none focus:border-bt-primary/40"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="truncate select-none font-normal"
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          onStartRename(chat.id, chat.title)
                        }}
                        title="Doble click para renombrar"
                      >
                        {chat.title}
                      </span>
                    )}
                  </div>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteChat(chat.id)
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-bt-dim hover:text-bt-red rounded hover:bg-bt-faint"
                      title="Eliminar chat"
                    >
                      <Icon name="x" size={12} />
                    </button>
                  )}
                </div>
              )
            })}
            {chats.length === 0 && (
              <div className="py-4 text-center text-[11px] text-bt-dim select-none">
                Sin chats guardados
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`mt-6 border-t border-bt-border pt-4 ${collapsed ? 'w-full flex flex-col items-center gap-2' : 'w-full flex flex-col gap-2'}`}>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
          title={theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}
          className={`flex h-9 items-center justify-center rounded-[8px] border border-bt-border text-[12px] font-medium text-bt-muted transition-colors hover:bg-bt-hover hover:text-bt-text ${
            collapsed ? 'w-10 px-0' : 'w-full gap-2 px-3'
          }`}
        >
          <Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} className="shrink-0" />
          {!collapsed && <span>{theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}</span>}
        </button>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            aria-label="Cerrar sesion de WhatsApp"
            title="Cerrar sesion de WhatsApp"
            className={`flex h-9 items-center justify-center rounded-[8px] border border-bt-border text-[12px] font-medium text-bt-muted transition-colors hover:border-bt-red/40 hover:bg-bt-red/10 hover:text-bt-text ${
              collapsed ? 'w-10 px-0' : 'w-full gap-2 px-3'
            }`}
          >
            <Icon name="logout" size={16} className="shrink-0" />
            {!collapsed && <span>Cerrar sesion</span>}
          </button>
        )}
        {!collapsed && (
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
        )}
      </div>
    </aside>
  )
}
