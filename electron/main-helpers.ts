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
