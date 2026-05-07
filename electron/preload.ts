import { contextBridge, ipcRenderer } from 'electron'

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
  }
} as const

contextBridge.exposeInMainWorld('braintwo', api)

export type BrainTwoAPI = typeof api
