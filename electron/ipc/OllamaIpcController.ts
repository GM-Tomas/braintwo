import { ipcMain } from 'electron'
import type { AppContext } from '../app-context'
import { readAiConfig, writeAiConfig } from '../services/ai-config'

function getServerUrl(context: AppContext): string {
  const cfg = readAiConfig(context.app.getPath('userData'))
  return cfg?.ollama?.serverUrl ?? 'http://localhost:11434'
}

export class OllamaIpcController {
  static register(context: AppContext) {
    ipcMain.handle('ollama:uninstall', () => {
      context.ollamaService.uninstall()
      context.broadcast('ollama:on-status', 'not-installed')
      // Clear active model from config
      const cfg = readAiConfig(context.app.getPath('userData'))
      writeAiConfig(context.app.getPath('userData'), {
        provider: cfg?.profiles?.[0]?.provider ?? 'opencode-zen',
        apiKey: cfg?.profiles?.[0]?.apiKey ?? 'public',
        model: cfg?.profiles?.[0]?.model ?? '',
        activeProfileId: cfg?.profiles?.[0]?.id ?? 'profile-default',
        ollama: { ...cfg?.ollama, enabled: false, activeModel: '' }
      })
    })

    ipcMain.handle('ollama:get-status', async (_e, serverUrl?: string) => {
      return context.ollamaService.getStatus(serverUrl ?? getServerUrl(context))
    })

    ipcMain.handle('ollama:install', async () => {
      const serverUrl = getServerUrl(context)
      await context.ollamaService.install((progress) => {
        context.broadcast('ollama:on-install-progress', progress)
      })
      // Auto-start server right after installation
      try {
        await context.ollamaService.startServer(serverUrl)
        context.broadcast('ollama:on-status', 'running')
      } catch {
        context.broadcast('ollama:on-status', 'not-running')
      }
    })

    ipcMain.handle('ollama:start-server', async () => {
      const serverUrl = getServerUrl(context)
      try {
        await context.ollamaService.startServer(serverUrl)
        context.broadcast('ollama:on-status', 'running')
        // Preload the active model so the first chat message doesn't cold-start
        const cfg = readAiConfig(context.app.getPath('userData'))
        const model = cfg?.ollama?.activeModel ?? cfg?.model
        if (model) void context.ollamaService.warmupModel(serverUrl, model)
      } catch (err) {
        context.broadcast('ollama:on-status', 'error')
        throw err
      }
    })

    ipcMain.handle('ollama:stop-server', () => {
      context.ollamaService.stopServer()
      context.broadcast('ollama:on-status', 'not-running')
    })

    ipcMain.handle('ollama:list-models', async (_e, serverUrl?: string) => {
      return context.ollamaService.listModels(serverUrl ?? getServerUrl(context))
    })

    ipcMain.handle('ollama:pull-model', async (_e, name: string) => {
      const serverUrl = getServerUrl(context)
      try {
        await context.ollamaService.pullModel(serverUrl, name, (progress) => {
          context.broadcast('ollama:on-pull-progress', progress)
        })
      } catch (err) {
        if ((err as Error).name === 'AbortError') return // user cancelled — not an error
        throw err
      }

      // After pull, auto-set as active model if no model is set
      const cfg = readAiConfig(context.app.getPath('userData'))
      if (!cfg?.ollama?.activeModel) {
        writeAiConfig(context.app.getPath('userData'), {
          model: name,
          ollama: { ...(cfg?.ollama ?? {}), activeModel: name }
        })
      }

      // Preload the just-downloaded model so it's ready immediately
      void context.ollamaService.warmupModel(serverUrl, name)
    })

    ipcMain.handle('ollama:cancel-pull', () => {
      context.ollamaService.cancelPull()
    })

    ipcMain.handle('ollama:delete-model', async (_e, name: string) => {
      const serverUrl = getServerUrl(context)
      await context.ollamaService.deleteModel(serverUrl, name)

      // If the deleted model was active, clear it
      const cfg = readAiConfig(context.app.getPath('userData'))
      if (cfg?.ollama?.activeModel === name) {
        writeAiConfig(context.app.getPath('userData'), {
          model: '',
          ollama: { ...(cfg.ollama ?? {}), activeModel: '' }
        })
      }
    })
  }
}
