import { useCallback, useEffect, useState } from 'react'
import type { AiConfig, AiProvider, DbStats, UserSettings } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '@/lib/icons'

export function Settings({ onLogout }: { onLogout: () => void }) {
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [stats, setStats] = useState<DbStats | null>(null)
  const [aiDraft, setAiDraft] = useState<Partial<AiConfig>>({})
  const [aiSaving, setAiSaving] = useState(false)
  const [aiSaved, setAiSaved] = useState(false)

  useEffect(() => {
    void window.braintwo.app.getSettings().then(setSettings)
    void window.braintwo.app.getDbStats().then(setStats)
    void window.braintwo.ai.getConfig().then((cfg) => {
      if (cfg) setAiDraft(cfg)
    })
  }, [])

  const saveAiConfig = useCallback(() => {
    if (!aiDraft.provider) return
    setAiSaving(true)
    void window.braintwo.ai.setConfig(aiDraft).then(() => {
      setAiSaving(false)
      setAiSaved(true)
      setTimeout(() => setAiSaved(false), 2000)
    })
  }, [aiDraft])

  const lastIngest = stats?.lastIngestAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(stats.lastIngestAt)
      )
    : 'Sin datos'

  const modelPlaceholder =
    aiDraft.provider === 'anthropic'
      ? 'claude-haiku-4-5'
      : aiDraft.provider === 'gemini'
        ? 'gemini-2.0-flash'
        : 'gpt-4o-mini'

  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-fade-in">
      <PageHeader
        eyebrow="Settings"
        title="Ajustes"
        subtitle="Estado local, base de datos y controles de sincronizacion."
      />

      <div className="flex-1 overflow-y-auto px-14 py-8">
        <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
          <section className="rounded-[8px] border border-bt-border bg-bt-surf p-5">
            <h2 className="text-[15px] font-semibold text-bt-text">Sesion</h2>
            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-bt-red/30 px-4 text-[13px] font-medium text-bt-text transition-colors hover:bg-bt-red/10"
              >
                <Icon name="logout" size={16} />
                Desvincular WhatsApp
              </button>
              <button
                type="button"
                onClick={() => void window.braintwo.export.importTxt()}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-bt-border px-4 text-[13px] font-medium text-bt-muted transition-colors hover:bg-bt-hover hover:text-bt-text"
              >
                <Icon name="file" size={16} />
                Reimportar export
              </button>
            </div>
          </section>

          <section className="rounded-[8px] border border-bt-border bg-bt-surf p-5">
            <h2 className="text-[15px] font-semibold text-bt-text">Arranque</h2>
            <label className="mt-4 flex items-center justify-between gap-4 text-sm text-bt-muted">
              <span>Iniciar BrainTwo con Windows</span>
              <input
                type="checkbox"
                checked={settings?.autostart ?? false}
                onChange={(e) => {
                  const autostart = e.target.checked
                  setSettings((prev) => (prev ? { ...prev, autostart } : prev))
                  void window.braintwo.app.setSettings({ autostart }).then(setSettings)
                }}
                className="h-4 w-4 accent-[#1a8fe3]"
              />
            </label>
          </section>

          <section className="rounded-[8px] border border-bt-border bg-bt-surf p-5">
            <h2 className="text-[15px] font-semibold text-bt-text">Base local</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Stat label="Mensajes" value={(stats?.messages ?? 0).toLocaleString()} />
              <Stat label="Embeddings" value={(stats?.embeddings ?? 0).toLocaleString()} />
              <Stat label="Tamano" value={formatBytes(stats?.sizeBytes ?? 0)} />
              <Stat label="Ultima ingesta" value={lastIngest} />
            </dl>
          </section>

          <section className="rounded-[8px] border border-bt-border bg-bt-surf p-5">
            <h2 className="text-[15px] font-semibold text-bt-text">Carpeta local</h2>
            <p className="mt-3 break-all text-[12.5px] leading-relaxed text-bt-muted">
              {settings?.userDataPath ?? 'Cargando...'}
            </p>
            <button
              type="button"
              onClick={() => void window.braintwo.app.openUserDataFolder()}
              className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-[8px] border border-bt-border px-4 text-[13px] font-medium text-bt-muted transition-colors hover:bg-bt-hover hover:text-bt-text"
            >
              <Icon name="folder" size={16} />
              Abrir carpeta
            </button>
          </section>

          {/* AI Provider config — full width */}
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
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-eyebrow text-bt-dim">{label}</dt>
      <dd className="mt-1 text-[13px] text-bt-text">{value}</dd>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
