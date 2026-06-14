import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AiConfig } from '@shared/types'
import type { DbInstance, MediaMeta } from './db'
import type { ContextService } from './context'
import type { WhatsAppService } from './whatsapp'
import type { WAMessageLike } from './ingest'
import { describeImage } from './vision'
import { isAiConfigured } from './ai-provider'

export interface ImageIngestDeps {
  whatsapp: WhatsAppService
  db: DbInstance
  contextSvc: ContextService | null
  userDataPath: string
  getAiConfig: () => AiConfig | null
}

// Persistent store for received images so they can be viewed later in the app.
export function imagesDir(userDataPath: string): string {
  const dir = join(userDataPath, 'media', 'images')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function extFromMime(mimetype: string | undefined): string {
  switch (mimetype) {
    case 'image/png': return 'png'
    case 'image/webp': return 'webp'
    case 'image/gif': return 'gif'
    default: return 'jpg'
  }
}

/**
 * Downloads an image message, persists it to disk (so it can be viewed),
 * and — if an AI vision model is configured — generates a description that is
 * stored into the message text (+FTS) and fed to the context/embedding pipeline
 * for semantic search. Safe to call again to reprocess an existing message.
 */
export async function processImageMessage(
  deps: ImageIngestDeps,
  raw: WAMessageLike,
  rowId: number,
  mediaMeta: MediaMeta | null,
  timestampMs: number,
  caption: string
): Promise<void> {
  const config = deps.getAiConfig()

  // Preserve the user's original caption as its own field. The message `text`
  // ends up combined (caption + AI description) for search, so this is the only
  // place that records, unambiguously, what the user actually typed.
  if (caption.trim()) deps.db.updateMediaMeta(rowId, { caption })

  // Download + persist the image, independently of whether AI is configured.
  let buffer: Buffer | null = null
  try {
    buffer = await deps.whatsapp.downloadMedia(raw)
    const filePath = join(imagesDir(deps.userDataPath), `${rowId}-${Date.now()}.${extFromMime(mediaMeta?.mimetype)}`)
    writeFileSync(filePath, buffer)
    deps.db.updateMediaMeta(rowId, { imageLocalPath: filePath })
  } catch (err) {
    console.error('[vision] Failed to download/save image:', err)
  }

  if (!isAiConfigured(config) || !buffer) {
    deps.contextSvc?.queue(rowId, 'image', caption, mediaMeta, timestampMs)
    return
  }

  try {
    const description = await describeImage(config, buffer, mediaMeta?.mimetype, caption)

    let text = caption
    if (description) {
      deps.db.updateMediaMeta(rowId, { visionDescription: description, visionError: undefined })
      text = caption ? `${caption}\n${description}` : description
      // Persist the description into the message text (+FTS) so it's searchable
      // by keyword and surfaced to the AI chat, which reads the `text` column.
      deps.db.updateText(rowId, text)
    } else {
      // The model was attempted (AI configured, image downloaded) but produced
      // no usable description — surface this in the UI instead of leaving the
      // user wondering why the image isn't searchable.
      deps.db.updateMediaMeta(rowId, {
        visionError: 'El modelo de visión configurado no pudo describir esta imagen.'
      })
    }

    deps.contextSvc?.queue(rowId, 'image', text, mediaMeta, timestampMs)
  } catch (err) {
    console.error('[vision] Error:', err)
    deps.db.updateMediaMeta(rowId, {
      visionError: 'Ocurrió un error al generar la descripción de la imagen.'
    })
    deps.contextSvc?.queue(rowId, 'image', caption, mediaMeta, timestampMs)
  }
}
