const path = require('path')
const fs = require('fs')
const { app } = require('electron')

const DB_PATH = path.join(app.getPath('userData'), 'braintwo.sqlite')

let db
let SQL

async function initDB() {
  const initSqlJs = require('sql.js')
  const wasmPath = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
  SQL = await initSqlJs({ locateFile: () => wasmPath })

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT NOT NULL DEFAULT 'text',
      content     TEXT NOT NULL,
      raw_path    TEXT,
      tags        TEXT DEFAULT '[]',
      source_chat TEXT DEFAULT 'mis notas',
      created_at  DATETIME DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS config (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `)

  persist()
  console.log('DB inicializada en:', DB_PATH)
  return db
}

function persist() {
  if (!db) return
  const data = db.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}

function getNotes(limit = 100) {
  if (!db) return []
  const stmt = db.prepare(`SELECT * FROM notes ORDER BY created_at DESC LIMIT :limit`)
  stmt.bind({ ':limit': limit })
  const rows = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    rows.push({ ...row, tags: JSON.parse(row.tags || '[]') })
  }
  stmt.free()
  return rows
}

function getNote(id) {
  if (!db) return null
  const stmt = db.prepare(`SELECT * FROM notes WHERE id = :id`)
  stmt.bind({ ':id': id })
  if (stmt.step()) {
    const row = stmt.getAsObject()
    stmt.free()
    return { ...row, tags: JSON.parse(row.tags || '[]') }
  }
  stmt.free()
  return null
}

function insertNote({ type, content, rawPath, tags = [], sourceChat = 'mis notas' }) {
  if (!db) throw new Error('DB no inicializada')
  db.run(
    `INSERT INTO notes (type, content, raw_path, tags, source_chat) VALUES (?, ?, ?, ?, ?)`,
    [type, content, rawPath || null, JSON.stringify(tags), sourceChat]
  )
  const result = db.exec(`SELECT last_insert_rowid() as id`)
  persist()
  return result[0].values[0][0]
}

function searchByText(query, limit = 8) {
  if (!db) return []
  const stmt = db.prepare(`SELECT * FROM notes WHERE content LIKE :q ORDER BY created_at DESC LIMIT :limit`)
  stmt.bind({ ':q': `%${query}%`, ':limit': limit })
  const rows = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    rows.push({ ...row, tags: JSON.parse(row.tags || '[]') })
  }
  stmt.free()
  return rows
}

function getConfig() {
  if (!db) return {}
  const result = db.exec(`SELECT key, value FROM config`)
  if (!result.length) return {}
  return Object.fromEntries(result[0].values)
}

function saveConfig(config) {
  if (!db) return
  for (const [key, value] of Object.entries(config)) {
    db.run(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`, [key, value])
  }
  persist()
}

module.exports = { initDB, getNotes, getNote, insertNote, searchByText, getConfig, saveConfig }
