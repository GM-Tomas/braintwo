import { contextBridge } from 'electron'

const api = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
    chrome: process.versions.chrome
  }
} as const

contextBridge.exposeInMainWorld('braintwo', api)

export type BrainTwoAPI = typeof api
