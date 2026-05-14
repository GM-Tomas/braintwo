import type { DbInstance, KeywordResult, SimilarResult } from './db'
import type { EmbeddingService } from './embeddings'

export interface SearchResult extends SimilarResult {
  similarity: number
  matchSource: 'semantic' | 'keyword' | 'both'
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

// Floor calibrated for multilingual-e5-small with short WhatsApp messages.
// Short texts (2-8 words) compress scores to 0.74-0.87; the true noise floor
// sits around 0.75 and genuine matches start around 0.78+.
const MIN_SIMILARITY = 0.77

// Adaptive Z-filter: when many candidates pass the floor, require them to
// stand out from the group's mean by at least Z × σ. Higher value = stricter.
// Set higher than before because we lowered the floor, so we need the adaptive
// filter to do more heavy lifting when there's a large candidate pool.
const ADAPTIVE_Z = 1.0

// Apply adaptive filter even when score spread is small (compressed scores from
// short texts). Previous threshold was 0.015; lower value = filter applies more.
const ADAPTIVE_STD_FLOOR = 0.005

// Standard RRF constant — chosen to balance precision and recall across lists.
const RRF_K = 60

function filterByRelevance(candidates: SearchResult[]): SearchResult[] {
  const above = candidates.filter((r) => r.similarity >= MIN_SIMILARITY)
  if (above.length < 4) return above
  const mean = above.reduce((s, r) => s + r.similarity, 0) / above.length
  const variance = above.reduce((s, r) => s + (r.similarity - mean) ** 2, 0) / above.length
  const std = Math.sqrt(variance)
  if (std < ADAPTIVE_STD_FLOOR) return above
  return above.filter((r) => r.similarity >= mean + ADAPTIVE_Z * std)
}

function applyRRF(
  vecResults: SearchResult[],
  kwResults: KeywordResult[],
  topK: number
): SearchResult[] {
  const scores = new Map<number, number>()
  const data = new Map<number, SearchResult>()

  for (let i = 0; i < vecResults.length; i++) {
    const r = vecResults[i]!
    scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (RRF_K + i + 1))
    data.set(r.id, { ...r, matchSource: 'semantic' })
  }

  for (let i = 0; i < kwResults.length; i++) {
    const r = kwResults[i]!
    const prev = scores.get(r.id) ?? 0
    scores.set(r.id, prev + 1 / (RRF_K + i + 1))
    if (data.has(r.id)) {
      data.get(r.id)!.matchSource = 'both'
    } else {
      // keyword-only hit: build a SearchResult with neutral similarity values
      data.set(r.id, {
        id: r.id,
        wa_msg_id: r.wa_msg_id,
        timestamp: r.timestamp,
        text: r.text,
        source: r.source,
        kind: r.kind,
        distance: 0,
        similarity: 0,
        matchSource: 'keyword'
      })
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([id]) => data.get(id)!)
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

      // Run embedding + keyword search concurrently
      const [queryVec, kwResults] = await Promise.all([
        deps.embeddings.embed(clean, 'query'),
        Promise.resolve(deps.db.searchKeyword(clean, k * 3))
      ])

      const vecCandidates = deps.db
        .searchSimilar(queryVec, Math.max(1, Math.min(k * 3, 150)))
        .map(toSearchResult)
      const filteredVec = filterByRelevance(vecCandidates)

      return applyRRF(filteredVec, kwResults, k)
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
            const embedText = row.context_note
              ? `${row.context_note}\n${row.text}`
              : row.text
            const vec = await deps.embeddings.embed(embedText.trim() || row.text)
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
    similarity: Math.max(0, Math.min(1, cosineSim)),
    matchSource: 'semantic'
  }
}
