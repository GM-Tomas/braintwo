import { useCallback, useEffect, useState } from 'react'
import type { AiConfig, AiProvider } from '@shared/types'
import { useDependencies } from '@/core/infrastructure/DependenciesContext'
import { Icon } from '@/lib/icons'

export function AiConfigSection() {
  const { aiService } = useDependencies()
  const [aiDraft, setAiDraft] = useState<Partial<AiConfig>>({})
  const [aiSaving, setAiSaving] = useState(false)
  const [aiSaved, setAiSaved] = useState(false)

  useEffect(() => {
    void aiService.getConfig().then((cfg) => {
      if (cfg) {
        // Initialize providers object and ensure current provider settings are saved in the map
        const provider = cfg.provider
        const providers = cfg.providers ?? {}
        if (provider && !providers[provider]) {
          providers[provider] = {
            apiKey: cfg.apiKey ?? '',
            baseUrl: cfg.baseUrl ?? '',
            model: cfg.model ?? ''
          }
        }
        setAiDraft({
          ...cfg,
          providers
        })
      }
    })
  }, [aiService])

  const saveAiConfig = useCallback(() => {
    if (!aiDraft.provider) return
    setAiSaving(true)
    void aiService.setConfig(aiDraft).then(() => {
      setAiSaving(false)
      setAiSaved(true)
      setTimeout(() => setAiSaved(false), 2000)
    })
  }, [aiDraft, aiService])

  const handleProviderChange = (newProvider: AiProvider) => {
    setAiDraft((prev) => {
      const providers = prev.providers ?? {}
      const savedForProvider = providers[newProvider] ?? { apiKey: '', baseUrl: '', model: '' }
      return {
        ...prev,
        provider: newProvider,
        apiKey: savedForProvider.apiKey ?? '',
        baseUrl: savedForProvider.baseUrl ?? '',
        model: savedForProvider.model ?? '',
        providers: {
          ...providers,
          [newProvider]: savedForProvider
        }
      }
    })
  }

  const handleFieldChange = (field: 'apiKey' | 'baseUrl' | 'model', value: string) => {
    setAiDraft((prev) => {
      const currentProvider = prev.provider
      if (!currentProvider) return { ...prev, [field]: value }

      const providers = prev.providers ?? {}
      const providerConfig = providers[currentProvider] ?? { apiKey: '', baseUrl: '', model: '' }
      const updatedProviderConfig = {
        ...providerConfig,
        [field]: value
      }

      return {
        ...prev,
        [field]: value,
        providers: {
          ...providers,
          [currentProvider]: updatedProviderConfig
        }
      }
    })
  }

  const modelPlaceholder =
    aiDraft.provider === 'anthropic'
      ? 'claude-haiku-4-5'
      : aiDraft.provider === 'gemini'
        ? 'gemini-2.0-flash'
        : aiDraft.provider === 'deepseek'
          ? 'deepseek-v4-pro'
          : aiDraft.provider === 'opencode-zen'
            ? 'big-pickle'
            : 'gpt-4o-mini'

  const baseUrlPlaceholder =
    aiDraft.provider === 'deepseek'
      ? 'https://api.deepseek.com'
      : aiDraft.provider === 'opencode-zen'
        ? 'https://opencode.ai/zen/v1'
        : 'http://localhost:11434/v1'

  return (
    <section className="col-span-full rounded-[8px] border border-bt-border bg-bt-surf p-5">
      <h2 className="text-[15px] font-semibold text-bt-text">Asistente IA</h2>
      <p className="mt-1 text-[12px] text-bt-muted">
        Configurá el proveedor de lenguaje para el Chat IA. La API key se guarda localmente.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-eyebrow text-bt-dim">Proveedor</span>
          <select
            value={aiDraft.provider ?? ''}
            onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
            className="h-9 rounded-[8px] border border-bt-border bg-bt-bg px-3 text-[13px] text-bt-text outline-none focus:border-bt-primary/50"
          >
            <option value="">Seleccionar…</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="gemini">Google Gemini</option>
            <option value="deepseek">DeepSeek</option>
            <option value="opencode-zen">OpenCode Zen</option>
            <option value="openai-compat">Otro (OpenAI-compatible)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-eyebrow text-bt-dim">Modelo</span>
          <input
            type="text"
            value={aiDraft.model ?? ''}
            onChange={(e) => handleFieldChange('model', e.target.value)}
            placeholder={modelPlaceholder}
            className="h-9 rounded-[8px] border border-bt-border bg-bt-bg px-3 text-[13px] text-bt-text placeholder:text-bt-dim outline-none focus:border-bt-primary/50"
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[11px] uppercase tracking-eyebrow text-bt-dim">API Key</span>
          <input
            type="password"
            value={aiDraft.apiKey ?? ''}
            onChange={(e) => handleFieldChange('apiKey', e.target.value)}
            placeholder={
              aiDraft.provider === 'deepseek'
                ? 'sk-…'
                : aiDraft.provider === 'opencode-zen'
                  ? 'Tu API Key de Zen…'
                  : 'sk-… / AIza… / gsk_…'
            }
            autoComplete="off"
            className="h-9 rounded-[8px] border border-bt-border bg-bt-bg px-3 text-[13px] text-bt-text placeholder:text-bt-dim outline-none focus:border-bt-primary/50"
          />
        </label>

        {['openai-compat', 'deepseek', 'opencode-zen'].includes(aiDraft.provider ?? '') && (
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11px] uppercase tracking-eyebrow text-bt-dim">
              Base URL {aiDraft.provider !== 'openai-compat' && '(Opcional)'}
            </span>
            <input
              type="url"
              value={aiDraft.baseUrl ?? ''}
              onChange={(e) => handleFieldChange('baseUrl', e.target.value)}
              placeholder={baseUrlPlaceholder}
              className="h-9 rounded-[8px] border border-bt-border bg-bt-bg px-3 text-[13px] text-bt-text placeholder:text-bt-dim outline-none focus:border-bt-primary/50"
            />
          </label>
        )}
      </div>

      <button
        type="button"
        onClick={saveAiConfig}
        disabled={aiSaving || !aiDraft.provider}
        className="mt-4 inline-flex h-9 items-center gap-2 rounded-[8px] bg-bt-primary px-5 text-[13px] font-medium text-white transition-colors hover:bg-bt-primary/90 disabled:opacity-40"
      >
        {aiSaved ? (
          <>
            <Icon name="check" size={14} />
            Guardado
          </>
        ) : (
          'Guardar'
        )}
      </button>
    </section>
  )
}
