import type { IpcRenderer, IpcRendererEvent } from 'electron'
import type { WAConnectionState } from './services/whatsapp-state'

export type Unsubscribe = () => void

export interface BrainTwoApi {
  platform: NodeJS.Platform
  versions: {
    electron: string
    node: string
    chrome: string
  }
  app: {
    openWindow: () => Promise<void>
    quit: () => Promise<void>
    getVersion: () => Promise<string>
    getPlatform: () => Promise<NodeJS.Platform>
  }
  wa: {
    getConnectionState: () => Promise<WAConnectionState>
    getCurrentQr: () => Promise<string | null>
    requestQr: () => Promise<void>
    logout: () => Promise<void>
    onConnectionState: (cb: (state: WAConnectionState) => void) => Unsubscribe
    onQr: (cb: (qr: string) => void) => Unsubscribe
    onLoggedOut: (cb: () => void) => Unsubscribe
  }
}

export interface PreloadEnv {
  platform: NodeJS.Platform
  versions: {
    electron?: string
    node?: string
    chrome?: string
  }
}

export function createApi(
  ipcRenderer: Pick<IpcRenderer, 'invoke' | 'on' | 'off'>,
  env: PreloadEnv = {
    platform: process.platform,
    versions: {
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome
    }
  }
): BrainTwoApi {
  function subscribe<T>(
    channel: string
  ): (listener: (payload: T) => void) => Unsubscribe {
    return (listener) => {
      const wrapped = (_e: IpcRendererEvent, payload: T): void => listener(payload)
      ipcRenderer.on(channel, wrapped as (event: IpcRendererEvent, ...args: unknown[]) => void)
      return () => {
        ipcRenderer.off(channel, wrapped as (event: IpcRendererEvent, ...args: unknown[]) => void)
      }
    }
  }

  return {
    platform: env.platform,
    versions: {
      electron: env.versions.electron ?? '',
      node: env.versions.node ?? '',
      chrome: env.versions.chrome ?? ''
    },
    app: {
      openWindow: () => ipcRenderer.invoke('app:open-window'),
      quit: () => ipcRenderer.invoke('app:quit'),
      getVersion: () => ipcRenderer.invoke('app:get-version'),
      getPlatform: () => ipcRenderer.invoke('app:get-platform')
    },
    wa: {
      getConnectionState: () => ipcRenderer.invoke('wa:get-connection-state'),
      getCurrentQr: () => ipcRenderer.invoke('wa:get-current-qr'),
      requestQr: () => ipcRenderer.invoke('wa:request-qr'),
      logout: () => ipcRenderer.invoke('wa:logout'),
      onConnectionState: subscribe<WAConnectionState>('wa:connection-state'),
      onQr: subscribe<string>('wa:qr'),
      onLoggedOut: subscribe<void>('wa:logged-out')
    }
  }
}
