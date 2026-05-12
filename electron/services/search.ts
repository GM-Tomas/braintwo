import type { DbInstance, SimilarResult } from './db'
import type { EmbeddingService } from './embeddings'

export interface SearchResult extends SimilarResult {
  similarity: number
}

export interface SearchService {
  query: (text: string, k?: number) => Promise<SearchResult[]>
  backfillMissing: (limit?: number) => Promise<{ processed: number; inserted: number }>
}

export interface SearchServiceDeps {
  db: DbInstance
  embeddings: EmbeddingService
  scheduler?: (cb: () => void) => unknown
  batchSize?: number
}

// Absolute floor calibrated for multilingual-e5-small with asymmetric query/passage encoding.
// Empirically, unrelated short texts score ~0.82; genuine matches score 0.85+.
const MIN_SIMILARITY = 0.83

// When many results pass the floor, also require them to stand out from their own
// average (mean + Z × σ). This catches cases where k-NN returns a cluster of
// moderately-similar results that are all equally irrelevant.
const ADAPTIVE_Z = 0.6

function filterByRelevance(candidates: SearchResult[]): SearchResult[] {
  const above = candidates.filter((r) => r.similarity >= MIN_SIMILARITY)
  if (above.length < 4) return above
  const mean = above.reduce((s, r) => s + r.similarity, 0) / above.length
  const variance = above.reduce((s, r) => s + (r.similarity - mean) ** 2, 0) / above.length
  const std = Math.sqrt(variance)
  // Only apply adaptive filter when there is meaningful spread in the scores.
  if (std < 0.015) return above
  return above.filter((r) => r.similarity >= mean + ADAPTIVE_Z * std)
}

export function createSearchService(deps: SearchServiceDeps): SearchService {
  const schedule = deps.scheduler ?? ((cb) => setImmediate(cb))
  const batchSize = deps.batchSize ?? 50

  async function yieldTick(): Promise<void> {
    await new Promise<void>((resolve) => {
      schedule(resolve)
    })
  }

  return {
    async query(text, k = 12) {
      const clean = text.trim()
      if (!clean) return []
      const queryVec = await deps.embeddings.embed(clean, 'query')
      const candidates = deps.db.searchSimilar(queryVec, Math.max(1, Math.min(k, 50))).map(toSearchResult)
      return filterByRelevance(candidates)
    },

    async backfillMissing(limit = 500) {
      const rows = deps.db.listMessagesWithoutEmbeddings(limit)
      let processed = 0
      let inserted = 0
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        for (const row of batch) {
          processed++
          try {
            const vec = await deps.embeddings.embed(row.text)
            deps.db.insertEmbedding(row.id, vec)
            inserted++
          } catch {
            // Another path may have embedded this row meanwhile. Keep backfill best-effort.
          }
        }
        await yieldTick()
      }
      return { processed, inserted }
    }
  }
}

function toSearchResult(row: SimilarResult): SearchResult {
  // sqlite-vec returns L2 distance; for normalized unit vectors: cos_sim = 1 - L2²/2
  const cosineSim = 1 - (row.distance * row.distance) / 2
  return {
    ...row,
    similarity: Math.max(0, Math.min(1, cosineSim))
  }
}
