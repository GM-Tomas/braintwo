import type { Logger } from 'pino'
import type { DbInstance, MessageSource } from './db'

// Minimal subset of Baileys' WAMessage shape that we actually consume. Kept
// local so this module — and its tests — do not need to load Baileys.
export interface WAMessageLike {
  key?: {
    id?: string | null
    remoteJid?: string | null
    fromMe?: boolean | null
  } | null
  messageTimestamp?:
    | number
    | { low: number; high?: number; unsigned?: boolean }
    | null
  message?: {
    conversation?: string | null
    extendedTextMessage?: { text?: string | null } | null
    imageMessage?: { caption?: string | null } | null
    videoMessage?: { caption?: string | null } | null
    documentMessage?: { caption?: string | null } | null
    documentWithCaptionMessage?: {
      message?: { documentMessage?: { caption?: string | null } | null } | null
    } | null
    ephemeralMessage?: {
      message?: WAMessageLike['message']
    } | null
    viewOnceMessage?: {
      message?: WAMessageLike['message']
    } | null
  } | null
}

export interface RecentMessage {
  id: number
  wa_msg_id: string
  timestamp: number
  text: string
  source: MessageSource
}

export type IngestSkipReason = 'no-id' | 'no-text' | 'duplicate'

export interface IngestResult {
  inserted: boolean
  rowId: number | null
  skipped?: IngestSkipReason
}

export interface IngestPipeline {
  ingest: (msg: WAMessageLike, source: MessageSource) => IngestResult
  recent: (limit: number) => RecentMessage[]
  count: () => number
}

// Long-style timestamps from protobuf can arrive as `{ low, high, unsigned }`.
// Strip to a JS number, accept seconds-since-epoch, multiply to ms.
export function extractTimestampMs(msg: WAMessageLike): number {
  const ts = msg.messageTimestamp
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    return ts * 1000
  }
  if (ts && typeof ts === 'object' && typeof ts.low === 'number') {
    return ts.low * 1000
  }
  return Date.now()
}

// Walks the message envelope (incl. ephemeral / view-once wrappers) and pulls
// the first text body or media caption. Returns '' if none.
export function extractText(msg: WAMessageLike): string {
  const inner = unwrapEnvelope(msg.message)
  if (!inner) return ''
  const text =
    inner.conversation ||
    inner.extendedTextMessage?.text ||
    inner.imageMessage?.caption ||
    inner.videoMessage?.caption ||
    inner.documentMessage?.caption ||
    inner.documentWithCaptionMessage?.message?.documentMessage?.caption ||
    ''
  return text.trim()
}

function unwrapEnvelope(
  m: WAMessageLike['message']
): WAMessageLike['message'] | null {
  if (!m) return null
  if (m.ephemeralMessage?.message) return m.ephemeralMessage.message
  if (m.viewOnceMessage?.message) return m.viewOnceMessage.message
  return m
}

export function createIngestPipeline(
  db: DbInstance,
  logger?: Logger
): IngestPipeline {
  const recentStmt = db.raw.prepare<[number], RecentMessage>(
    `SELECT id, wa_msg_id, timestamp, text, source
       FROM messages
       ORDER BY timestamp DESC
       LIMIT ?`
  )

  return {
    ingest(msg, source) {
      const id = msg.key?.id
      if (!id) {
        logger?.debug({ source }, 'ingest skipped: no wa_msg_id')
        return { inserted: false, rowId: null, skipped: 'no-id' }
      }

      const text = extractText(msg)
      if (!text) {
        logger?.debug(
          { wa_msg_id: id, source },
          'ingest skipped: no text or caption'
        )
        return { inserted: false, rowId: null, skipped: 'no-text' }
      }

      const timestamp = extractTimestampMs(msg)
      const result = db.insertMessage({
        wa_msg_id: id,
        timestamp,
        text,
        source,
        raw_json: JSON.stringify(msg)
      })

      if (!result.inserted) {
        logger?.debug(
          { wa_msg_id: id, source },
          'message already ingested (dedup hit)'
        )
        return { inserted: false, rowId: null, skipped: 'duplicate' }
      }

      logger?.info(
        {
          wa_msg_id: id,
          source,
          timestamp,
          text_preview: text.slice(0, 80)
        },
        'message ingested'
      )
      return { inserted: true, rowId: result.rowId }
    },

    recent(limit) {
      if (limit <= 0) return []
      return recentStmt.all(limit)
    },

    count() {
      return db.countMessages()
    }
  }
}
