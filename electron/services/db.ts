import Database, { type Database as DatabaseType } from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'
import { statSync } from 'node:fs'

export const VEC_DIM = 384

export type MessageSource = 'export' | 'history-sync' | 'realtime' | 'offline-sync'

export type MessageKind =
  | 'text'
  | 'audio'
  | 'image'
  | 'video'
  | 'document'
  | 'sticker'
  | 'other'

export interface MediaMeta {
  durationSec?: number
  fileName?: string
  fileLengthBytes?: number
  mimetype?: string
  transcript?: string
  ptt?: boolean
}

export interface NewMessage {
  wa_msg_id: string
  timestamp: number
  text: string
  source: MessageSource
  kind?: MessageKind
  media?: MediaMeta | null
  from_me?: boolean
  raw_json?: string | null
}

export interface InsertResult {
  inserted: boolean
  rowId: number | null
}

export interface SimilarResult {
  id: number
  wa_msg_id: string
  timestamp: number
  text: string
  source: MessageSource
  kind: MessageKind
  distance: number
}

export interface EmbeddableMessage {
  id: number
  text: string
  context_note: string | null
}

export interface KeywordResult {
  id: number
  wa_msg_id: string
  text: string
  timestamp: number
  source: MessageSource
  kind: MessageKind
}

export interface ContextableMessage {
  id: number
  text: string
  kind: MessageKind
  media_meta: string | null
}

export interface MemoryResult {
  id: number
  content: string
  createdAt: number
  distance?: number
}

export interface DbStats {
  messages: number
  embeddings: number
  sizeBytes: number
  lastIngestAt: number | null
}

export interface DbInstance {
  raw: DatabaseType
  insertMessage: (msg: NewMessage) => InsertResult
  insertEmbedding: (msgId: number, vec: Float32Array) => void
  clearEmbeddings: () => void
  searchSimilar: (queryVec: Float32Array, k: number) => SimilarResult[]
  searchKeyword: (query: string, limit: number) => KeywordResult[]
  listMessagesWithoutEmbeddings: (limit: number) => EmbeddableMessage[]
  listMessagesWithoutContext: (limit: number) => ContextableMessage[]
  updateContextNote: (id: number, note: string) => void
  deleteEmbedding: (msgId: number) => void
  // AI memory
  insertMemory: (content: string) => number
  insertMemoryEmbedding: (memoryId: number, vec: Float32Array) => void
  searchMemorySimilar: (queryVec: Float32Array, k: number) => MemoryResult[]
  searchMemoryKeyword: (query: string, limit: number) => MemoryResult[]
  listMemories: (limit: number) => MemoryResult[]
  listUnembeddedMemories: (limit: number) => { id: number; content: string }[]
  // Stats / misc
  stats: (filePath?: string) => DbStats
  countMessages: () => number
  countEmbeddings: () => number
  hasEmbedding: (msgId: number) => boolean
  getSurroundingMessages: (msgId: number, limit: number) => { id: number; text: string; timestamp: number }[]
  close: () => void
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS messages (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     wa_msg_id   TEXT UNIQUE NOT NULL,
     timestamp   INTEGER NOT NULL,
     text        TEXT NOT NULL,
     source      TEXT NOT NULL,
     raw_json    TEXT,
     created_at  INTEGER DEFAULT (unixepoch())
   )`,
  `CREATE INDEX IF NOT EXISTS idx_msg_ts ON messages(timestamp)`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS message_embeddings USING vec0(
     msg_id      INTEGER PRIMARY KEY,
     embedding   FLOAT[${VEC_DIM}]
   )`,
  // Standalone FTS5 table (owns its own copy of text — simpler than external content).
  `CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
     text,
     tokenize='unicode61'
   )`,
  // Keep FTS index in sync when messages are inserted.
  `CREATE TRIGGER IF NOT EXISTS messages_fts_ai
     AFTER INSERT ON messages BEGIN
       INSERT INTO messages_fts(rowid, text) VALUES (new.id, new.text);
     END`,

  // AI memory: the model annotates what it learns across conversations.
  `CREATE TABLE IF NOT EXISTS ai_memory (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     content    TEXT NOT NULL,
     created_at INTEGER DEFAULT (unixepoch())
   )`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS memory_embeddings USING vec0(
     memory_id  INTEGER PRIMARY KEY,
     embedding  FLOAT[${VEC_DIM}]
   )`,
  `CREATE VIRTUAL TABLE IF NOT EXISTS ai_memory_fts USING fts5(
     content,
     tokenize='unicode61'
   )`,
  `CREATE TRIGGER IF NOT EXISTS ai_memory_fts_ai
     AFTER INSERT ON ai_memory BEGIN
       INSERT INTO ai_memory_fts(rowid, content) VALUES (new.id, new.content);
     END`
]

// Idempotent column additions for users upgrading from earlier schemas.
const POST_MIGRATIONS = [
  { column: 'kind', sql: `ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'` },
  { column: 'media_meta', sql: `ALTER TABLE messages ADD COLUMN media_meta TEXT` },
  { column: 'from_me', sql: `ALTER TABLE messages ADD COLUMN from_me INTEGER NOT NULL DEFAULT 0` },
  { column: 'context_note', sql: `ALTER TABLE messages ADD COLUMN context_note TEXT` }
]

export function applyPragmas(db: DatabaseType): void {
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.pragma('temp_store = MEMORY')
  db.pragma('mmap_size = 134217728')
  db.pragma('foreign_keys = ON')
}

function listColumns(db: DatabaseType, table: string): string[] {
  const rows = db.pragma(`table_info(${table})`) as { name: string }[]
  return rows.map((r) => r.name)
}

export function applyMigrations(db: DatabaseType): void {
  for (const sql of SCHEMA_STATEMENTS) {
    db.exec(sql)
  }
  const cols = new Set(listColumns(db, 'messages'))
  for (const m of POST_MIGRATIONS) {
    if (!cols.has(m.column)) db.exec(m.sql)
  }
}

function vecToBuffer(vec: Float32Array): Buffer {
  if (vec.length !== VEC_DIM) {
    throw new Error(
      `Embedding must have ${VEC_DIM} dims, got ${vec.length}`
    )
  }
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength)
}

export function openDatabase(filePath: string): DbInstance {
  const db = new Database(filePath)
  applyPragmas(db)
  sqliteVec.load(db)
  applyMigrations(db)

  const insertMsgStmt = db.prepare(
    `INSERT OR IGNORE INTO messages
       (wa_msg_id, timestamp, text, source, raw_json, kind, media_meta, from_me)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )

  const insertEmbStmt = db.prepare(
    `INSERT OR IGNORE INTO message_embeddings(msg_id, embedding) VALUES (?, ?)`
  )

  // One-time FTS backfill for rows that existed before the trigger was added.
  try {
    db.exec(`
      INSERT INTO messages_fts(rowid, text)
      SELECT m.id, m.text FROM messages m
      WHERE m.id NOT IN (SELECT rowid FROM messages_fts)
    `)
  } catch {
    // Non-fatal — FTS table may be empty on first open; best-effort.
  }

  const kwSearchStmt = db.prepare<[string, number], KeywordResult>(`
    SELECT m.id, m.wa_msg_id, m.text, m.timestamp, m.source, m.kind
    FROM messages_fts
    JOIN messages m ON m.id = messages_fts.rowid
    WHERE messages_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `)

  const searchStmt = db.prepare<[Buffer, number], SimilarResult>(`
    SELECT m.id, m.wa_msg_id, m.timestamp, m.text, m.source, m.kind, e.distance
    FROM message_embeddings e
    JOIN messages m ON m.id = e.msg_id
    WHERE e.embedding MATCH ? AND k = ?
    ORDER BY e.distance
  `)

  const countMsgStmt = db.prepare<[], { count: number }>(
    'SELECT COUNT(*) AS count FROM messages'
  )

  const countEmbStmt = db.prepare<[], { count: number }>(
    'SELECT COUNT(*) AS count FROM message_embeddings'
  )

  const hasEmbStmt = db.prepare<[number], { count: number }>(
    'SELECT COUNT(*) AS count FROM message_embeddings WHERE msg_id = ?'
  )

  const unembeddedStmt = db.prepare<[number], EmbeddableMessage>(`
    SELECT m.id, m.text, m.context_note
    FROM messages m
    LEFT JOIN message_embeddings e ON e.msg_id = m.id
    WHERE e.msg_id IS NULL AND length(trim(m.text)) > 0
    ORDER BY m.timestamp ASC, m.id ASC
    LIMIT ?
  `)

  const withoutContextStmt = db.prepare<[number], ContextableMessage>(`
    SELECT id, text, kind, media_meta
    FROM messages
    WHERE context_note IS NULL
    ORDER BY timestamp DESC
    LIMIT ?
  `)

  const updateContextStmt = db.prepare<[string, number], void>(
    `UPDATE messages SET context_note = ? WHERE id = ?`
  )

  const deleteEmbStmt = db.prepare<[bigint], void>(
    `DELETE FROM message_embeddings WHERE msg_id = ?`
  )

  const lastIngestStmt = db.prepare<[], { last: number | null }>(
    'SELECT MAX(created_at) AS last FROM messages'
  )

  const getMsgStmt = db.prepare<[number], { id: number; text: string; timestamp: number }>(
    'SELECT id, text, timestamp FROM messages WHERE id = ?'
  )

  const surroundingBeforeStmt = db.prepare<[number, number, number, number], { id: number; text: string; timestamp: number }>(`
    SELECT id, text, timestamp
    FROM messages
    WHERE timestamp < ? OR (timestamp = ? AND id < ?)
    ORDER BY timestamp DESC, id DESC
    LIMIT ?
  `)

  const surroundingAfterStmt = db.prepare<[number, number, number, number], { id: number; text: string; timestamp: number }>(`
    SELECT id, text, timestamp
    FROM messages
    WHERE timestamp > ? OR (timestamp = ? AND id > ?)
    ORDER BY timestamp ASC, id ASC
    LIMIT ?
  `)

  // ── AI Memory statements ─────────────────────────────────────────────────────
  const insertMemoryStmt = db.prepare(
    'INSERT INTO ai_memory(content) VALUES (?)'
  )
  const insertMemEmbStmt = db.prepare(
    'INSERT INTO memory_embeddings(memory_id, embedding) VALUES (?, ?)'
  )
  const searchMemSimilarStmt = db.prepare<[Buffer, number], { id: number; content: string; created_at: number; distance: number }>(`
    SELECT m.id, m.content, m.created_at, e.distance
    FROM memory_embeddings e
    JOIN ai_memory m ON m.id = e.memory_id
    WHERE e.embedding MATCH ? AND k = ?
    ORDER BY e.distance
  `)
  const searchMemKwStmt = db.prepare<[string, number], { id: number; content: string; created_at: number }>(`
    SELECT m.id, m.content, m.created_at
    FROM ai_memory_fts
    JOIN ai_memory m ON m.id = ai_memory_fts.rowid
    WHERE ai_memory_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `)
  const listMemoriesStmt = db.prepare<[number], { id: number; content: string; created_at: number }>(
    'SELECT id, content, created_at FROM ai_memory ORDER BY created_at DESC LIMIT ?'
  )
  const unembeddedMemoriesStmt = db.prepare<[number], { id: number; content: string }>(`
    SELECT m.id, m.content FROM ai_memory m
    LEFT JOIN memory_embeddings e ON e.memory_id = m.id
    WHERE e.memory_id IS NULL
    ORDER BY m.id ASC
    LIMIT ?
  `)

  return {
    raw: db,
    insertMessage(msg) {
      const r = insertMsgStmt.run(
        msg.wa_msg_id,
        msg.timestamp,
        msg.text,
        msg.source,
        msg.raw_json ?? null,
        msg.kind ?? 'text',
        msg.media ? JSON.stringify(msg.media) : null,
        msg.from_me ? 1 : 0
      )
      const inserted = r.changes > 0
      return {
        inserted,
        rowId: inserted ? Number(r.lastInsertRowid) : null
      }
    },
    insertEmbedding(msgId, vec) {
      // sqlite-vec's vec0 strictly requires BigInt for the PK column,
      // even for integer-valued JS numbers — better-sqlite3 binds JS
      // numbers as REAL by default.
      insertEmbStmt.run(BigInt(msgId), vecToBuffer(vec))
    },
    clearEmbeddings() {
      db.exec('DELETE FROM message_embeddings')
    },
    searchKeyword(query, limit) {
      if (!query.trim() || limit <= 0) return []
      // Wrap in double-quotes for phrase search; escape any embedded double-quotes.
      const safeQuery = `"${query.replace(/"/g, '""')}"`
      try {
        return kwSearchStmt.all(safeQuery, Math.min(limit, 100))
      } catch {
        // FTS5 MATCH throws on malformed queries (e.g. stray AND/OR operators).
        return []
      }
    },
    searchSimilar(queryVec, k) {
      if (k <= 0) return []
      return searchStmt.all(vecToBuffer(queryVec), k)
    },
    listMessagesWithoutEmbeddings(limit) {
      if (limit <= 0) return []
      return unembeddedStmt.all(Math.min(limit, 10_000))
    },
    listMessagesWithoutContext(limit) {
      if (limit <= 0) return []
      return withoutContextStmt.all(Math.min(limit, 10_000))
    },
    updateContextNote(id, note) {
      updateContextStmt.run(note, id)
    },
    deleteEmbedding(msgId) {
      deleteEmbStmt.run(BigInt(msgId))
    },
    stats(filePath) {
      let sizeBytes = 0
      if (filePath && filePath !== ':memory:') {
        try {
          sizeBytes = statSync(filePath).size
        } catch {
          sizeBytes = 0
        }
      }
      const last = lastIngestStmt.get()?.last ?? null
      return {
        messages: countMsgStmt.get()?.count ?? 0,
        embeddings: countEmbStmt.get()?.count ?? 0,
        sizeBytes,
        lastIngestAt: typeof last === 'number' ? last * 1000 : null
      }
    },
    countMessages() {
      return countMsgStmt.get()?.count ?? 0
    },
    countEmbeddings() {
      return countEmbStmt.get()?.count ?? 0
    },
    hasEmbedding(msgId) {
      return (hasEmbStmt.get(msgId)?.count ?? 0) > 0
    },
    insertMemory(content) {
      const r = insertMemoryStmt.run(content)
      return Number(r.lastInsertRowid)
    },
    insertMemoryEmbedding(memoryId, vec) {
      insertMemEmbStmt.run(BigInt(memoryId), vecToBuffer(vec))
    },
    searchMemorySimilar(queryVec, k) {
      if (k <= 0) return []
      return searchMemSimilarStmt.all(vecToBuffer(queryVec), k).map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.created_at * 1000,
        distance: r.distance
      }))
    },
    searchMemoryKeyword(query, limit) {
      if (!query.trim() || limit <= 0) return []
      const safeQuery = `"${query.replace(/"/g, '""')}"`
      try {
        return searchMemKwStmt.all(safeQuery, Math.min(limit, 50)).map((r) => ({
          id: r.id,
          content: r.content,
          createdAt: r.created_at * 1000
        }))
      } catch {
        return []
      }
    },
    listMemories(limit) {
      return listMemoriesStmt.all(Math.min(limit, 200)).map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.created_at * 1000
      }))
    },
    listUnembeddedMemories(limit) {
      return unembeddedMemoriesStmt.all(Math.min(limit, 500))
    },
    getSurroundingMessages(msgId, limit) {
      const target = getMsgStmt.get(msgId)
      if (!target) return []

      const before = surroundingBeforeStmt.all(target.timestamp, target.timestamp, msgId, limit)
      const after = surroundingAfterStmt.all(target.timestamp, target.timestamp, msgId, limit)

      // before is in DESC order, reverse to chronological (ASC) order
      before.reverse()

      return [...before, target, ...after]
    },
    close() {
      db.close()
    }
  }
}

let _instance: DbInstance | null = null

export function getDb(filePath: string): DbInstance {
  if (!_instance) _instance = openDatabase(filePath)
  return _instance
}

export function closeDb(): void {
  _instance?.close()
  _instance = null
}
