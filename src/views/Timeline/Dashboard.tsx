import { useMemo, useState } from 'react'
import type { MessageEntity } from '@shared/domain/message.entity'
import type { DbStats, MessageSource } from '@shared/types'
import { Icon } from '@/lib/icons'

// Format helper for bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

interface DashboardProps {
  totalMessagesCount: number
  messages: MessageEntity[]
  dbStats: DbStats | null
  dateRange: 'all' | 'today' | '7days' | 'month'
  setDateRange: (r: 'all' | 'today' | '7days' | 'month') => void
  messageSource: 'all' | MessageSource
  setMessageSource: (s: 'all' | MessageSource) => void
  direction: 'all' | 'sent' | 'received'
  setDirection: (d: 'all' | 'sent' | 'received') => void
}

export function Dashboard({
  totalMessagesCount,
  messages,
  dbStats,
  dateRange,
  setDateRange,
  messageSource,
  setMessageSource,
  direction,
  setDirection
}: DashboardProps) {
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)
  const [aiReport, setAiReport] = useState<string | null>(null)

  // Calculations for stats
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

    // Hourly distribution for active hours chart (4 buckets: Madrugada 0-6, Mañana 6-12, Tarde 12-18, Noche 18-24)
    const hoursBuckets = [0, 0, 0, 0]

    messages.forEach((m) => {
      if (m.timestamp >= startOfToday) {
        messagesToday++
      }

      // Media kind count
      if (m.kind === 'text') textCount++
      else if (m.kind === 'audio') audioCount++
      else if (m.kind === 'image') imageCount++
      else if (m.kind === 'video') videoCount++
      else if (m.kind === 'document') docCount++
      else otherCount++

      // Hourly count
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

  // Mock functions for premium placeholders

  const handleGenerateReport = () => {
    setIsGeneratingReport(true)
    setAiReport(null)
    setTimeout(() => {
      setIsGeneratingReport(false)
      const randomReports = [
        "💡 **Resumen de Patrones**: Has registrado principalmente reflexiones personales sobre desarrollo de producto y experiencia de usuario. Tu mayor pico de actividad es por la tarde (12:00 - 18:00). Las palabras clave más recurrentes son *producto*, *usuario*, y *diseño*. Te recomendamos repasar los audios de notas de voz, que contienen ideas clave aún no transcritas.",
        "💡 **Resumen de Patrones**: Tus mensajes indican un enfoque constante en la organización de tareas semanales y notas de estudio. Utilizas el chat de WhatsApp como un bloc de notas rápido, mayormente por la noche (18:00 - 00:00). Hay 3 enlaces guardados esta semana que podrían beneficiarse de un análisis semántico en el Chat IA.",
        "💡 **Resumen de Patrones**: La actividad de esta semana muestra un balance equilibrado entre recordatorios rápidos de tareas y notas teóricas más extensas. Has guardado un 20% más de contenido que la semana pasada. La mayoría de las interacciones son en tiempo real durante las mañanas."
      ]
      setAiReport(randomReports[Math.floor(Math.random() * randomReports.length)])
    }, 2000)
  }

  return (
    <div className="flex flex-col gap-6 bg-bt-surf/30 p-6 md:px-14 md:py-8 transition-all duration-300">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Metric Card 1 */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-[14px] border border-bt-border bg-bt-surf p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-bt-primary/30 hover:shadow-bt-nav-active">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-bt-dim">Mensajes Totales</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-bt-primary-faint text-bt-primary transition-transform group-hover:scale-110">
              <Icon name="archive" size={14} />
            </div>
          </div>
          <div className="mt-4">
            <span className="font-display text-2xl font-semibold text-bt-text">
              {(dbStats?.messages ?? totalMessagesCount).toLocaleString()}
            </span>
            <p className="mt-1 text-[11px] text-bt-muted">Base de datos local completa</p>
          </div>
          <div className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-bt-primary to-transparent opacity-50" />
        </div>

        {/* Metric Card 2 */}
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
            <p className="mt-1 text-[11px] text-bt-muted">Registrados en las últimas 24h</p>
          </div>
          <div className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-bt-accent to-transparent opacity-50" />
        </div>

        {/* Metric Card 3 */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-[14px] border border-bt-border bg-bt-surf p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-bt-amber/30 hover:shadow-bt-nav-active">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-bt-dim">Vectores Semánticos</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-bt-amber/10 text-bt-amber transition-transform group-hover:scale-110">
              <Icon name="tag" size={14} strokeWidth={2} />
            </div>
          </div>
          <div className="mt-4">
            <span className="font-display text-2xl font-semibold text-bt-text">
              {(dbStats?.embeddings ?? 0).toLocaleString()}
            </span>
            <p className="mt-1 text-[11px] text-bt-muted">Indexados para búsqueda IA</p>
          </div>
          <div className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-bt-amber to-transparent opacity-50" />
        </div>

        {/* Metric Card 4 */}
        <div className="group relative flex flex-col justify-between overflow-hidden rounded-[14px] border border-bt-border bg-bt-surf p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white/10 hover:shadow-bt-nav-active">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-bt-dim">Tamaño de BD</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-bt-muted transition-transform group-hover:scale-110">
              <Icon name="file" size={14} />
            </div>
          </div>
          <div className="mt-4">
            <span className="font-display text-2xl font-semibold text-bt-text">
              {dbStats ? formatBytes(dbStats.sizeBytes) : '...' }
            </span>
            <p className="mt-1 text-[11px] text-bt-muted">
              {dbStats?.lastIngestAt 
                ? `Activo: ${new Date(dbStats.lastIngestAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                : 'Espacio de almacenamiento'}
            </p>
          </div>
          <div className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-bt-muted to-transparent opacity-45" />
        </div>
      </div>

      {/* Visual Analytics & Quick Actions Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Column 1: Media Proportions */}
        <div className="flex flex-col rounded-[14px] border border-bt-border bg-bt-surf p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-bt-muted">Distribución de Contenido</h3>
          
          <div className="mt-5 flex h-4.5 w-full overflow-hidden rounded-full bg-bt-bg p-0.5">
            {stats.mediaDist.text.pct > 0 && (
              <div 
                className="h-full rounded-l-full bg-bt-primary transition-all duration-300"
                style={{ width: `${stats.mediaDist.text.pct}%` }}
                title={`Textos: ${stats.mediaDist.text.count} (${stats.mediaDist.text.pct}%)`}
              />
            )}
            {stats.mediaDist.audio.pct > 0 && (
              <div 
                className="h-full bg-bt-amber transition-all duration-300"
                style={{ width: `${stats.mediaDist.audio.pct}%` }}
                title={`Audios: ${stats.mediaDist.audio.count} (${stats.mediaDist.audio.pct}%)`}
              />
            )}
            {stats.mediaDist.image.pct > 0 && (
              <div 
                className="h-full bg-bt-accent transition-all duration-300"
                style={{ width: `${stats.mediaDist.image.pct}%` }}
                title={`Imágenes: ${stats.mediaDist.image.count} (${stats.mediaDist.image.pct}%)`}
              />
            )}
            {stats.mediaDist.video.pct > 0 && (
              <div 
                className="h-full bg-bt-red transition-all duration-300"
                style={{ width: `${stats.mediaDist.video.pct}%` }}
                title={`Videos: ${stats.mediaDist.video.count} (${stats.mediaDist.video.pct}%)`}
              />
            )}
            {stats.mediaDist.document.pct > 0 && (
              <div 
                className="h-full rounded-r-full bg-bt-text transition-all duration-300"
                style={{ width: `${stats.mediaDist.document.pct}%` }}
                title={`Archivos: ${stats.mediaDist.document.count} (${stats.mediaDist.document.pct}%)`}
              />
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

        {/* Column 2: Hourly Activity */}
        <div className="flex flex-col rounded-[14px] border border-bt-border bg-bt-surf p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-bt-muted">Patrones de Actividad</h3>
          
          <div className="mt-5 flex flex-1 items-end justify-between gap-4 h-[70px]">
            {/* Bucket 1: Madrugada */}
            <div className="flex flex-1 flex-col items-center gap-1">
              <div 
                className="w-full rounded-t-[4px] bg-gradient-to-t from-bt-primary/20 to-bt-primary transition-all duration-500" 
                style={{ 
                  height: `${Math.max(4, Math.round((stats.hoursBuckets[0] / (Math.max(...stats.hoursBuckets) || 1)) * 60))}px` 
                }}
                title={`${stats.hoursBuckets[0]} mensajes`}
              />
              <span className="text-[9px] font-medium text-bt-dim">0-6h</span>
            </div>
            {/* Bucket 2: Mañana */}
            <div className="flex flex-1 flex-col items-center gap-1">
              <div 
                className="w-full rounded-t-[4px] bg-gradient-to-t from-bt-accent/20 to-bt-accent transition-all duration-500" 
                style={{ 
                  height: `${Math.max(4, Math.round((stats.hoursBuckets[1] / (Math.max(...stats.hoursBuckets) || 1)) * 60))}px` 
                }}
                title={`${stats.hoursBuckets[1]} mensajes`}
              />
              <span className="text-[9px] font-medium text-bt-dim">6-12h</span>
            </div>
            {/* Bucket 3: Tarde */}
            <div className="flex flex-1 flex-col items-center gap-1">
              <div 
                className="w-full rounded-t-[4px] bg-gradient-to-t from-bt-amber/20 to-bt-amber transition-all duration-500" 
                style={{ 
                  height: `${Math.max(4, Math.round((stats.hoursBuckets[2] / (Math.max(...stats.hoursBuckets) || 1)) * 60))}px` 
                }}
                title={`${stats.hoursBuckets[2]} mensajes`}
              />
              <span className="text-[9px] font-medium text-bt-dim">12-18h</span>
            </div>
            {/* Bucket 4: Noche */}
            <div className="flex flex-1 flex-col items-center gap-1">
              <div 
                className="w-full rounded-t-[4px] bg-gradient-to-t from-bt-red/20 to-bt-red transition-all duration-500" 
                style={{ 
                  height: `${Math.max(4, Math.round((stats.hoursBuckets[3] / (Math.max(...stats.hoursBuckets) || 1)) * 60))}px` 
                }}
                title={`${stats.hoursBuckets[3]} mensajes`}
              />
              <span className="text-[9px] font-medium text-bt-dim">18-24h</span>
            </div>
          </div>
        </div>

        {/* Column 3: Quick Actions */}
        <div className="flex flex-col rounded-[14px] border border-bt-border bg-bt-surf p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-bt-muted">Funcionalidades Extra</h3>
          
          <div className="mt-4 flex flex-col gap-2.5">
            {/* Action 1: Generar Reporte Semanal */}
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={isGeneratingReport}
              className="flex w-full h-9 items-center justify-between rounded-[8px] border border-bt-primary/20 bg-bt-primary/[0.03] px-3.5 text-left text-xs font-medium text-bt-primary transition-all hover:bg-bt-primary/10 hover:text-white"
            >
              <div className="flex items-center gap-2">
                <Icon name="bolt" size={13} />
                <span>{isGeneratingReport ? 'Generando resumen...' : 'Resumen Inteligente IA'}</span>
              </div>
              <Icon name="chev" size={10} />
            </button>
          </div>
        </div>
      </div>

      {/* AI Report Result Card (Shows only when report is generated) */}
      {aiReport && (
        <div className="relative rounded-[12px] border border-bt-accent/30 bg-bt-accent/[0.03] p-4.5 text-[12.5px] leading-relaxed text-bt-text animate-fade-in">
          <button
            type="button"
            onClick={() => setAiReport(null)}
            className="absolute top-3.5 right-3.5 text-bt-dim hover:text-bt-text"
            title="Cerrar reporte"
          >
            <Icon name="x" size={12} />
          </button>
          <div className="flex gap-2.5">
            <Icon name="bolt" size={16} className="text-bt-accent mt-0.5 shrink-0" />
            <div className="whitespace-pre-wrap">{aiReport}</div>
          </div>
        </div>
      )}

      {/* Filter Control Bar */}
      <div className="mt-1 flex flex-col gap-4 border-t border-bt-border/60 pt-5">
        <div className="flex items-center gap-2">
          <Icon name="settings" size={13} className="text-bt-dim" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-bt-dim">Filtros Avanzados</span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Filter 1: Date Range */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-medium text-bt-dim uppercase">Rango de Fecha</label>
            <div className="flex rounded-lg border border-bt-border bg-bt-bg p-0.5">
              {(['all', 'today', '7days', 'month'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDateRange(r)}
                  className={`rounded-[6px] px-3 py-1 text-[11px] font-medium transition-colors ${
                    dateRange === r
                      ? 'bg-bt-hover text-bt-text shadow-bt-nav-active'
                      : 'text-bt-muted hover:text-bt-text'
                  }`}
                >
                  {r === 'all' ? 'Histórico' : r === 'today' ? 'Hoy' : r === '7days' ? '7 días' : 'Este mes'}
                </button>
              ))}
            </div>
          </div>

          {/* Filter 2: Message Source */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-medium text-bt-dim uppercase">Origen</label>
            <div className="flex rounded-lg border border-bt-border bg-bt-bg p-0.5">
              {(['all', 'realtime', 'offline-sync', 'history-sync', 'export'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setMessageSource(s)}
                  className={`rounded-[6px] px-3 py-1 text-[11px] font-medium transition-colors ${
                    messageSource === s
                      ? 'bg-bt-hover text-bt-text shadow-bt-nav-active'
                      : 'text-bt-muted hover:text-bt-text'
                  }`}
                >
                  {s === 'all' ? 'Todos' : s === 'realtime' ? 'Tiempo Real' : s === 'offline-sync' ? 'Diferida' : s === 'history-sync' ? 'Historial' : 'Importado'}
                </button>
              ))}
            </div>
          </div>

          {/* Filter 3: Direction (Sent vs Received) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-medium text-bt-dim uppercase">Remitente</label>
            <div className="flex rounded-lg border border-bt-border bg-bt-bg p-0.5">
              {(['all', 'sent', 'received'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={`rounded-[6px] px-3 py-1 text-[11px] font-medium transition-colors ${
                    direction === d
                      ? 'bg-bt-hover text-bt-text shadow-bt-nav-active'
                      : 'text-bt-muted hover:text-bt-text'
                  }`}
                >
                  {d === 'all' ? 'Todos' : d === 'sent' ? 'Enviados' : 'Recibidos'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
