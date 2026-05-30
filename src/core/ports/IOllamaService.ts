import type { OllamaInstallProgress, OllamaModel, OllamaPullProgress, OllamaStatus } from '@shared/types'

export type OllamaUnsubscribe = () => void

export interface IOllamaService {
  getStatus(serverUrl?: string): Promise<OllamaStatus>
  install(): Promise<void>
  uninstall(): Promise<void>
  startServer(): Promise<void>
  stopServer(): Promise<void>
  listModels(): Promise<OllamaModel[]>
  pullModel(name: string): Promise<void>
  cancelPull(): Promise<void>
  deleteModel(name: string): Promise<void>
  onPullProgress(cb: (p: OllamaPullProgress) => void): OllamaUnsubscribe
  onInstallProgress(cb: (p: OllamaInstallProgress) => void): OllamaUnsubscribe
  onStatusChange(cb: (status: OllamaStatus) => void): OllamaUnsubscribe
}
