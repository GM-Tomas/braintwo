import type { IOllamaService, OllamaUnsubscribe } from '../ports/IOllamaService'
import type { OllamaInstallProgress, OllamaModel, OllamaPullProgress, OllamaStatus } from '@shared/types'

export class IpcOllamaService implements IOllamaService {
  async getStatus(serverUrl?: string): Promise<OllamaStatus> {
    return window.braintwo.ollama.getStatus(serverUrl)
  }

  async install(): Promise<void> {
    return window.braintwo.ollama.install()
  }

  async uninstall(): Promise<void> {
    return window.braintwo.ollama.uninstall()
  }

  async startServer(): Promise<void> {
    return window.braintwo.ollama.startServer()
  }

  async stopServer(): Promise<void> {
    return window.braintwo.ollama.stopServer()
  }

  async listModels(serverUrl?: string): Promise<OllamaModel[]> {
    return window.braintwo.ollama.listModels(serverUrl)
  }

  async pullModel(name: string): Promise<void> {
    return window.braintwo.ollama.pullModel(name)
  }

  async cancelPull(): Promise<void> {
    return window.braintwo.ollama.cancelPull()
  }

  async deleteModel(name: string): Promise<void> {
    return window.braintwo.ollama.deleteModel(name)
  }

  onPullProgress(cb: (p: OllamaPullProgress) => void): OllamaUnsubscribe {
    return window.braintwo.ollama.onPullProgress(cb)
  }

  onInstallProgress(cb: (p: OllamaInstallProgress) => void): OllamaUnsubscribe {
    return window.braintwo.ollama.onInstallProgress(cb)
  }

  onStatusChange(cb: (status: OllamaStatus) => void): OllamaUnsubscribe {
    return window.braintwo.ollama.onStatusChange(cb)
  }
}
