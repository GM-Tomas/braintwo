import { contextBridge, ipcRenderer } from 'electron'
import { createApi } from './preload-api'

contextBridge.exposeInMainWorld('braintwo', createApi(ipcRenderer))
