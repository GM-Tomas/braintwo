import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openDatabase, VEC_DIM, type DbInstance } from '../../../electron/services/db'
import { createEmbeddingService, deterministicEmbedder, type EmbeddingService } from '../../../electron/services/embeddings'
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
      embed: async () => new Float32Array(VEC_DIM)
    } as unknown as EmbeddingService

    // Helper to calculate SQLite distance for a target cosine similarity
    function simToDistance(sim: number): number {
      return Math.sqrt(2 * (1 - sim))
    }

    it('marks low-relevance results far below the max similarity as lowRelevance: true', async () => {
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
      expect(results).toHaveLength(3)
      expect(results[0]!.wa_msg_id).toBe('a')
      expect(results[0]!.lowRelevance).toBe(false)
      expect(results[1]!.wa_msg_id).toBe('b')
      expect(results[1]!.lowRelevance).toBe(true)
      expect(results[2]!.wa_msg_id).toBe('c')
      expect(results[2]!.lowRelevance).toBe(true)
    })

    it('keeps a single outstanding result above MIN_SIMILARITY as high relevance', async () => {
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
      expect(results[0]!.lowRelevance).toBe(false)
    })

    it('marks a tight cluster of low-relevance results (noise floor) as lowRelevance: true', async () => {
      const mockDb = {
        searchKeyword: () => [],
        searchSimilar: () => [
          { id: 1, wa_msg_id: 'a', timestamp: 1, text: 'Hola', source: 'export', kind: 'text', from_me: 0, media_meta: null, created_at: null, context_note: null, distance: simToDistance(0.77) },
          { id: 2, wa_msg_id: 'b', timestamp: 2, text: 'Chao', source: 'export', kind: 'text', from_me: 0, media_meta: null, created_at: null, context_note: null, distance: simToDistance(0.768) },
          { id: 3, wa_msg_id: 'c', timestamp: 3, text: 'Test', source: 'export', kind: 'text', from_me: 0, media_meta: null, created_at: null, context_note: null, distance: simToDistance(0.765) }
        ]
      } as unknown as DbInstance

      const service = createSearchService({
        db: mockDb,
        embeddings: mockEmbeddings,
        scheduler: (cb) => cb()
      })

      const results = await service.query('test query', 5)
      expect(results).toHaveLength(3)
      expect(results.every(r => r.lowRelevance === true)).toBe(true)
    })

    it('keeps a tight cluster of high-relevance results as lowRelevance: false', async () => {
      const mockDb = {
        searchKeyword: () => [],
        searchSimilar: () => [
          { id: 1, wa_msg_id: 'a', timestamp: 1, text: 'Medico A', source: 'export', kind: 'text', from_me: 0, media_meta: null, created_at: null, context_note: null, distance: simToDistance(0.91) },
          { id: 2, wa_msg_id: 'b', timestamp: 2, text: 'Medico B', source: 'export', kind: 'text', from_me: 0, media_meta: null, created_at: null, context_note: null, distance: simToDistance(0.905) }
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
      expect(results.every(r => r.lowRelevance === false)).toBe(true)
    })

    it('marks placeholder media messages as lowRelevance: true and ignores them for maxSim', async () => {
      const mockDb = {
        searchKeyword: () => [],
        searchSimilar: () => [
          // Placeholder message (no text, generic context note, high similarity due to embedding anomaly)
          { id: 1, wa_msg_id: 'a', timestamp: 1, text: '', source: 'export', kind: 'image', from_me: 0, media_meta: null, created_at: null, context_note: 'Imagen sin descripción', distance: simToDistance(0.85) },
          // Meaningful message (with text, lower similarity but truly related)
          { id: 2, wa_msg_id: 'b', timestamp: 2, text: 'El perro corre', source: 'export', kind: 'text', from_me: 0, media_meta: null, created_at: null, context_note: null, distance: simToDistance(0.80) }
        ]
      } as unknown as DbInstance

      const service = createSearchService({
        db: mockDb,
        embeddings: mockEmbeddings,
        scheduler: (cb) => cb()
      })

      const results = await service.query('test query', 5)
      expect(results).toHaveLength(2)
      // High relevance ('b') must be sorted before low relevance/placeholder ('a')
      expect(results[0]!.wa_msg_id).toBe('b')
      expect(results[1]!.wa_msg_id).toBe('a')

      const a = results.find(r => r.wa_msg_id === 'a')!
      expect(a.lowRelevance).toBe(true)
      const b = results.find(r => r.wa_msg_id === 'b')!
      expect(b.lowRelevance).toBe(false)
    })

    it('adjusts similarity thresholds in fallback mode to allow lower similarity matches', async () => {
      const mockDb = {
        searchKeyword: () => [],
        searchSimilar: () => [
          { id: 1, wa_msg_id: 'a', timestamp: 1, text: 'Turno', source: 'export', kind: 'text', from_me: 0, media_meta: null, created_at: null, context_note: null, distance: simToDistance(0.30) }
        ]
      } as unknown as DbInstance

      const mockEmbeddingsFallback = {
        embed: async () => new Float32Array(VEC_DIM),
        getStatus: () => ({ status: 'fallback', message: 'Fallback mode' })
      } as unknown as EmbeddingService

      const service = createSearchService({
        db: mockDb,
        embeddings: mockEmbeddingsFallback,
        scheduler: (cb) => cb()
      })

      const results = await service.query('test query', 5)
      expect(results).toHaveLength(1)
      expect(results[0]!.wa_msg_id).toBe('a')
      expect(results[0]!.lowRelevance).toBe(false)
    })
  })
})

