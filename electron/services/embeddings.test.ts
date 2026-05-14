import { describe, it, expect, vi } from 'vitest'
import { VEC_DIM } from './db'
import { createEmbeddingService, deterministicEmbedder } from './embeddings'

describe('embedding service', () => {
  it('produces deterministic 384-dim fallback vectors', () => {
    const a = deterministicEmbedder('Ideas BrainTwo')
    const b = deterministicEmbedder('Ideas BrainTwo')
    expect(a).toHaveLength(VEC_DIM)
    expect(Array.from(a)).toEqual(Array.from(b))
  })

  it('lazy-initializes the supplied embedder only on first embed', async () => {
    const embedder = vi.fn(() => deterministicEmbedder('ok'))
    const service = createEmbeddingService({
      cacheDir: 'models',
      embedder,
      scheduler: (cb) => cb()
    })
    expect(service.getStatus().status).toBe('idle')
    await service.embed('hola')
    await service.embed('chau')
    expect(embedder).toHaveBeenCalledTimes(2)
    expect(service.getStatus().status).toBe('ready')
  })

  it('serializes queued embedding work', async () => {
    const order: string[] = []
    const service = createEmbeddingService({
      cacheDir: 'models',
      embedder: async (text) => {
        order.push(`start:${text}`)
        await Promise.resolve()
        order.push(`end:${text}`)
        return deterministicEmbedder(text)
      },
      scheduler: (cb) => cb()
    })
    await Promise.all([service.embed('a'), service.embed('b'), service.embed('c')])
    expect(order).toEqual(['start:a', 'end:a', 'start:b', 'end:b', 'start:c', 'end:c'])
  })

  it('reports fallback when the transformer pipeline cannot load', async () => {
    const progress = vi.fn()
    const service = createEmbeddingService({
      cacheDir: 'models',
      pipelineFactory: async () => {
        throw new Error('missing')
      },
      onProgress: progress,
      scheduler: (cb) => cb()
    })
    const vec = await service.embed('offline')
    expect(vec).toHaveLength(VEC_DIM)
    expect(service.getStatus().status).toBe('fallback')
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ status: 'fallback' }))
  })
})
