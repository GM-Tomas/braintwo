import type { AiConfig } from '@shared/types'
import type { ContextableMessage, DbInstance, MediaMeta, MessageKind } from './db'
import type { EmbeddingService } from './embeddings'
import { callProvider } from './ai-provider'

export interface ContextService {
  queue(id: number, kind: MessageKind, text: string, media: MediaMeta | null): void
  backfill(): Promise<void>
}

interface ContextServiceDeps {
  db: DbInstance
  embeddings: EmbeddingService
  getAiConfig: () => AiConfig | null
  onError?: (msg: string) => void
}

const SYSTEM_PROMPT =
  'Sos un asistente que indexa mensajes de WhatsApp para búsqueda futura. ' +
  'Tu tarea es generar UNA sola oración (máximo 150 caracteres) que describa de qué trata el mensaje ' +
  'y en qué situación fue enviado. Asegúrate de incluir palabras clave relacionadas y sinónimos comunes ' +
  '(por ejemplo, si habla de un doctor, incluye "médico"; si es un turno, incluye "cita"; si es fútbol, "deporte", etc.) ' +
  'para facilitar su búsqueda posterior tanto por palabras clave como semántica. ' +
  'Sé específico. Responde SOLO con la oración, sin comillas ni explicaciones.'

function buildUserPrompt(kind: MessageKind, text: string, media: MediaMeta | null): string {
  const lines: string[] = [`Tipo: ${kind}`]
  if (media?.ptt) lines.push('Es una nota de voz (push-to-talk)')
  if (typeof media?.durationSec === 'number') lines.push(`Duración: ${Math.round(media.durationSec)}s`)
  if (media?.fileName) lines.push(`Archivo: ${media.fileName}`)
  if (media?.mimetype) lines.push(`Formato: ${media.mimetype}`)
  lines.push(text ? `Texto: ${text}` : '(sin texto)')
  return lines.join('\n')
}

export function createContextService(deps: ContextServiceDeps): ContextService {
  type QueueItem = { id: number; kind: MessageKind; text: string; media: MediaMeta | null }
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
            messages: [{ role: 'user', content: buildUserPrompt(item.kind, item.text, item.media) }]
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
    queue(id, kind, text, media) {
      enqueue({ id, kind, text, media })
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
        enqueue({ id: row.id, kind: row.kind, text: row.text, media })
      }
      await processQueue()
    }
  }
}
