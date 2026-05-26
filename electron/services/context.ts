import type { AiConfig } from '@shared/types'
import type { ContextableMessage, DbInstance, MediaMeta, MessageKind } from './db'
import type { EmbeddingService } from './embeddings'
import { callProvider } from './ai-provider'

export interface ContextService {
  queue(id: number, kind: MessageKind, text: string, media: MediaMeta | null, timestamp: number): void
  backfill(): Promise<void>
}

interface ContextServiceDeps {
  db: DbInstance
  embeddings: EmbeddingService
  getAiConfig: () => AiConfig | null
  onError?: (msg: string) => void
}

const SYSTEM_PROMPT =
  'Sos un asistente que indexa mensajes de WhatsApp para búsqueda futura.\n' +
  'Tu tarea es generar UNA sola oración (máximo 180 caracteres) que describa de qué trata el mensaje, ' +
  'en qué situación fue enviado y qué fechas/días menciona (si menciona alguno).\n' +
  'REGLA CRÍTICA PARA FECHAS:\n' +
  '- Usa la "Fecha de envío" y el "día de la semana" provistos para resolver expresiones relativas temporales (por ejemplo: "hoy", "mañana", "el jueves", "este finde", "el lunes que viene", "ayer").\n' +
  '- Traduce esas referencias relativas a fechas absolutas específicas (día y mes, por ejemplo: "28 de mayo") o rangos claros, y escríbelas explícitamente en tu respuesta.\n' +
  '- Si el mensaje no contiene expresiones de tiempo, no inventes fechas.\n' +
  'Asegúrate de incluir palabras clave relacionadas y sinónimos comunes ' +
  '(por ejemplo, si habla de un doctor, incluye "médico"; si es un turno, incluye "cita"; si es fútbol, "deporte", etc.) ' +
  'para facilitar su búsqueda posterior tanto por palabras clave como semántica.\n' +
  'Sé específico. Responde SOLO con la oración descriptiva, sin comillas ni explicaciones.'

function buildUserPrompt(kind: MessageKind, text: string, media: MediaMeta | null, timestamp: number): string {
  const date = new Date(timestamp)
  const dateStr = date.toISOString().split('T')[0]! // YYYY-MM-DD
  const weekdayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  const weekday = weekdayNames[date.getDay()]!

  const lines: string[] = [
    `Tipo: ${kind}`,
    `Fecha de envío: ${dateStr} (día de la semana: ${weekday})`
  ]
  if (media?.ptt) lines.push('Es una nota de voz (push-to-talk)')
  if (typeof media?.durationSec === 'number') lines.push(`Duración: ${Math.round(media.durationSec)}s`)
  if (media?.fileName) lines.push(`Archivo: ${media.fileName}`)
  if (media?.mimetype) lines.push(`Formato: ${media.mimetype}`)
  lines.push(text ? `Texto: ${text}` : '(sin texto)')
  return lines.join('\n')
}

export function createContextService(deps: ContextServiceDeps): ContextService {
  type QueueItem = { id: number; kind: MessageKind; text: string; media: MediaMeta | null; timestamp: number }
  const pending: QueueItem[] = []
  const queued = new Set<number>()
  let running = false

  async function processQueue(): Promise<void> {
    if (running) return
    running = true
    try {
      while (pending.length > 0) {
        const config = deps.getAiConfig()
        if (!config?.apiKey) break

        const item = pending.shift()!
        queued.delete(item.id)

        try {
          const raw = await callProvider({
            config,
            systemPrompt: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: buildUserPrompt(item.kind, item.text, item.media, item.timestamp) }]
          })
          const note = raw.trim().slice(0, 500)
          if (!note) continue

          deps.db.updateContextNote(item.id, note)

          // Re-embed with enriched text so future searches benefit from context
          deps.db.deleteEmbedding(item.id)
          const embedText = `${note}\n${item.text}`.trim()
          if (embedText) {
            const vec = await deps.embeddings.embed(embedText, 'passage')
            deps.db.insertEmbedding(item.id, vec)
          }
        } catch (err) {
          deps.onError?.(
            `context: id=${item.id} — ${err instanceof Error ? err.message : String(err)}`
          )
        }

        // Respect Gemini free tier (10 RPM) and other provider rate limits.
        // 6 s between calls = ~10 RPM max, leaving headroom for the AI Chat.
        await new Promise<void>((r) => setTimeout(r, 6000))
      }
    } finally {
      running = false
    }
  }

  function enqueue(item: QueueItem): void {
    if (queued.has(item.id)) return
    queued.add(item.id)
    pending.push(item)
  }

  return {
    queue(id, kind, text, media, timestamp) {
      enqueue({ id, kind, text, media, timestamp })
      void processQueue()
    },

    async backfill() {
      const config = deps.getAiConfig()
      if (!config?.apiKey) return

      // Limit per-session backfill to avoid excessive API calls on large archives
      const rows: ContextableMessage[] = deps.db.listMessagesWithoutContext(300)
      for (const row of rows) {
        let media: MediaMeta | null = null
        if (row.media_meta) {
          try { media = JSON.parse(row.media_meta) as MediaMeta } catch { /* ignore */ }
        }
        enqueue({ id: row.id, kind: row.kind, text: row.text, media, timestamp: row.timestamp })
      }
      await processQueue()
    }
  }
}
