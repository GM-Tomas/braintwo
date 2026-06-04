import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  openDatabase,
  applyMigrations,
  applyPragmas,
  getDb,
  closeDb,
  VEC_DIM,
  type DbInstance,
  type NewMessage
} from '../../../electron/services/db'

function makeVec(seed = 0): Float32Array {
  const v = new Float32Array(VEC_DIM)
  for (let i = 0; i < VEC_DIM; i++) {
    v[i] = Math.sin(seed * 0.7 + i * 0.013)
  }
  let n = 0
  for (let i = 0; i < VEC_DIM; i++) n += v[i] * v[i]
  n = Math.sqrt(n) || 1
  for (let i = 0; i < VEC_DIM; i++) v[i] /= n
  return v
}

const baseMsg = (overrides: Partial<NewMessage> = {}): NewMessage => ({
  wa_msg_id: 'wa-1',
  timestamp: 1700000000000,
  text: 'hola',
  source: 'realtime',
  raw_json: '{"k":"v"}',
  ...overrides
})

describe('db service', () => {
  let db: DbInstance

  beforeEach(() => {
    db = openDatabase(':memory:')
  })

  afterEach(() => {
    try {
      db.close()
    } catch {
      // already closed in some tests
    }
  })

  describe('schema & migrations', () => {
    it('creates messages and message_embeddings tables', () => {
      const tables = db.raw
        .prepare(
          "SELECT name FROM sqlite_master WHERE type IN ('table','view') ORDER BY name"
        )
        .all() as { name: string }[]
      const names = tables.map((t) => t.name)
      expect(names).toContain('messages')
      expect(names).toContain('message_embeddings')
    })

    it('creates idx_msg_ts index on timestamp', () => {
      const idx = db.raw
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_msg_ts'"
        )
        .get()
      expect(idx).toBeDefined()
    })

    it('messages.wa_msg_id is UNIQUE', () => {
      const cols = db.raw
        .prepare("SELECT sql FROM sqlite_master WHERE name='messages'")
        .get() as { sql: string }
      expect(cols.sql).toMatch(/wa_msg_id\s+TEXT\s+UNIQUE\s+NOT\s+NULL/i)
    })

    it('applyMigrations is idempotent', () => {
      expect(() => applyMigrations(db.raw)).not.toThrow()
      expect(() => applyMigrations(db.raw)).not.toThrow()
      // schema unchanged after second run
      const tablesAfter = db.raw
        .prepare(
          "SELECT name FROM sqlite_master WHERE type IN ('table','view')"
        )
        .all().length
      applyMigrations(db.raw)
      const tablesAfter2 = db.raw
        .prepare(
          "SELECT name FROM sqlite_master WHERE type IN ('table','view')"
        )
        .all().length
      expect(tablesAfter2).toBe(tablesAfter)
    })

    it('applyPragmas can be called on a fresh handle without throwing', () => {
      const fresh = openDatabase(':memory:')
      expect(() => applyPragmas(fresh.raw)).not.toThrow()
      fresh.close()
    })
  })

  describe('pragmas', () => {
    it('synchronous is NORMAL (1)', () => {
      const r = db.raw.pragma('synchronous', { simple: true })
      expect(r).toBe(1)
    })

    it('temp_store is MEMORY (2)', () => {
      const r = db.raw.pragma('temp_store', { simple: true })
      expect(r).toBe(2)
    })

    it('foreign_keys ON', () => {
      const r = db.raw.pragma('foreign_keys', { simple: true })
      expect(r).toBe(1)
    })
  })

  describe('insertMessage', () => {
    it('inserts a new row and returns rowId', () => {
      const r = db.insertMessage(baseMsg())
      expect(r.inserted).toBe(true)
      expect(typeof r.rowId).toBe('number')
      expect(r.rowId).toBeGreaterThan(0)
    })

    it('persists every field exactly', () => {
      const r = db.insertMessage(baseMsg())
      const row = db.raw
        .prepare('SELECT * FROM messages WHERE id = ?')
        .get(r.rowId) as Record<string, unknown>
      expect(row.wa_msg_id).toBe('wa-1')
      expect(row.timestamp).toBe(1700000000000)
      expect(row.text).toBe('hola')
      expect(row.source).toBe('realtime')
      expect(row.raw_json).toBe('{"k":"v"}')
      expect(typeof row.created_at).toBe('number')
    })

    it('does NOT insert duplicate wa_msg_id (INSERT OR IGNORE)', () => {
      db.insertMessage(baseMsg())
      const second = db.insertMessage(baseMsg({ text: 'distinto' }))
      expect(second.inserted).toBe(false)
      expect(second.rowId).toBeNull()
      expect(db.countMessages()).toBe(1)
      const row = db.raw
        .prepare('SELECT text FROM messages WHERE wa_msg_id = ?')
        .get('wa-1') as { text: string }
      expect(row.text).toBe('hola')
    })

    it('handles null raw_json', () => {
      const r = db.insertMessage(baseMsg({ wa_msg_id: 'wa-2', raw_json: null }))
      const row = db.raw
        .prepare('SELECT raw_json FROM messages WHERE id = ?')
        .get(r.rowId) as { raw_json: string | null }
      expect(row.raw_json).toBeNull()
    })

    it('handles undefined raw_json (defaults to null)', () => {
      const r = db.insertMessage({
        wa_msg_id: 'wa-3',
        timestamp: 1,
        text: 't',
        source: 'realtime'
      })
      const row = db.raw
        .prepare('SELECT raw_json FROM messages WHERE id = ?')
        .get(r.rowId) as { raw_json: string | null }
      expect(row.raw_json).toBeNull()
    })

    it.each([
      'export',
      'history-sync',
      'realtime',
      'offline-sync'
    ] as const)('accepts source = %s', (source) => {
      const r = db.insertMessage(baseMsg({ wa_msg_id: `wa-${source}`, source }))
      expect(r.inserted).toBe(true)
    })

    it('countMessages reflects inserts', () => {
      expect(db.countMessages()).toBe(0)
      for (let i = 0; i < 7; i++) {
        db.insertMessage(baseMsg({ wa_msg_id: `wa-c${i}` }))
      }
      expect(db.countMessages()).toBe(7)
    })
  })

  describe('insertEmbedding', () => {
    let msgId: number

    beforeEach(() => {
      const r = db.insertMessage(baseMsg({ wa_msg_id: 'wa-emb' }))
      msgId = r.rowId as number
    })

    it('inserts a VEC_DIM-dim Float32Array', () => {
      expect(() => db.insertEmbedding(msgId, makeVec(1))).not.toThrow()
      expect(db.countEmbeddings()).toBe(1)
      expect(db.hasEmbedding(msgId)).toBe(true)
    })

    it('rejects wrong dimension count (too few)', () => {
      const bad = new Float32Array(100)
      expect(() => db.insertEmbedding(msgId, bad)).toThrow(new RegExp(VEC_DIM.toString()))
    })

    it('rejects wrong dimension count (too many)', () => {
      const bad = new Float32Array(VEC_DIM + 1)
      expect(() => db.insertEmbedding(msgId, bad)).toThrow(new RegExp(VEC_DIM.toString()))
    })

    it('rejects empty Float32Array', () => {
      expect(() => db.insertEmbedding(msgId, new Float32Array())).toThrow(new RegExp(VEC_DIM.toString()))
    })

    it('one embedding per msg_id (PRIMARY KEY conflict on duplicate)', () => {
      db.insertEmbedding(msgId, makeVec(1))
      expect(() => db.insertEmbedding(msgId, makeVec(2))).toThrow()
    })

    it('hasEmbedding returns false for unknown msg_id', () => {
      expect(db.hasEmbedding(99999)).toBe(false)
    })
  })

  describe('searchSimilar (KNN)', () => {
    function seedSet(count: number): void {
      for (let i = 0; i < count; i++) {
        const r = db.insertMessage(
          baseMsg({ wa_msg_id: `wa-s${i}`, timestamp: i, text: `msg ${i}` })
        )
        db.insertEmbedding(r.rowId as number, makeVec(i))
      }
    }

    it('returns top-k ordered by ascending distance', () => {
      seedSet(5)
      const results = db.searchSimilar(makeVec(0), 3)
      expect(results.length).toBe(3)
      expect(results[0]!.text).toBe('msg 0')
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.distance).toBeGreaterThanOrEqual(
          results[i - 1]!.distance
        )
      }
    })

    it('respects k limit', () => {
      seedSet(10)
      expect(db.searchSimilar(makeVec(0), 4).length).toBe(4)
      expect(db.searchSimilar(makeVec(0), 1).length).toBe(1)
    })

    it('returns empty array when no embeddings present', () => {
      expect(db.searchSimilar(makeVec(), 5)).toEqual([])
    })

    it('returns empty array when k <= 0', () => {
      seedSet(3)
      expect(db.searchSimilar(makeVec(0), 0)).toEqual([])
      expect(db.searchSimilar(makeVec(0), -1)).toEqual([])
    })

    it('rejects wrong-dimension query vector', () => {
      seedSet(1)
      expect(() => db.searchSimilar(new Float32Array(10), 1)).toThrow(new RegExp(VEC_DIM.toString()))
    })

    it('result rows include all fields from messages', () => {
      seedSet(2)
      const r = db.searchSimilar(makeVec(0), 1)[0]!
      expect(r.id).toBeGreaterThan(0)
      expect(r.wa_msg_id).toBe('wa-s0')
      expect(r.timestamp).toBe(0)
      expect(r.text).toBe('msg 0')
      expect(r.source).toBe('realtime')
      expect(typeof r.distance).toBe('number')
    })
  })

  describe('singleton lifecycle', () => {
    afterEach(() => closeDb())

    it('getDb returns same instance on repeated calls', () => {
      const a = getDb(':memory:')
      const b = getDb(':memory:')
      expect(a).toBe(b)
    })

    it('closeDb releases the singleton; next getDb is a new handle', () => {
      const a = getDb(':memory:')
      closeDb()
      const b = getDb(':memory:')
      expect(a).not.toBe(b)
    })

    it('closeDb is idempotent (no error if no instance)', () => {
      expect(() => closeDb()).not.toThrow()
      expect(() => closeDb()).not.toThrow()
    })
  })
})

describe('db file persistence', () => {
  let tmp: string
  let dbPath: string

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'braintwo-db-'))
    dbPath = join(tmp, 'test.db')
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it('creates the db file at the given path', () => {
    const db = openDatabase(dbPath)
    db.close()
    expect(existsSync(dbPath)).toBe(true)
  })

  it('applies WAL journal_mode for file-backed dbs', () => {
    const db = openDatabase(dbPath)
    const mode = db.raw.pragma('journal_mode', { simple: true })
    expect(mode).toBe('wal')
    db.close()
  })

  it('persists messages across close + reopen', () => {
    const a = openDatabase(dbPath)
    a.insertMessage(baseMsg({ wa_msg_id: 'persist-1' }))
    a.insertMessage(baseMsg({ wa_msg_id: 'persist-2' }))
    a.close()

    const b = openDatabase(dbPath)
    expect(b.countMessages()).toBe(2)
    b.close()
  })

  it('persists embeddings across close + reopen', () => {
    const a = openDatabase(dbPath)
    const r = a.insertMessage(baseMsg({ wa_msg_id: 'emb-persist' }))
    a.insertEmbedding(r.rowId as number, makeVec(1))
    a.close()

    const b = openDatabase(dbPath)
    expect(b.countEmbeddings()).toBe(1)
    expect(b.hasEmbedding(r.rowId as number)).toBe(true)
    b.close()
  })

  it('seeds default memories when created from scratch', () => {
    const db = openDatabase(dbPath)
    const memories = db.listMemories(100)
    expect(memories.length).toBe(8)
    expect(memories.some(m => m.content.includes('BrainTwo'))).toBe(true)
    db.close()
  })
})
