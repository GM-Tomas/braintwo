import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DbStats } from '@shared/types'
import { PageHeader } from '../../components/PageHeader'
import { useDependencies } from '@/core/infrastructure/DependenciesContext'
import { MessageEntity } from '@shared/domain/message.entity'
import { Icon } from '@/lib/icons'

// Renders the **bold** segments produced by the AI report as <strong>, since
// the report is shown as plain text otherwise.
function renderReportLine(line: string, key: number) {
  const parts = line.split(/\*\*(.+?)\*\*/g)
  return (
    <p key={key}>
      {parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}
    </p>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const LOAD_COUNT = 200

// Keeps the generated AI report in memory across navigation (DashboardView
// unmounts when the user switches views), without persisting it to the DB.
let cachedAiReport: string | null = null
let cachedReportError: string | null = null

export function DashboardView() {
  const { messageRepository } = useDependencies()
  const [count, setCount] = useState(0)
  const [messages, setMessages] = useState<MessageEntity[]>([])
  const [dbStats, setDbStats] = useState<DbStats | null>(null)

  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [aiReport, setAiReportState] = useState<string | null>(cachedAiReport)
  const [reportError, setReportErrorState] = useState<string | null>(cachedReportError)

  const setAiReport = (report: string | null) => {
    cachedAiReport = report
    setAiReportState(report)
  }

  const setReportError = (error: string | null) => {
    cachedReportError = error
    setReportErrorState(error)
  }

  const loadDbStats = useCallback(() => {
    window.braintwo.app.getDbStats().then(setDbStats).catch(console.error)
  }, [])

  useEffect(() => {
    let mounted = true
    void messageRepository.getMessageCount().then((c) => {
      if (mounted) setCount(c)
    })
    void messageRepository.getRecentMessages(LOAD_COUNT).then((rows) => {
      if (mounted) setMessages(rows)
    })
    loadDbStats()
    return () => { mounted = false }
  }, [messageRepository, loadDbStats])

  const stats = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

    let messagesToday = 0
    let textCount = 0
    let audioCount = 0
    let imageCount = 0
    let videoCount = 0
    let docCount = 0
    let otherCount = 0
    const hoursBuckets = [0, 0, 0, 0]

    messages.forEach((m) => {
      if (m.timestamp >= startOfToday) messagesToday++
      if (m.kind === 'text') textCount++
      else if (m.kind === 'audio') audioCount++
      else if (m.kind === 'image') imageCount++
      else if (m.kind === 'video') videoCount++
      else if (m.kind === 'document') docCount++
      else otherCount++

      const date = new Date(m.timestamp)
      const hour = date.getHours()
      if (hour >= 0 && hour < 6) hoursBuckets[0]++
      else if (hour >= 6 && hour < 12) hoursBuckets[1]++
      else if (hour >= 12 && hour < 18) hoursBuckets[2]++
      else hoursBuckets[3]++
    })

    const totalInList = messages.length || 1

    return {
      messagesToday,
      mediaDist: {
        text: { count: textCount, pct: Math.round((textCount / totalInList) * 100) },
        audio: { count: audioCount, pct: Math.round((audioCount / totalInList) * 100) },
        image: { count: imageCount, pct: Math.round((imageCount / totalInList) * 100) },
        video: { count: videoCount, pct: Math.round((videoCount / totalInList) * 100) },
        document: { count: docCount, pct: Math.round((docCount / totalInList) * 100) },
        other: { count: otherCount, pct: Math.round((otherCount / totalInList) * 100) }
      },
      hoursBuckets
    }
  }, [messages])

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true)
    setAiReport(null)
    setReportError(null)
    try {
      const result = await window.braintwo.app.generateDashboardReport()
      if (result.ok) {
        setAiReport(result.report)
      } else if (result.reason === 'not-configured') {
        setReportError('Configurá un proveedor de IA en Ajustes para generar un resumen.')
      } else if (result.reason === 'no-messages') {
        setReportError('No hay mensajes de los últimos 3 días para resumir.')
      } else {
        setReportError('No se pudo generar el resumen. Intentá de nuevo más tarde.')
      }
    } catch {
      setReportError('No se pudo generar el resumen. Intentá de nuevo más tarde.')
    } finally {
      setIsGeneratingReport(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-fade-in">
      <PageHeader
        eyebrow="Analiticas"
        title="Dashboard"
        subtitle="Estadisticas, distribucion y patrones de tu actividad."
        action={
          <span className="text-sm text-bt-muted">
            {count.toLocaleString()} {count === 1 ? 'mensaje' : 'mensajes'}
          </span>
        }
      />
      <div className="flex-1 overflow-y-auto py-8">
        <div className="flex flex-col gap-6 px-6 md:px-14">
          {/* AI Report */}
          <div className="flex flex-col rounded-[14px] border border-bt-border bg-bt-surf p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-bt-muted">Resumen Inteligente</h3>
            <p className="mt-1 text-[11px] text-bt-dim">
              Temas, fechas y recordatorios de tu actividad de los últimos 3 días.
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void handleGenerateReport()}
                disabled={isGeneratingReport}
                className="flex w-full sm:w-auto h-9 items-center justify-between gap-2 rounded-[8px] border border-bt-primary/20 bg-bt-primary/[0.03] px-3.5 text-left text-xs font-medium text-bt-primary transition-all hover:bg-bt-primary/10 hover:text-white disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Icon name="bolt" size={13} />
                  <span>{isGeneratingReport ? 'Generando resumen...' : 'Generar Resumen IA'}</span>
                </div>
                <Icon name="chev" size={10} />
              </button>

              {isGeneratingReport && (
                <div className="animate-pulse rounded-[10px] border border-bt-border bg-bt-bg p-4">
                  <div className="flex gap-2">
                    <div className="h-4 w-4 shrink-0 rounded bg-bt-dim/30" />
                    <div className="flex flex-1 flex-col gap-2">
                      <div className="h-3 w-full rounded bg-bt-dim/20" />
                      <div className="h-3 w-5/6 rounded bg-bt-dim/20" />
                      <div className="h-3 w-4/6 rounded bg-bt-dim/20" />
                    </div>
                  </div>
                </div>
              )}

              {reportError && !isGeneratingReport && (
                <div className="relative rounded-[12px] border border-bt-border bg-bt-bg p-4 text-[12.5px] leading-relaxed text-bt-muted animate-fade-in">
                  <div className="flex gap-2.5">
                    <Icon name="bolt" size={16} className="text-bt-dim mt-0.5 shrink-0" />
                    <div>{reportError}</div>
                  </div>
                </div>
              )}

              {aiReport && !isGeneratingReport && (
                <div className="relative rounded-[12px] border border-bt-accent/30 bg-bt-accent/[0.03] p-4 text-[12.5px] leading-relaxed text-bt-text animate-fade-in">
                  <div className="absolute top-3 right-3 flex gap-1">
                    <button
                      type="button"
                      onClick={() => void handleGenerateReport()}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-bt-dim hover:text-bt-text hover:bg-bt-hover transition-colors"
                      title="Regenerar resumen"
                    >
                      <Icon name="refresh" size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiReport(null)}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-bt-dim hover:text-bt-text hover:bg-bt-hover transition-colors"
                      title="Cerrar resumen"
                    >
                      <Icon name="x" size={11} />
                    </button>
                  </div>
                  <div className="flex gap-2.5 pr-14">
                    <Icon name="bolt" size={16} className="text-bt-accent mt-0.5 shrink-0" />
                    <div className="flex flex-col gap-1.5">
                      {aiReport
                        .split('\n')
                        .filter((line) => line.trim().length > 0)
                        .map((line, i) => renderReportLine(line, i))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-[14px] border border-bt-border bg-bt-surf p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-bt-primary/30 hover:shadow-bt-nav-active">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-bt-dim">Mensajes Totales</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-bt-primary-faint text-bt-primary transition-transform group-hover:scale-110">
                  <Icon name="archive" size={14} />
                </div>
              </div>
              <div className="mt-4">
                <span className="font-display text-2xl font-semibold text-bt-text">
                  {(dbStats?.messages ?? count).toLocaleString()}
                </span>
                <p className="mt-1 text-[11px] text-bt-muted">Base de datos local completa</p>
              </div>
              <div className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-bt-primary to-transparent opacity-50" />
            </div>

            <div className="group relative flex flex-col justify-between overflow-hidden rounded-[14px] border border-bt-border bg-bt-surf p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-bt-accent/30 hover:shadow-bt-nav-active">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-bt-dim">Sincronizados Hoy</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-bt-accent-faint text-bt-accent transition-transform group-hover:scale-110">
                  <Icon name="bolt" size={14} />
                </div>
              </div>
              <div className="mt-4">
                <span className="font-display text-2xl font-semibold text-bt-text">
                  {stats.messagesToday}
                </span>
                <p className="mt-1 text-[11px] text-bt-muted">Registrados en las ultimas 24h</p>
              </div>
              <div className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-bt-accent to-transparent opacity-50" />
            </div>

            <div className="group relative flex flex-col justify-between overflow-hidden rounded-[14px] border border-bt-border bg-bt-surf p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-bt-amber/30 hover:shadow-bt-nav-active">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-bt-dim">Vectores Semanticos</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-bt-amber/10 text-bt-amber transition-transform group-hover:scale-110">
                  <Icon name="tag" size={14} strokeWidth={2} />
                </div>
              </div>
              <div className="mt-4">
                <span className="font-display text-2xl font-semibold text-bt-text">
                  {(dbStats?.embeddings ?? 0).toLocaleString()}
                </span>
                <p className="mt-1 text-[11px] text-bt-muted">Indexados para busqueda IA</p>
              </div>
              <div className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-bt-amber to-transparent opacity-50" />
            </div>

            <div className="group relative flex flex-col justify-between overflow-hidden rounded-[14px] border border-bt-border bg-bt-surf p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white/10 hover:shadow-bt-nav-active">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-bt-dim">Tamano de BD</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-bt-muted transition-transform group-hover:scale-110">
                  <Icon name="file" size={14} />
                </div>
              </div>
              <div className="mt-4">
                <span className="font-display text-2xl font-semibold text-bt-text">
                  {dbStats ? formatBytes(dbStats.sizeBytes) : '...'}
                </span>
                <p className="mt-1 text-[11px] text-bt-muted">
                  {dbStats?.lastIngestAt
                    ? `Activo: ${new Date(dbStats.lastIngestAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Espacio de almacenamiento'}
                </p>
              </div>
              <div className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-bt-muted to-transparent opacity-45" />
            </div>
          </div>

          {/* Visual Analytics Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Distribution */}
            <div className="flex flex-col rounded-[14px] border border-bt-border bg-bt-surf p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-bt-muted">Distribucion de Contenido</h3>

              <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full bg-bt-border/20">
                {stats.mediaDist.text.pct > 0 && (
                  <div className="h-full bg-bt-primary transition-all duration-300" style={{ width: `${stats.mediaDist.text.pct}%` }} title={`Textos: ${stats.mediaDist.text.count} (${stats.mediaDist.text.pct}%)`} />
                )}
                {stats.mediaDist.audio.pct > 0 && (
                  <div className="h-full bg-bt-amber transition-all duration-300" style={{ width: `${stats.mediaDist.audio.pct}%` }} title={`Audios: ${stats.mediaDist.audio.count} (${stats.mediaDist.audio.pct}%)`} />
                )}
                {stats.mediaDist.image.pct > 0 && (
                  <div className="h-full bg-bt-accent transition-all duration-300" style={{ width: `${stats.mediaDist.image.pct}%` }} title={`Imagenes: ${stats.mediaDist.image.count} (${stats.mediaDist.image.pct}%)`} />
                )}
                {stats.mediaDist.video.pct > 0 && (
                  <div className="h-full bg-bt-red transition-all duration-300" style={{ width: `${stats.mediaDist.video.pct}%` }} title={`Videos: ${stats.mediaDist.video.count} (${stats.mediaDist.video.pct}%)`} />
                )}
                {stats.mediaDist.document.pct > 0 && (
                  <div className="h-full bg-bt-text transition-all duration-300" style={{ width: `${stats.mediaDist.document.pct}%` }} title={`Archivos: ${stats.mediaDist.document.count} (${stats.mediaDist.document.pct}%)`} />
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-bt-muted">
                  <span className="h-2 w-2 rounded-full bg-bt-primary" />
                  <span className="truncate">Textos ({stats.mediaDist.text.pct}%)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-bt-muted">
                  <span className="h-2 w-2 rounded-full bg-bt-amber" />
                  <span className="truncate">Audios ({stats.mediaDist.audio.pct}%)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-bt-muted">
                  <span className="h-2 w-2 rounded-full bg-bt-accent" />
                  <span className="truncate">Fotos ({stats.mediaDist.image.pct}%)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-bt-muted">
                  <span className="h-2 w-2 rounded-full bg-bt-red" />
                  <span className="truncate">Videos ({stats.mediaDist.video.pct}%)</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-bt-muted">
                  <span className="h-2 w-2 rounded-full bg-bt-text" />
                  <span className="truncate">Docs ({stats.mediaDist.document.pct}%)</span>
                </div>
              </div>
            </div>

            {/* Activity */}
            <div className="flex flex-col rounded-[14px] border border-bt-border bg-bt-surf p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-bt-muted">Patrones de Actividad</h3>

              <div className="mt-5 flex flex-1 items-end justify-between gap-3" style={{ height: '80px' }}>
                {[
                  { label: '0-6h', count: stats.hoursBuckets[0], desc: 'Madrugada' },
                  { label: '6-12h', count: stats.hoursBuckets[1], desc: 'Manana' },
                  { label: '12-18h', count: stats.hoursBuckets[2], desc: 'Tarde' },
                  { label: '18-24h', count: stats.hoursBuckets[3], desc: 'Noche' }
                ].map((bucket) => {
                  const maxVal = Math.max(...stats.hoursBuckets) || 1
                  const opacity = Math.max(0.3, bucket.count / maxVal)
                  return (
                    <div key={bucket.label} className="group relative flex flex-1 flex-col items-center gap-1.5">
                      {bucket.count > 0 && (
                        <span className="text-[10px] font-semibold text-bt-dim">{bucket.count}</span>
                      )}
                      <div
                        className="w-full rounded-t-[3px] bg-bt-dim transition-all duration-500"
                        style={{
                          height: `${Math.max(8, Math.round((bucket.count / maxVal) * 50))}px`,
                          opacity
                        }}
                      />
                      <span className="text-[8px] font-medium text-bt-dim uppercase tracking-wider">{bucket.label}</span>
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center gap-1 z-10">
                        <div className="rounded-md border border-bt-border bg-bt-surf px-2.5 py-1.5 text-[11px] text-bt-text shadow-lg whitespace-nowrap">
                          <span className="font-medium">{bucket.desc}</span>
                          <span className="text-bt-muted ml-1.5">· {bucket.count} mensajes</span>
                        </div>
                        <div className="h-1.5 w-1.5 rotate-45 rounded-[1px] border-b border-r border-bt-border bg-bt-surf -mt-1" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
