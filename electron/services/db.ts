import Database, { type Database as DatabaseType } from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'
import { statSync } from 'node:fs'

export const VEC_DIM = 768

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
  audioLocalPath?: string
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
  from_me: number
  media_meta: string | null
  created_at: number | null
  context_note: string | null
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
  from_me: number
  media_meta: string | null
  created_at: number | null
  context_note: string | null
}

export interface ContextableMessage {
  id: number
  text: string
  kind: MessageKind
  media_meta: string | null
  timestamp: number
}

export interface MemoryResult {
  id: number
  content: string
  createdAt: number
  distance?: number
}

export interface DbChat {
  id: number
  title: string
  created_at: number
}

export interface DbChatMessage {
  id: number
  chat_id: number
  role: 'user' | 'assistant'
  content: string
  sources: string | null
  created_at: number
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
  updateMediaMeta: (id: number, meta: Partial<MediaMeta>) => void
  updateTranscript: (id: number, transcript: string) => void
  deleteEmbedding: (msgId: number) => void
  // AI memory
  insertMemory: (content: string, chatId?: number) => number
  insertMemoryEmbedding: (memoryId: number, vec: Float32Array) => void
  searchMemorySimilar: (queryVec: Float32Array, k: number, chatId?: number) => MemoryResult[]
  searchMemoryKeyword: (query: string, limit: number, chatId?: number) => MemoryResult[]
  listMemories: (limit: number) => MemoryResult[]
  listUnembeddedMemories: (limit: number) => { id: number; content: string }[]
  // Chat history
  createChat: (title: string) => number
  listChats: () => DbChat[]
  deleteChat: (id: number) => void
  renameChat: (id: number, title: string) => void
  getChatMessages: (chatId: number) => DbChatMessage[]
  insertChatMessage: (chatId: number, role: 'user' | 'assistant', content: string, sources: string | null) => number
  // Stats / misc
  stats: (filePath?: string) => DbStats
  countMessages: () => number
  countEmbeddings: () => number
  hasEmbedding: (msgId: number) => boolean
  getSurroundingMessages: (msgId: number, limit: number) => { id: number; text: string; timestamp: number; contextNote: string | null }[]
  toggleIgnored: (id: number) => boolean
  getIgnoredIds: () => number[]
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
     context_note,
     tokenize='unicode61'
   )`,
  // Keep FTS index in sync when messages are inserted.
  `CREATE TRIGGER IF NOT EXISTS messages_fts_ai
     AFTER INSERT ON messages BEGIN
       INSERT INTO messages_fts(rowid, text, context_note) VALUES (new.id, new.text, new.context_note);
     END`,
  // Keep FTS index in sync when context notes are updated.
  `CREATE TRIGGER IF NOT EXISTS messages_fts_au
     AFTER UPDATE OF context_note ON messages BEGIN
       UPDATE messages_fts SET context_note = new.context_note WHERE rowid = old.id;
     END`,

  // AI memory: the model annotates what it learns across conversations.
  `CREATE TABLE IF NOT EXISTS ai_memory (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     content    TEXT NOT NULL,
     chat_id    INTEGER,
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
     END`,
  // Chat history tables
  `CREATE TABLE IF NOT EXISTS chats (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     title       TEXT NOT NULL,
     created_at  INTEGER DEFAULT (unixepoch())
   )`,
  `CREATE TABLE IF NOT EXISTS chat_messages (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     chat_id     INTEGER NOT NULL,
     role        TEXT NOT NULL,
     content     TEXT NOT NULL,
     sources     TEXT,
     created_at  INTEGER DEFAULT (unixepoch()),
     FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS idx_chat_msg_chat_id ON chat_messages(chat_id)`
]

// Idempotent column additions for users upgrading from earlier schemas.
const POST_MIGRATIONS = [
  { column: 'kind', sql: `ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'` },
  { column: 'media_meta', sql: `ALTER TABLE messages ADD COLUMN media_meta TEXT` },
  { column: 'from_me', sql: `ALTER TABLE messages ADD COLUMN from_me INTEGER NOT NULL DEFAULT 0` },
  { column: 'context_note', sql: `ALTER TABLE messages ADD COLUMN context_note TEXT` },
  { column: 'ignored', sql: `ALTER TABLE messages ADD COLUMN ignored INTEGER NOT NULL DEFAULT 0` }
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
  // Check if we need to migrate embedding dimensions.
  // We can query sqlite_master for the schema of message_embeddings.
  try {
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'message_embeddings'").get() as { sql: string } | undefined
    if (row && row.sql) {
      const expectedPattern = `FLOAT[${VEC_DIM}]`
      if (!row.sql.includes(expectedPattern)) {
        db.exec('DROP TABLE IF EXISTS message_embeddings')
        db.exec('DROP TABLE IF EXISTS memory_embeddings')
      }
    }
  } catch {
    // ignore
  }

  // Check if messages_fts exists and if it lacks context_note
  let hasFtsTable = false
  try {
    const rows = db.pragma('table_info(messages_fts)') as { name: string }[]
    if (rows.length > 0) {
      hasFtsTable = true
      const ftsCols = new Set(rows.map((r) => r.name))
      if (!ftsCols.has('context_note')) {
        // Upgrade existing messages_fts table
        db.exec('DROP TRIGGER IF EXISTS messages_fts_ai')
        db.exec('DROP TRIGGER IF EXISTS messages_fts_au')
        db.exec('DROP TABLE IF EXISTS messages_fts')
        hasFtsTable = false
      }
    }
  } catch {
    // ignore
  }

  for (const sql of SCHEMA_STATEMENTS) {
    db.exec(sql)
  }

  if (hasFtsTable === false) {
    try {
      db.exec(`
        INSERT OR IGNORE INTO messages_fts(rowid, text, context_note)
        SELECT id, text, context_note FROM messages
      `)
    } catch {
      // best-effort
    }
  }

  const cols = new Set(listColumns(db, 'messages'))
  for (const m of POST_MIGRATIONS) {
    if (!cols.has(m.column)) db.exec(m.sql)
  }
  const memCols = new Set(listColumns(db, 'ai_memory'))
  if (!memCols.has('chat_id')) {
    db.exec('ALTER TABLE ai_memory ADD COLUMN chat_id INTEGER')
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

export function parseFtsQuery(query: string): string {
  const trimmed = query.trim()
  if (!trimmed) return ''

  // If already enclosed in quotes, assume strict phrase search
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 2) {
    return trimmed
  }

  // Split by whitespace, sanitize each token, format with trailing wildcard
  const terms = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => {
      // Remove double/single quotes, asterisks to prevent FTS5 syntax errors
      const clean = term.replace(/["'*]/g, '').trim()
      if (!clean) return ''
      // Return term wrapped in quotes with a trailing wildcard
      return `"${clean}"*`
    })
    .filter(Boolean)

  return terms.join(' AND ')
}

export function openDatabase(filePath: string): DbInstance {
  const db = new Database(filePath)
  applyPragmas(db)
  let vecPath = sqliteVec.getLoadablePath()
  if (vecPath.includes('app.asar') && !vecPath.includes('app.asar.unpacked')) {
    vecPath = vecPath.replace('app.asar', 'app.asar.unpacked')
  }
  db.loadExtension(vecPath)
  applyMigrations(db)

  // Seed default global memories if ai_memory is empty
  try {
    const memCount = db.prepare('SELECT COUNT(*) AS count FROM ai_memory').get() as { count: number }
    if (memCount && memCount.count === 0) {
      const defaultMemories = [
        'BrainTwo es un segundo cerebro digital personal que se conecta de manera segura a tu WhatsApp para indexar, buscar y organizar tus mensajes, audios y enlaces.',
        'Toda la información y base de datos de BrainTwo se almacena localmente de forma privada en tu computadora. Nada sale de tu máquina.',
        'Puedes usar la sección de Búsqueda de BrainTwo para encontrar de manera instantánea cualquier mensaje, conversación, audio transcrito o link que hayas enviado o recibido sin tener que scrollear.',
        'La sección del Timeline de la aplicación muestra tu actividad de WhatsApp de manera puramente cronológica, creando un feed limpio y útil libre de algoritmos.',
        'En la sección de Chat IA, puedes interactuar directamente con un asistente inteligente que tiene acceso a tu memoria global y contexto para ayudarte a responder preguntas sobre tus chats.',
        'El asistente de chat utiliza la memoria global para aprender de ti a lo largo del tiempo y para proporcionarte información precisa sobre el funcionamiento de la aplicación.',
        'Puedes preguntarle al Chat IA cosas sobre BrainTwo, como "¿qué es?", "¿dónde se guardan mis datos?" o pedirle sugerencias de uso.',
        'Para importar tu historial antiguo de WhatsApp, abre WhatsApp en tu celular, ve a tu propio chat personal (el chat contigo mismo), pulsa "Exportar chat" (eligiendo sin archivos/medios), y carga el archivo .txt resultante en el panel de Primeros Pasos o en los Ajustes.'
      ]
      const insertMem = db.prepare('INSERT INTO ai_memory(content, chat_id) VALUES (?, NULL)')
      const transaction = db.transaction((memories: string[]) => {
        for (const content of memories) {
          insertMem.run(content)
        }
      })
      transaction(defaultMemories)
    }
  } catch (err) {
    console.error('Error seeding default memories:', err)
  }

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
      INSERT INTO messages_fts(rowid, text, context_note)
      SELECT m.id, m.text, m.context_note FROM messages m
      WHERE m.id NOT IN (SELECT rowid FROM messages_fts)
    `)
  } catch {
    // Non-fatal — FTS table may be empty on first open; best-effort.
  }

  const kwSearchStmt = db.prepare<[string, number], KeywordResult>(`
    SELECT m.id, m.wa_msg_id, m.text, m.timestamp, m.source, m.kind, m.from_me, m.media_meta, m.created_at, m.context_note
    FROM messages_fts
    JOIN messages m ON m.id = messages_fts.rowid
    WHERE messages_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `)

  const searchStmt = db.prepare<[Buffer, number], SimilarResult>(`
    SELECT m.id, m.wa_msg_id, m.timestamp, m.text, m.source, m.kind, m.from_me, m.media_meta, m.created_at, m.context_note, e.distance
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
    SELECT id, text, kind, media_meta, timestamp
    FROM messages
    WHERE context_note IS NULL
    ORDER BY timestamp DESC
    LIMIT ?
  `)

  const updateContextStmt = db.prepare<[string, number], void>(
    `UPDATE messages SET context_note = ? WHERE id = ?`
  )

  const readMediaMetaStmt = db.prepare<[number], { media_meta: string | null }>(
    `SELECT media_meta FROM messages WHERE id = ?`
  )

  const writeMediaMetaStmt = db.prepare<[string, number], void>(
    `UPDATE messages SET media_meta = ? WHERE id = ?`
  )

  const updateMsgTextStmt = db.prepare<[string, number], void>(
    `UPDATE messages SET text = ? WHERE id = ?`
  )

  const updateFtsTextStmt = db.prepare<[string, number], void>(
    `UPDATE messages_fts SET text = ? WHERE rowid = ?`
  )

  const deleteEmbStmt = db.prepare<[bigint], void>(
    `DELETE FROM message_embeddings WHERE msg_id = ?`
  )

  const lastIngestStmt = db.prepare<[], { last: number | null }>(
    'SELECT MAX(created_at) AS last FROM messages'
  )

  const getMsgStmt = db.prepare<[number], { id: number; text: string; timestamp: number; context_note: string | null }>(
    'SELECT id, text, timestamp, context_note FROM messages WHERE id = ?'
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

  const toggleIgnoreStmt = db.prepare<[number], { ignored: number }>(
    `UPDATE messages SET ignored = CASE WHEN ignored = 0 THEN 1 ELSE 0 END WHERE id = ? RETURNING ignored`
  )

  const getIgnoredIdsStmt = db.prepare<[], { id: number }>(
    `SELECT id FROM messages WHERE ignored = 1`
  )

  // ── AI Memory statements ─────────────────────────────────────────────────────
  const insertMemoryStmt = db.prepare(
    'INSERT INTO ai_memory(content, chat_id) VALUES (?, ?)'
  )
  const insertMemEmbStmt = db.prepare(
    'INSERT INTO memory_embeddings(memory_id, embedding) VALUES (?, ?)'
  )
  const searchMemSimilarStmt = db.prepare<[Buffer, number, number | null], { id: number; content: string; created_at: number; distance: number }>(`
    SELECT m.id, m.content, m.created_at, e.distance
    FROM memory_embeddings e
    JOIN ai_memory m ON m.id = e.memory_id
    WHERE e.embedding MATCH ? AND k = ? AND (m.chat_id = ? OR m.chat_id IS NULL)
    ORDER BY e.distance
  `)
  const searchMemKwStmt = db.prepare<[string, number | null, number], { id: number; content: string; created_at: number }>(`
    SELECT m.id, m.content, m.created_at
    FROM ai_memory_fts
    JOIN ai_memory m ON m.id = ai_memory_fts.rowid
    WHERE ai_memory_fts MATCH ? AND (m.chat_id = ? OR m.chat_id IS NULL)
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

  const insertChatStmt = db.prepare(
    'INSERT INTO chats(title) VALUES (?)'
  )
  const listChatsStmt = db.prepare<[], DbChat>(
    'SELECT id, title, created_at FROM chats ORDER BY created_at DESC'
  )
  const deleteChatStmt = db.prepare<[number], void>(
    'DELETE FROM chats WHERE id = ?'
  )
  const renameChatStmt = db.prepare<[string, number], void>(
    'UPDATE chats SET title = ? WHERE id = ?'
  )
  const getChatMessagesStmt = db.prepare<[number], DbChatMessage>(
    'SELECT id, chat_id, role, content, sources, created_at FROM chat_messages WHERE chat_id = ? ORDER BY id ASC'
  )
  const insertChatMessageStmt = db.prepare(
    'INSERT INTO chat_messages(chat_id, role, content, sources) VALUES (?, ?, ?, ?)'
  )

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
      const safeQuery = parseFtsQuery(query)
      if (!safeQuery || limit <= 0) return []
      try {
        return kwSearchStmt.all(safeQuery, Math.min(limit, 100))
      } catch {
        // Fallback to phrase search if FTS5 MATCH throws
        try {
          const fallbackQuery = `"${query.trim().replace(/"/g, '""')}"`
          return kwSearchStmt.all(fallbackQuery, Math.min(limit, 100))
        } catch {
          return []
        }
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
    updateMediaMeta(id, meta) {
      const row = readMediaMetaStmt.get(id)
      let existing: Record<string, unknown> = {}
      if (row?.media_meta) {
        try { existing = JSON.parse(row.media_meta) } catch { /* ignore */ }
      }
      const merged = { ...existing, ...meta }
      writeMediaMetaStmt.run(JSON.stringify(merged), id)
    },
    updateTranscript(id, transcript) {
      updateMsgTextStmt.run(transcript, id)
      updateFtsTextStmt.run(transcript, id)
      const row = readMediaMetaStmt.get(id)
      let existing: Record<string, unknown> = {}
      if (row?.media_meta) {
        try { existing = JSON.parse(row.media_meta) } catch { /* ignore */ }
      }
      existing.transcript = transcript
      writeMediaMetaStmt.run(JSON.stringify(existing), id)
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
    insertMemory(content, chatId) {
      const r = insertMemoryStmt.run(content, chatId ?? null)
      return Number(r.lastInsertRowid)
    },
    insertMemoryEmbedding(memoryId, vec) {
      insertMemEmbStmt.run(BigInt(memoryId), vecToBuffer(vec))
    },
    searchMemorySimilar(queryVec, k, chatId) {
      if (k <= 0) return []
      return searchMemSimilarStmt.all(vecToBuffer(queryVec), k, chatId ?? null).map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.created_at * 1000,
        distance: r.distance
      }))
    },
    searchMemoryKeyword(query, limit, chatId) {
      const safeQuery = parseFtsQuery(query)
      if (!safeQuery || limit <= 0) return []
      try {
        return searchMemKwStmt.all(safeQuery, chatId ?? null, Math.min(limit, 50)).map((r) => ({
          id: r.id,
          content: r.content,
          createdAt: r.created_at * 1000
        }))
      } catch {
        // Fallback to phrase search if FTS5 MATCH throws
        try {
          const fallbackQuery = `"${query.trim().replace(/"/g, '""')}"`
          return searchMemKwStmt.all(fallbackQuery, chatId ?? null, Math.min(limit, 50)).map((r) => ({
            id: r.id,
            content: r.content,
            createdAt: r.created_at * 1000
          }))
        } catch {
          return []
        }
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
    createChat(title) {
      const r = insertChatStmt.run(title)
      return Number(r.lastInsertRowid)
    },
    listChats() {
      return listChatsStmt.all()
    },
    deleteChat(id) {
      deleteChatStmt.run(id)
    },
    renameChat(id, title) {
      renameChatStmt.run(title, id)
    },
    getChatMessages(chatId) {
      return getChatMessagesStmt.all(chatId)
    },
    insertChatMessage(chatId, role, content, sources) {
      const r = insertChatMessageStmt.run(chatId, role, content, sources)
      return Number(r.lastInsertRowid)
    },
    toggleIgnored(id) {
      const result = toggleIgnoreStmt.get(id)
      return result ? result.ignored === 1 : false
    },
    getIgnoredIds() {
      return getIgnoredIdsStmt.all().map((r) => r.id)
    },
    getSurroundingMessages(msgId, limit) {
      const target = getMsgStmt.get(msgId)
      if (!target) return []

      const before = surroundingBeforeStmt.all(target.timestamp, target.timestamp, msgId, limit)
      const after = surroundingAfterStmt.all(target.timestamp, target.timestamp, msgId, limit)

      // before is in DESC order, reverse to chronological (ASC) order
      before.reverse()

      const toRow = (r: { id: number; text: string; timestamp: number; context_note?: string | null }) => ({
        id: r.id,
        text: r.text,
        timestamp: r.timestamp,
        contextNote: r.context_note ?? null
      })
      return [...before.map(toRow), toRow(target), ...after.map(toRow)]
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
