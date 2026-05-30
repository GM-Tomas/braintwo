import { useEffect, useState, useCallback, useRef } from 'react'
import type { OllamaStatus, OllamaModel, OllamaPullProgress, OllamaInstallProgress } from '@shared/types'
import { useDependencies } from '@/core/infrastructure/DependenciesContext'
import { useNavigationGuard } from '@/core/NavigationGuardContext'
import { Icon } from '@/lib/icons'

// ─── Model catalog ────────────────────────────────────────────────────────────

const RECOMMENDED_MODELS = [
  { name: 'qwen3:1.7b',   label: 'Qwen3 Chico',     size: '~1 GB',   ram: '~2 GB',   hint: 'Muy rápido y de buena calidad', recommended: true },
  { name: 'qwen3.5:2b',   label: 'Qwen3.5 Mediano', size: '~2.7 GB', ram: '~3.5 GB', hint: 'Equilibrado, soporte de imágenes, 256K contexto' },
  { name: 'qwen3.5:4b',   label: 'Qwen3.5',         size: '~3.4 GB', ram: '~5 GB',   hint: 'El más capaz de los tres, soporte de imágenes' }
]

const MORE_MODELS = [
  { name: 'qwen3.5:0.8b',     label: 'Qwen3.5 Chico',   size: '~1 GB',   ram: '~1.5 GB', hint: 'Más liviano, soporte de imágenes, 256K contexto' },
  { name: 'qwen3:4b',         label: 'Qwen3 Mediano',   size: '~2.5 GB', ram: '~4 GB',   hint: 'Generación anterior, buena calidad' },
  { name: 'gemma3:1b',        label: 'Gemma 3 Mini',    size: '~0.8 GB', ram: '~1.5 GB', hint: 'De Google, el más liviano del catálogo' },
  { name: 'phi4-mini:3.8b',   label: 'Phi-4 Mini',      size: '~2.5 GB', ram: '~4 GB',   hint: 'De Microsoft, excelente en matemáticas y razonamiento' },
  { name: 'llama3.2:3b',      label: 'LLaMA 3.2',       size: '~2 GB',   ram: '~3 GB',   hint: 'De Meta, versátil, 128K contexto' },
  { name: 'deepseek-r1:1.5b', label: 'DeepSeek R1',     size: '~1.1 GB', ram: '~2 GB',   hint: 'Especialista en razonamiento paso a paso' },
  { name: 'deepseek-r1:7b',   label: 'DeepSeek R1 7B',  size: '~4.7 GB', ram: '~6 GB',   hint: 'Razonamiento avanzado, 128K contexto' },
  { name: 'gemma4:e2b',       label: 'Gemma 4',         size: '~7.2 GB', ram: '~9 GB',   hint: 'Lo más nuevo de Google, soporte de imágenes' },
  { name: 'mistral:7b',       label: 'Mistral',         size: '~4.4 GB', ram: '~6 GB',   hint: 'Modelo clásico y confiable' },
  { name: 'qwen2.5-coder:7b', label: 'Qwen 2.5 Coder', size: '~4.7 GB', ram: '~6 GB',   hint: 'Especialista en código' }
]

const ALL_CATALOG = [...RECOMMENDED_MODELS, ...MORE_MODELS]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes) return ''
  const gb = bytes / 1024 ** 3
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(bytes / 1024 ** 2).toFixed(0)} MB`
}

// ─── Progress bars ────────────────────────────────────────────────────────────

function InstallProgressBar({ realPercent, message }: { realPercent: number; message?: string }) {
  const [displayPct, setDisplayPct] = useState(0)
  useEffect(() => {
    if (realPercent <= 0) { setDisplayPct(0); return }
    const id = setInterval(() => {
      setDisplayPct(prev => Math.min(prev + Math.max(0.4, (realPercent - prev) * 0.09), realPercent))
    }, 30)
    return () => clearInterval(id)
  }, [realPercent])

  return (
    <div className="rounded-[8px] border border-bt-border bg-bt-bg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-bt-text font-medium">{message ?? 'Instalando Ollama…'}</span>
        <span className="text-bt-muted tabular-nums">{Math.round(displayPct)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-bt-border overflow-hidden">
        <div className="h-full bg-gradient-to-r from-bt-primary to-bt-accent rounded-full"
          style={{ width: `${displayPct}%`, transition: 'width 80ms linear' }} />
      </div>
      <p className="text-[11px] text-bt-muted">Podés seguir usando la app mientras tanto.</p>
    </div>
  )
}

function PullProgressBar({ progress, onCancel }: { progress: OllamaPullProgress; onCancel: () => void }) {
  const pct = progress.total && progress.total > 0
    ? Math.round(((progress.completed ?? 0) / progress.total) * 100)
    : null
  const friendlyName = ALL_CATALOG.find(m => m.name === progress.model)?.label ?? progress.model

  return (
    <div className="rounded-[8px] border border-bt-border bg-bt-bg p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-bt-text font-medium">Descargando {friendlyName}</span>
        <button type="button" onClick={onCancel} className="text-[12px] text-bt-muted hover:text-bt-red transition-colors">
          Cancelar
        </button>
      </div>
      <div className="h-2 w-full rounded-full bg-bt-border overflow-hidden">
        <div className="h-full bg-gradient-to-r from-bt-primary to-bt-accent rounded-full"
          style={{ width: pct !== null ? `${pct}%` : '5%', transition: 'width 400ms ease' }} />
      </div>
      <div className="flex items-center justify-between text-[11px] text-bt-muted">
        <span>{progress.status}</span>
        {progress.total && progress.total > 0 && (
          <span className="tabular-nums">
            {formatBytes(progress.completed ?? 0)} / {formatBytes(progress.total)}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Model dropdown ───────────────────────────────────────────────────────────

interface ModelDropdownProps {
  installedModels: OllamaModel[]
  activeModel: string
  isPulling: boolean
  onSelect: (name: string) => void
  onDownload: (name: string) => void
  onDelete: (name: string) => void
}

function ModelDropdown({ installedModels, activeModel, isPulling, onSelect, onDownload, onDelete }: ModelDropdownProps) {
  const [open, setOpen] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isInstalled = (name: string) => installedModels.some(m => m.name === name)
  // A model only counts as "selected" if it's actually installed.
  const activeIsInstalled = !!activeModel && isInstalled(activeModel)
  const activeInfo = activeIsInstalled ? ALL_CATALOG.find(m => m.name === activeModel) : undefined
  const extraInstalled = installedModels.filter(m => !ALL_CATALOG.some(c => c.name === m.name))

  function ModelRow({ name, label, size, ram, hint, installed, isActive, recommended }: {
    name: string; label: string; size: string; ram?: string; hint: string; installed: boolean; isActive: boolean; recommended?: boolean
  }) {
    const subline = [
      ram ? `necesita ${ram} de RAM` : '',
      hint
    ].filter(Boolean).join(' · ')
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2.5 transition-colors ${
          isActive ? 'bg-bt-primary/8' : isPulling ? 'opacity-60' : 'hover:bg-bt-hover cursor-pointer'
        }`}
        onClick={() => {
          if (isPulling) return
          if (!installed) { onDownload(name); setOpen(false) }
          else if (!isActive) { onSelect(name); setOpen(false) }
        }}
      >
        <span className="w-4 shrink-0 flex items-center justify-center self-start mt-0.5">
          {isActive && <Icon name="check" size={12} className="text-bt-primary" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[13px] font-medium ${isActive ? 'text-bt-primary' : 'text-bt-text'}`}>{label}</span>
            <span className="text-[11px] text-bt-dim">{size} en disco</span>
            {recommended && !isActive && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-bt-primary/15 text-bt-primary uppercase tracking-wide">
                Recomendado
              </span>
            )}
          </div>
          <p className="text-[10px] font-mono text-bt-dim/70 leading-tight mt-0.5">{name}</p>
          {subline && <p className="text-[11px] text-bt-dim leading-tight">{subline}</p>}
        </div>
        {!installed ? (
          <button type="button" disabled={isPulling}
            onClick={(e) => { e.stopPropagation(); onDownload(name); setOpen(false) }}
            className="p-1.5 rounded-[6px] text-bt-primary hover:bg-bt-primary/10 transition-colors disabled:opacity-40">
            <Icon name="download" size={13} />
          </button>
        ) : !isActive ? (
          <button type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(name) }}
            className="p-1.5 rounded-[6px] text-bt-muted hover:text-bt-red hover:bg-bt-red/10 transition-colors">
            <Icon name="trash" size={13} />
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)} disabled={isPulling}
        className="w-full flex items-center justify-between h-10 px-3 rounded-[8px] border border-bt-border bg-bt-bg text-[13px] hover:border-bt-primary/50 transition-colors disabled:opacity-50">
        <span className={activeIsInstalled ? 'text-bt-text' : 'text-bt-muted'}>
          {activeInfo
            ? `${activeInfo.label} · ${activeInfo.size}`
            : activeIsInstalled ? activeModel : 'Seleccionar modelo'}
        </span>
        <Icon name="chev" size={14} className={`text-bt-muted transition-transform ${open ? 'rotate-90' : '-rotate-90'}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-[8px] border border-bt-border bg-bt-surf shadow-lg overflow-hidden max-h-72 overflow-y-auto">
          <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-bt-dim font-medium">Recomendados</div>
          {RECOMMENDED_MODELS.map(m => (
            <ModelRow key={m.name} {...m} installed={isInstalled(m.name)} isActive={activeModel === m.name && isInstalled(m.name)} />
          ))}

          <button type="button"
            className="w-full flex items-center justify-between px-3 py-2 text-[12px] text-bt-muted hover:bg-bt-hover transition-colors border-t border-bt-border/50 mt-1"
            onClick={(e) => { e.stopPropagation(); setShowMore(v => !v) }}>
            <span>Más modelos</span>
            <Icon name="chev" size={12} className={`transition-transform ${showMore ? 'rotate-90' : ''}`} />
          </button>

          {showMore && (
            <>
              <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wider text-bt-dim font-medium bg-bt-bg/40">Avanzados</div>
              {MORE_MODELS.map(m => (
                <ModelRow key={m.name} {...m} installed={isInstalled(m.name)} isActive={activeModel === m.name && isInstalled(m.name)} />
              ))}
            </>
          )}

          {extraInstalled.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-bt-dim font-medium border-t border-bt-border/50 mt-1">Otros instalados</div>
              {extraInstalled.map(m => (
                <ModelRow key={m.name} name={m.name} label={m.name} size={formatBytes(m.size)} hint=""
                  installed={true} isActive={activeModel === m.name} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Mode selector cards ──────────────────────────────────────────────────────

function ModeCard({
  selected, onClick, title, description
}: {
  selected: boolean; onClick: () => void; title: string; description: string
}) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-[8px] border transition-all ${
        selected
          ? 'border-bt-primary/50 bg-bt-primary/6 shadow-[0_0_0_1px] shadow-bt-primary/20'
          : 'border-bt-border bg-bt-bg hover:border-bt-border/80 hover:bg-bt-hover/40'
      }`}>
      <div className="flex items-center gap-2.5">
        <span className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
          selected ? 'border-bt-primary' : 'border-bt-muted/50'
        }`}>
          {selected && <span className="h-1.5 w-1.5 rounded-full bg-bt-primary" />}
        </span>
        <span className={`text-[13px] font-medium ${selected ? 'text-bt-text' : 'text-bt-muted'}`}>{title}</span>
      </div>
      <p className="text-[11px] text-bt-dim mt-1 ml-6">{description}</p>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface LocalAiSectionProps {
  activeModel: string
  serverUrl: string
  autoStart: boolean
  ollamaMode: 'ollama' | 'manual'
  onModelChange: (model: string) => void
  onServerUrlChange: (url: string) => void
  onAutoStartChange: (v: boolean) => void
  onModeChange: (mode: 'ollama' | 'manual') => void
}

export function LocalAiSection({
  activeModel,
  serverUrl,
  autoStart,
  ollamaMode,
  onModelChange,
  onServerUrlChange,
  onAutoStartChange,
  onModeChange
}: LocalAiSectionProps) {
  const { ollamaService } = useDependencies()

  const DEFAULT_URL = 'http://localhost:11434'
  const [status, setStatus] = useState<OllamaStatus>('not-installed')
  const [installedModels, setInstalledModels] = useState<OllamaModel[]>([])
  const [pullProgress, setPullProgress] = useState<OllamaPullProgress | null>(null)
  const [installProgress, setInstallProgress] = useState<OllamaInstallProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [urlInput, setUrlInput] = useState(serverUrl || DEFAULT_URL)

  const { registerGuard } = useNavigationGuard()

  // Block leaving the screen if the server is up but no usable model is selected yet.
  const hasValidModel = !!activeModel && installedModels.some(m => m.name === activeModel)
  useEffect(() => {
    const incomplete = status === 'running' && !hasValidModel
    if (!incomplete) { registerGuard(null); return }
    registerGuard(() => window.confirm(
      'Todavía no elegiste un modelo para la IA local. Si salís ahora, el chat no va a funcionar hasta que selecciones uno.\n\n¿Querés salir igual?'
    ))
    return () => registerGuard(null)
  }, [status, hasValidModel, registerGuard])

  const loadStatus = useCallback(async (url?: string) => {
    try {
      const s = await ollamaService.getStatus(url ?? urlInput)
      setStatus(s)
      if (s === 'running') {
        const models = await ollamaService.listModels()
        setInstalledModels(models)
      } else {
        setInstalledModels([])
      }
    } catch {
      setStatus('error')
    }
  }, [ollamaService, urlInput])

  useEffect(() => {
    void loadStatus()
    const unsubStatus = ollamaService.onStatusChange((s) => {
      setStatus(s)
      if (s === 'running') void ollamaService.listModels().then(setInstalledModels).catch(() => {})
      if (s !== 'running') setInstalledModels([])
    })
    const unsubPull = ollamaService.onPullProgress((p) => {
      setPullProgress(p.done ? null : p)
      if (p.done) void ollamaService.listModels().then(setInstalledModels).catch(() => {})
    })
    const unsubInstall = ollamaService.onInstallProgress((p) => {
      setInstallProgress(p.stage === 'done' ? null : p)
      if (p.stage === 'done') void loadStatus()
      if (p.stage === 'error') { setError(p.message ?? 'Error al instalar'); setInstallProgress(null) }
    })
    return () => { unsubStatus(); unsubPull(); unsubInstall() }
  }, [ollamaService, loadStatus])

  const handleInstall = async () => {
    setError(null)
    setInstallProgress({ stage: 'downloading', percent: 0, message: 'Iniciando descarga…' })
    try {
      await ollamaService.install()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al instalar Ollama')
      setInstallProgress(null)
    }
  }

  const handleStartServer = async () => {
    setError(null)
    setIsStarting(true)
    try {
      await ollamaService.startServer()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar el servidor')
      setStatus('error')
    } finally {
      setIsStarting(false)
    }
  }

  const handleStopServer = async () => {
    setError(null)
    try { await ollamaService.stopServer() } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al detener el servidor')
    }
  }

  const handlePull = async (modelName: string) => {
    setError(null)
    setPullProgress({ model: modelName, status: 'Iniciando…', done: false })
    try {
      await ollamaService.pullModel(modelName)
      onModelChange(modelName)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err.message : 'Error al descargar el modelo')
      }
      setPullProgress(null)
    }
  }

  const handleDeleteModel = async (modelName: string) => {
    if (!confirm(`¿Eliminar "${modelName}"? Esto libera espacio en disco.`)) return
    try {
      await ollamaService.deleteModel(modelName)
      const models = await ollamaService.listModels()
      setInstalledModels(models)
      if (activeModel === modelName) onModelChange('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar el modelo')
    }
  }

  const handleManualConnect = () => {
    onServerUrlChange(urlInput)
    void loadStatus(urlInput)
  }

  const handleModeSwitch = (mode: 'ollama' | 'manual') => {
    setError(null)
    onModeChange(mode)  // parent resets URL atomically along with mode
    if (mode === 'ollama') {
      setUrlInput(DEFAULT_URL)
      void loadStatus(DEFAULT_URL)
    }
  }

  const dotColor =
    status === 'running'     ? 'bg-bt-green' :
    status === 'starting' || status === 'installing' ? 'bg-yellow-400 animate-pulse' :
    status === 'error'       ? 'bg-bt-red' :
    'bg-bt-muted/60'

  const ollamaNotInstalled = status === 'not-installed'
  const serverDown = status === 'not-running' || status === 'error' || (status === 'not-installed' && ollamaMode === 'manual')

  return (
    <div className="flex flex-col gap-4">

      {/* Mode selector */}
      <div className="flex flex-col gap-2">
        <ModeCard
          selected={ollamaMode === 'ollama'}
          onClick={() => handleModeSwitch('ollama')}
          title="Configuración asistida"
          description="Te guiamos en la instalación de Ollama y la descarga de modelos, sin necesidad de conocimientos técnicos."
        />
        <ModeCard
          selected={ollamaMode === 'manual'}
          onClick={() => handleModeSwitch('manual')}
          title="Configuración manual"
          description="Ya tenés LM Studio, llama.cpp u otro servidor de IA corriendo localmente."
        />
      </div>

      {error && (
        <div className="rounded-[8px] border border-bt-red/30 bg-bt-red/5 px-3 py-2 text-[12px] text-bt-red">
          {error}
        </div>
      )}

      {/* ── OLLAMA MODE ─────────────────────────────────────────── */}
      {ollamaMode === 'ollama' && (
        <>
          {/* Status + server control on a single line */}
          {status !== 'not-installed' && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
                <span className="text-[13px] text-bt-muted">
                  {status === 'running' ? 'Conectado' :
                   status === 'not-running' ? 'Servidor detenido' :
                   status === 'installing' ? 'Instalando…' :
                   status === 'starting' ? 'Iniciando…' : 'Error de conexión'}
                </span>
              </div>

              {(status === 'not-running' || status === 'error') && (
                <button type="button" onClick={() => void handleStartServer()} disabled={isStarting}
                  className="flex items-center gap-2 text-[13px] px-3 py-1.5 rounded-[8px] bg-bt-primary/10 border border-bt-primary/30 text-bt-primary hover:bg-bt-primary/20 transition-colors disabled:opacity-50 shrink-0">
                  <Icon name={isStarting ? 'loader' : 'play'} size={12} className={isStarting ? 'animate-spin' : ''} />
                  {isStarting ? 'Iniciando…' : 'Iniciar servidor'}
                </button>
              )}

              {status === 'running' && (
                <button type="button" onClick={() => void handleStopServer()}
                  className="flex items-center gap-2 text-[13px] px-3 py-1.5 rounded-[8px] border border-bt-border text-bt-muted hover:bg-bt-hover transition-colors shrink-0">
                  <Icon name="square" size={12} />
                  Detener servidor
                </button>
              )}
            </div>
          )}

          {/* Install flow */}
          {installProgress && (
            <InstallProgressBar realPercent={installProgress.percent ?? 0} message={installProgress.message} />
          )}

          {ollamaNotInstalled && !installProgress && (
            <div className="rounded-[8px] border border-bt-border bg-bt-bg p-4 flex flex-col gap-3">
              <p className="text-[12px] text-bt-muted leading-relaxed">
                Ollama corre modelos de IA en tu computadora, sin enviar datos a internet y sin costo por uso.
              </p>
              <button type="button" onClick={() => void handleInstall()}
                className="self-start flex items-center gap-2 text-[13px] px-4 py-2 rounded-[8px] bg-bt-primary text-white hover:bg-bt-primary/90 transition-colors">
                <Icon name="download" size={14} />
                Instalar Ollama
              </button>
            </div>
          )}

          {/* Pull progress */}
          {pullProgress && (
            <PullProgressBar progress={pullProgress} onCancel={() => void ollamaService.cancelPull()} />
          )}

          {/* Model selector */}
          {status === 'running' && !pullProgress && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-eyebrow text-bt-dim">Modelo</span>
              <ModelDropdown
                installedModels={installedModels}
                activeModel={activeModel}
                isPulling={false}
                onSelect={onModelChange}
                onDownload={(name) => void handlePull(name)}
                onDelete={(name) => void handleDeleteModel(name)}
              />
            </div>
          )}

          {/* Auto-start toggle */}
          {!ollamaNotInstalled && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={autoStart} onChange={(e) => onAutoStartChange(e.target.checked)} className="accent-bt-primary" />
              <span className="text-[12px] text-bt-muted">Iniciar Ollama automáticamente con BrainTwo</span>
            </label>
          )}
        </>
      )}

      {/* ── MANUAL MODE ─────────────────────────────────────────── */}
      {ollamaMode === 'manual' && (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2 items-end">
              <label className="flex flex-col gap-1 flex-1">
                <span className="text-[11px] uppercase tracking-eyebrow text-bt-dim">URL del servidor</span>
                <input type="url" value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualConnect()}
                  placeholder="http://localhost:1234"
                  className="h-9 rounded-[8px] border border-bt-border bg-bt-bg px-3 text-[13px] text-bt-text placeholder:text-bt-dim outline-none focus:border-bt-primary/50" />
              </label>
              <button type="button" onClick={handleManualConnect}
                className="h-9 px-3 rounded-[8px] bg-bt-primary text-white text-[13px] hover:bg-bt-primary/90 transition-colors shrink-0">
                Conectar
              </button>
            </div>
            <p className="text-[11px] text-bt-dim">
              LM Studio: <span className="font-mono">http://localhost:1234</span> ·
              llama.cpp: <span className="font-mono">http://localhost:8080</span>
            </p>
          </div>

          {/* Status + model selector when connected */}
          {status === 'running' && (
            <>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-bt-green" />
                <span className="text-[13px] text-bt-muted">Conectado</span>
              </div>

              {pullProgress && (
                <PullProgressBar progress={pullProgress} onCancel={() => void ollamaService.cancelPull()} />
              )}

              {!pullProgress && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] uppercase tracking-eyebrow text-bt-dim">Modelo</span>
                  <ModelDropdown
                    installedModels={installedModels}
                    activeModel={activeModel}
                    isPulling={false}
                    onSelect={onModelChange}
                    onDownload={(name) => void handlePull(name)}
                    onDelete={(name) => void handleDeleteModel(name)}
                  />
                </div>
              )}
            </>
          )}

          {serverDown && urlInput && urlInput !== DEFAULT_URL && (
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
              <span className="text-[13px] text-bt-muted">Sin conexión — verificá que el servidor esté corriendo</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
