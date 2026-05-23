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
})
