import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, type DbInstance } from '../../../electron/services/db'
import { createEmbeddingService, deterministicEmbedder } from '../../../electron/services/embeddings'
import { createSearchService } from '../../../electron/services/search'

describe('search service', () => {
  let db: DbInstance

  beforeEach(() => {
    db = openDatabase(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  it('embeds a plain-text query and returns ordered KNN rows with similarity', async () => {
    const a = db.insertMessage({
      wa_msg_id: 'a',
      timestamp: 1,
      text: 'comprar madera para el escritorio',
      source: 'export'
    })
    const b = db.insertMessage({
      wa_msg_id: 'b',
      timestamp: 2,
      text: 'turno medico',
      source: 'export'
    })
    db.insertEmbedding(a.rowId as number, deterministicEmbedder('madera escritorio'))
    db.insertEmbedding(b.rowId as number, deterministicEmbedder('medico'))

    const service = createSearchService({
      db,
      embeddings: createEmbeddingService({
        cacheDir: 'models',
        embedder: deterministicEmbedder,
        scheduler: (cb) => cb()
      }),
      scheduler: (cb) => cb()
    })

    const results = await service.query('escritorio madera', 1)
    expect(results).toHaveLength(1)
    expect(results[0]!.wa_msg_id).toBe('a')
    expect(results[0]!.similarity).toBeGreaterThanOrEqual(0)
  })

  it('backfills messages that do not have embeddings yet', async () => {
    db.insertMessage({
      wa_msg_id: 'a',
      timestamp: 1,
      text: 'uno',
      source: 'realtime'
    })
    db.insertMessage({
      wa_msg_id: 'b',
      timestamp: 2,
      text: '',
      source: 'realtime'
    })
    const service = createSearchService({
      db,
      embeddings: createEmbeddingService({
        cacheDir: 'models',
        embedder: deterministicEmbedder,
        scheduler: (cb) => cb()
      }),
      scheduler: (cb) => cb(),
      batchSize: 1
    })
    const result = await service.backfillMissing()
    expect(result.processed).toBe(1)
    expect(result.inserted).toBe(1)
    expect(db.countEmbeddings()).toBe(1)
  })

  describe('relevance filtering rules', () => {
    const mockEmbeddings = {
      embed: async () => new Float32Array(384)
    } as unknown as EmbeddingService

    // Helper to calculate SQLite distance for a target cosine similarity
    function simToDistance(sim: number): number {
      return Math.sqrt(2 * (1 - sim))
    }

    it('excludes low-relevance results far below the max similarity', async () => {
      const mockDb = {
        searchKeyword: () => [],
        searchSimilar: () => [
          { id: 1, wa_msg_id: 'a', timestamp: 1, text: 'Gonzalez', source: 'export', kind: 'text', from_me: 0, media_meta: null, created_at: null, context_note: null, distance: simToDistance(0.92) },
          { id: 2, wa_msg_id: 'b', timestamp: 2, text: 'Hola', source: 'export', kind: 'text', from_me: 0, media_meta: null, created_at: null, context_note: null, distance: simToDistance(0.83) },
          { id: 3, wa_msg_id: 'c', timestamp: 3, text: 'Chao', source: 'export', kind: 'text', from_me: 0, media_meta: null, created_at: null, context_note: null, distance: simToDistance(0.825) }
        ]
      } as unknown as DbInstance

      const service = createSearchService({
        db: mockDb,
        embeddings: mockEmbeddings,
        scheduler: (cb) => cb()
      })

      const results = await service.query('test query', 5)
      expect(results).toHaveLength(1)
      expect(results[0]!.wa_msg_id).toBe('a')
    })

    it('keeps a single outstanding result above MIN_SIMILARITY', async () => {
      const mockDb = {
        searchKeyword: () => [],
        searchSimilar: () => [
          { id: 1, wa_msg_id: 'a', timestamp: 1, text: 'Turno', source: 'export', kind: 'text', from_me: 0, media_meta: null, created_at: null, context_note: null, distance: simToDistance(0.85) }
        ]
      } as unknown as DbInstance

      const service = createSearchService({
        db: mockDb,
        embeddings: mockEmbeddings,
        scheduler: (cb) => cb()
      })

      const results = await service.query('test query', 5)
      expect(results).toHaveLength(1)
      expect(results[0]!.wa_msg_id).toBe('a')
    })

    it('discards a tight cluster of low-relevance results (noise floor)', async () => {
      const mockDb = {
        searchKeyword: () => [],
        searchSimilar: () => [
          { id: 1, wa_msg_id: 'a', timestamp: 1, text: 'Hola', source: 'export', kind: 'text', from_me: 0, media_meta: null, created_at: null, context_note: null, distance: simToDistance(0.85) },
          { id: 2, wa_msg_id: 'b', timestamp: 2, text: 'Chao', source: 'export', kind: 'text', from_me: 0, media_meta: null, created_at: null, context_note: null, distance: simToDistance(0.848) },
          { id: 3, wa_msg_id: 'c', timestamp: 3, text: 'Test', source: 'export', kind: 'text', from_me: 0, media_meta: null, created_at: null, context_note: null, distance: simToDistance(0.845) }
        ]
      } as unknown as DbInstance

      const service = createSearchService({
        db: mockDb,
        embeddings: mockEmbeddings,
        scheduler: (cb) => cb()
      })

      const results = await service.query('test query', 5)
      expect(results).toHaveLength(0)
    })

    it('keeps a tight cluster of high-relevance results', async () => {
      const mockDb = {
        searchKeyword: () => [],
        searchSimilar: () => [
          { id: 1, wa_msg_id: 'a', timestamp: 1, text: 'Medico A', source: 'export', kind: 'text', from_me: 0, media_meta: null, created_at: null, context_note: null, distance: simToDistance(0.91) },
          { id: 2, wa_msg_id: 'b', timestamp: 2, text: 'Medico B', source: 'export', kind: 'text', from_me: 0, media_meta: null, created_at: null, distance: simToDistance(0.905) }
        ]
      } as unknown as DbInstance

      const service = createSearchService({
        db: mockDb,
        embeddings: mockEmbeddings,
        scheduler: (cb) => cb()
      })

      const results = await service.query('test query', 5)
      expect(results).toHaveLength(2)
      expect(results.map(r => r.wa_msg_id)).toContain('a')
      expect(results.map(r => r.wa_msg_id)).toContain('b')
    })
  })
})

