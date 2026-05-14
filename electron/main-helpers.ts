import { join } from 'node:path'
import type { MenuItemConstructorOptions } from 'electron'
import type { WAConnectionState } from './services/whatsapp-state'

export function statusLabel(state: WAConnectionState): string {
  switch (state) {
    case 'connecting':
      return 'Conectando…'
    case 'open':
      return 'Conectado'
    case 'disconnected':
      return 'Reconectando…'
    case 'logged-out':
      return 'Sesión cerrada'
    default:
      return ''
  }
}

export interface ResourcePathOpts {
  isPackaged: boolean
  resourcesPath: string
  dirname: string
}

export function buildResourcePath(
  opts: ResourcePathOpts,
  ...segments: string[]
): string {
  if (opts.isPackaged) {
    return join(opts.resourcesPath, 'build', ...segments)
  }
  return join(opts.dirname, '..', '..', 'build', ...segments)
}

export function pickTrayIconName(platform: NodeJS.Platform): string {
  return platform === 'darwin' ? 'tray-icon.png' : 'tray-icon@2x.png'
}

export interface TrayMenuActions {
  onOpen: () => void
  onQuit: () => void
}

export function buildTrayMenuTemplate(
  status: string,
  actions: TrayMenuActions
): MenuItemConstructorOptions[] {
  return [
    { label: 'Abrir BrainTwo', click: actions.onOpen },
    { label: `Estado: ${status}`, enabled: false },
    { type: 'separator' },
    { label: 'Salir', click: actions.onQuit }
  ]
}

export interface MessageBatcher<T> {
  push: (item: T) => void
  flush: () => void
  size: () => number
}

export interface BatcherOpts<T> {
  broadcast: (batch: T[]) => void
  scheduler?: (cb: () => void) => unknown
}

// Coalesces calls within a single tick into a single broadcast — so a burst
// of messages from history-sync (potentially 1000+ at once) only crosses
// the IPC boundary once per tick.
export function createMessageBatcher<T>(opts: BatcherOpts<T>): MessageBatcher<T> {
  const schedule = opts.scheduler ?? ((cb) => setImmediate(cb))
  let pending: T[] = []
  let scheduled = false

  function flushNow(): void {
    if (pending.length === 0) {
      scheduled = false
      return
    }
    const batch = pending
    pending = []
    scheduled = false
    opts.broadcast(batch)
  }

  return {
    push(item) {
      pending.push(item)
      if (!scheduled) {
        scheduled = true
        schedule(flushNow)
      }
    },
    flush: flushNow,
    size: () => pending.length
  }
}
