import { useEffect, useState } from 'react'
import { useDependencies } from '@/core/infrastructure/DependenciesContext'

export function GroqSection() {
  const { aiService } = useDependencies()
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void aiService.getConfig().then((cfg) => {
      if (cfg?.groq?.apiKey) setApiKey(cfg.groq.apiKey)
    })
  }, [aiService])

  const handleSave = () => {
    void aiService.getConfig().then((cfg) => {
      void aiService.setConfig({
        ...cfg,
        groq: { apiKey }
      })
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <section className="col-span-full rounded-[8px] border border-bt-border bg-bt-surf p-5">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold text-bt-text">Transcripción de Audios (Groq)</h2>
        <p className="mt-1 text-[12px] text-bt-muted">
          Los audios de WhatsApp se transcriben automáticamente con Whisper de Groq.
          La clave se guarda localmente.
        </p>
      </div>
      <div className="flex items-end gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[11px] uppercase tracking-eyebrow text-bt-dim">Groq API Key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="gsk_…"
            autoComplete="off"
            className="h-9 rounded-[8px] border border-bt-border bg-bt-bg px-3 text-[13px] text-bt-text placeholder:text-bt-dim outline-none focus:border-bt-primary/50"
          />
        </label>
        <button
          type="button"
          onClick={handleSave}
          className="flex h-9 items-center rounded-[8px] bg-bt-primary px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          {saved ? 'Guardado' : 'Guardar'}
        </button>
      </div>
    </section>
  )
}
