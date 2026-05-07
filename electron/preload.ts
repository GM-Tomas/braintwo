import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

type Unsubscribe = () => void

function subscribe<T>(
  channel: string
): (listener: (payload: T) => void) => Unsubscribe {
  return (listener) => {
    const wrapped = (_e: IpcRendererEvent, payload: T) => listener(payload)
    ipcRenderer.on(channel, wrapped)
    return () => {
      ipcRenderer.off(channel, wrapped)
    }
  }
}

const api = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome
  },
  app: {
    openWindow: (): Promise<void> => ipcRenderer.invoke('app:open-window'),
    quit: (): Promise<void> => ipcRenderer.invoke('app:quit'),
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:get-version'),
    getPlatform: (): Promise<NodeJS.Platform> => ipcRenderer.invoke('app:get-platform')
  },
  wa: {
    getConnectionState: (): Promise<string> => ipcRenderer.invoke('wa:get-connection-state'),
    getCurrentQr: (): Promise<string | null> => ipcRenderer.invoke('wa:get-current-qr'),
    requestQr: (): Promise<void> => ipcRenderer.invoke('wa:request-qr'),
    logout: (): Promise<void> => ipcRenderer.invoke('wa:logout'),
    onConnectionState: subscribe<string>('wa:connection-state'),
    onQr: subscribe<string>('wa:qr'),
    onLoggedOut: subscribe<void>('wa:logged-out')
  }
} as const

contextBridge.exposeInMainWorld('braintwo', api)

export type BrainTwoAPI = typeof api
