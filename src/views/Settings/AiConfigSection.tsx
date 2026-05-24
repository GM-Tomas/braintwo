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
      if (cfg) setAiDraft(cfg)
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

  const modelPlaceholder =
    aiDraft.provider === 'anthropic'
      ? 'claude-haiku-4-5'
      : aiDraft.provider === 'gemini'
        ? 'gemini-2.0-flash'
        : 'gpt-4o-mini'

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
            onChange={(e) =>
              setAiDraft((d) => ({ ...d, provider: e.target.value as AiProvider }))
            }
            className="h-9 rounded-[8px] border border-bt-border bg-bt-bg px-3 text-[13px] text-bt-text outline-none focus:border-bt-primary/50"
          >
            <option value="">Seleccionar…</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai-compat">OpenAI / Groq / Ollama</option>
            <option value="gemini">Google Gemini</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-eyebrow text-bt-dim">Modelo</span>
          <input
            type="text"
            value={aiDraft.model ?? ''}
            onChange={(e) => setAiDraft((d) => ({ ...d, model: e.target.value }))}
            placeholder={modelPlaceholder}
            className="h-9 rounded-[8px] border border-bt-border bg-bt-bg px-3 text-[13px] text-bt-text placeholder:text-bt-dim outline-none focus:border-bt-primary/50"
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[11px] uppercase tracking-eyebrow text-bt-dim">API Key</span>
          <input
            type="password"
            value={aiDraft.apiKey ?? ''}
            onChange={(e) => setAiDraft((d) => ({ ...d, apiKey: e.target.value }))}
            placeholder="sk-… / AIza… / gsk_…"
            autoComplete="off"
            className="h-9 rounded-[8px] border border-bt-border bg-bt-bg px-3 text-[13px] text-bt-text placeholder:text-bt-dim outline-none focus:border-bt-primary/50"
          />
        </label>

        {aiDraft.provider === 'openai-compat' && (
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11px] uppercase tracking-eyebrow text-bt-dim">
              Base URL
            </span>
            <input
              type="url"
              value={aiDraft.baseUrl ?? ''}
              onChange={(e) => setAiDraft((d) => ({ ...d, baseUrl: e.target.value }))}
              placeholder="http://localhost:11434/v1"
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
