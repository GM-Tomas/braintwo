import type { Logger } from 'pino'
import type { DbInstance, MediaMeta, MessageKind, MessageSource } from './db'

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
    imageMessage?: ImageLike | null
    videoMessage?: VideoLike | null
    documentMessage?: DocumentLike | null
    documentWithCaptionMessage?: {
      message?: { documentMessage?: DocumentLike | null } | null
    } | null
    audioMessage?: AudioLike | null
    stickerMessage?: StickerLike | null
    ephemeralMessage?: { message?: WAMessageLike['message'] } | null
    viewOnceMessage?: { message?: WAMessageLike['message'] } | null
    viewOnceMessageV2?: { message?: WAMessageLike['message'] } | null
  } | null
}

interface ImageLike {
  caption?: string | null
  mimetype?: string | null
  fileLength?: number | { low: number } | null
}

interface VideoLike {
  caption?: string | null
  mimetype?: string | null
  fileLength?: number | { low: number } | null
  seconds?: number | null
}

interface AudioLike {
  mimetype?: string | null
  fileLength?: number | { low: number } | null
  seconds?: number | null
  ptt?: boolean | null
}

interface DocumentLike {
  caption?: string | null
  fileName?: string | null
  mimetype?: string | null
  fileLength?: number | { low: number } | null
}

interface StickerLike {
  mimetype?: string | null
  fileLength?: number | { low: number } | null
}

export interface RecentMessage {
  id: number
  wa_msg_id: string
  timestamp: number
  text: string
  source: MessageSource
  kind: MessageKind
  media: MediaMeta | null
  fromMe: boolean
  createdAt?: number
  contextNote?: string | null
  ignored?: boolean
}

export type IngestSkipReason = 'no-id' | 'empty' | 'duplicate'

export interface IngestResult {
  inserted: boolean
  rowId: number | null
  skipped?: IngestSkipReason
  kind?: MessageKind
}

export interface IngestPipeline {
  ingest: (msg: WAMessageLike, source: MessageSource) => IngestResult
  recent: (limit: number) => RecentMessage[]
  since: (timestampMs: number, limit: number) => RecentMessage[]
  findReminderCandidates: (sinceMs: number, limit: number) => RecentMessage[]
  getById: (id: number) => RecentMessage | null
  count: () => number
  toggleIgnored: (id: number) => boolean
  getIgnoredIds: () => number[]
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

function unwrapEnvelope(
  m: WAMessageLike['message']
): WAMessageLike['message'] | null {
  if (!m) return null
  if (m.ephemeralMessage?.message) return unwrapEnvelope(m.ephemeralMessage.message)
  if (m.viewOnceMessage?.message) return unwrapEnvelope(m.viewOnceMessage.message)
  if (m.viewOnceMessageV2?.message) return unwrapEnvelope(m.viewOnceMessageV2.message)
  return m
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

export function extractKind(msg: WAMessageLike): MessageKind {
  const inner = unwrapEnvelope(msg.message)
  if (!inner) return 'other'
  if (inner.audioMessage) return 'audio'
  if (inner.imageMessage) return 'image'
  if (inner.videoMessage) return 'video'
  if (inner.stickerMessage) return 'sticker'
  if (inner.documentMessage || inner.documentWithCaptionMessage) return 'document'
  if (inner.conversation || inner.extendedTextMessage?.text) return 'text'
  return 'other'
}

function num(v: number | { low: number } | null | undefined): number | undefined {
  if (typeof v === 'number') return v
  if (v && typeof v === 'object' && typeof v.low === 'number') return v.low
  return undefined
}

export function extractMediaMeta(msg: WAMessageLike): MediaMeta | null {
  const inner = unwrapEnvelope(msg.message)
  if (!inner) return null
  if (inner.audioMessage) {
    return cleanMeta({
      durationSec: inner.audioMessage.seconds ?? undefined,
      mimetype: inner.audioMessage.mimetype ?? undefined,
      fileLengthBytes: num(inner.audioMessage.fileLength),
      ptt: inner.audioMessage.ptt ?? undefined
    })
  }
  if (inner.imageMessage) {
    return cleanMeta({
      mimetype: inner.imageMessage.mimetype ?? undefined,
      fileLengthBytes: num(inner.imageMessage.fileLength)
    })
  }
  if (inner.videoMessage) {
    return cleanMeta({
      durationSec: inner.videoMessage.seconds ?? undefined,
      mimetype: inner.videoMessage.mimetype ?? undefined,
      fileLengthBytes: num(inner.videoMessage.fileLength)
    })
  }
  const doc =
    inner.documentMessage ??
    inner.documentWithCaptionMessage?.message?.documentMessage ??
    null
  if (doc) {
    return cleanMeta({
      fileName: doc.fileName ?? undefined,
      mimetype: doc.mimetype ?? undefined,
      fileLengthBytes: num(doc.fileLength)
    })
  }
  if (inner.stickerMessage) {
    return cleanMeta({
      mimetype: inner.stickerMessage.mimetype ?? undefined,
      fileLengthBytes: num(inner.stickerMessage.fileLength)
    })
  }
  return null
}

function cleanMeta(m: MediaMeta): MediaMeta | null {
  const entries = Object.entries(m).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  )
  return entries.length ? Object.fromEntries(entries) : null
}

export function createIngestPipeline(
  db: DbInstance,
  logger?: Logger
): IngestPipeline {
  const recentStmt = db.raw.prepare<[number], RecentMessageRow>(
    `SELECT id, wa_msg_id, timestamp, text, source, kind, media_meta, from_me, created_at, context_note, ignored
       FROM messages
       ORDER BY timestamp DESC
       LIMIT ?`
  )

  const getByIdStmt = db.raw.prepare<[number], RecentMessageRow>(
    `SELECT id, wa_msg_id, timestamp, text, source, kind, media_meta, from_me, created_at, context_note, ignored
       FROM messages
       WHERE id = ?`
  )

  const sinceStmt = db.raw.prepare<[number, number], RecentMessageRow>(
    `SELECT id, wa_msg_id, timestamp, text, source, kind, media_meta, from_me, created_at, context_note, ignored
       FROM messages
       WHERE timestamp >= ?
       ORDER BY timestamp ASC
       LIMIT ?`
  )

  // Messages tagged by the context pipeline as reminders/events, used to surface
  // upcoming dates mentioned in older messages (e.g. "turno dentro de 15 días").
  const reminderCandidatesStmt = db.raw.prepare<[number, number], RecentMessageRow>(
    `SELECT id, wa_msg_id, timestamp, text, source, kind, media_meta, from_me, created_at, context_note, ignored
       FROM messages
       WHERE timestamp >= ?
         AND ignored = 0
         AND (context_note LIKE '%#recordatorio%' OR context_note LIKE '%#evento%')
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
      const kind = extractKind(msg)
      const media = extractMediaMeta(msg)

      // Drop only when there's NO content at all — no text, no media, unknown kind.
      // Audio/image/video/document/sticker without caption are still kept.
      if (!text && kind === 'other' && !media) {
        logger?.debug(
          { wa_msg_id: id, source },
          'ingest skipped: empty (no text, no media, unknown kind)'
        )
        return { inserted: false, rowId: null, skipped: 'empty' }
      }

      const timestamp = extractTimestampMs(msg)
      const result = db.insertMessage({
        wa_msg_id: id,
        timestamp,
        text,
        source,
        kind,
        media,
        from_me: msg.key?.fromMe === true,
        raw_json: JSON.stringify(msg)
      })

      if (!result.inserted) {
        logger?.debug(
          { wa_msg_id: id, source, kind },
          'message already ingested (dedup hit)'
        )
        return { inserted: false, rowId: null, skipped: 'duplicate', kind }
      }

      logger?.info(
        {
          wa_msg_id: id,
          source,
          kind,
          timestamp,
          text_preview: text.slice(0, 80),
          has_media: !!media
        },
        'message ingested'
      )
      return { inserted: true, rowId: result.rowId, kind }
    },

    recent(limit) {
      if (limit <= 0) return []
      return recentStmt.all(limit).map(rowToRecent)
    },

    since(timestampMs, limit) {
      if (limit <= 0) return []
      return sinceStmt.all(timestampMs, limit).map(rowToRecent)
    },

    findReminderCandidates(sinceMs, limit) {
      if (limit <= 0) return []
      return reminderCandidatesStmt.all(sinceMs, limit).map(rowToRecent)
    },

    getById(id: number) {
      const row = getByIdStmt.get(id)
      return row ? rowToRecent(row) : null
    },

    count() {
      return db.countMessages()
    },

    toggleIgnored(id: number) {
      return db.toggleIgnored(id)
    },

    getIgnoredIds() {
      return db.getIgnoredIds()
    }
  }
}

interface RecentMessageRow {
  id: number
  wa_msg_id: string
  timestamp: number
  text: string
  source: MessageSource
  kind: MessageKind | null
  media_meta: string | null
  from_me: number | null
  created_at: number | null
  context_note: string | null
  ignored: number | null
}

function rowToRecent(row: RecentMessageRow): RecentMessage {
  let media: MediaMeta | null = null
  if (row.media_meta) {
    try {
      media = JSON.parse(row.media_meta) as MediaMeta
    } catch {
      media = null
    }
  }
  return {
    id: row.id,
    wa_msg_id: row.wa_msg_id,
    timestamp: row.timestamp,
    text: row.text,
    source: row.source,
    kind: row.kind ?? 'text',
    media,
    fromMe: row.from_me === 1,
    createdAt: row.created_at != null ? row.created_at * 1000 : undefined,
    contextNote: row.context_note ?? null,
    ignored: row.ignored === 1
  }
}
