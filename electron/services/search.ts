import type { DbInstance, KeywordResult, SimilarResult, MediaMeta } from './db'
import type { EmbeddingService } from './embeddings'
import type { SearchResult } from '@shared/types'

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
// Increased to 0.82 to filter out low-relevance false positives.
const MIN_SIMILARITY = 0.82

// Standard RRF constant — chosen to balance precision and recall across lists.
const RRF_K = 60

function filterByRelevance(candidates: SearchResult[]): SearchResult[] {
  // 1. Exclude absolute low relevance below the floor.
  const ABSOLUTE_FLOOR = 0.75
  const above = candidates.filter((r) => r.similarity >= ABSOLUTE_FLOOR)
  if (above.length === 0) return []

  // 2. Find the maximum similarity.
  const maxSim = Math.max(...above.map((r) => r.similarity))

  // If the absolute best match is below 0.84, it is generally considered noise.
  let allAreLowRelevance = false
  if (maxSim < 0.84) {
    allAreLowRelevance = true
  }

  // 3. Relative margin: exclude results that are significantly weaker than the best match.
  // For example, if maxSim = 0.92, we don't want to return 0.83 (diff = 0.09) as high relevance.
  // We use a relative margin of 0.05.
  const MARGIN = 0.05

  // 4. Tight cluster filter: if we have multiple results, but they are all very close to each other
  // and the best match is not exceptionally high (maxSim < 0.88), it suggests a flat distribution
  // of similarities indicating background noise.
  if (above.length >= 2 && maxSim < 0.88) {
    const mean = above.reduce((s, r) => s + r.similarity, 0) / above.length
    const variance = above.reduce((s, r) => s + (r.similarity - mean) ** 2, 0) / above.length
    const std = Math.sqrt(variance)

    // Standard deviation threshold: if less than 1.2% (0.012), it is a tight cluster of noise.
    if (std < 0.012) {
      allAreLowRelevance = true
    }
  }

  return above.map((r) => {
    const isLow =
      allAreLowRelevance ||
      r.similarity < MIN_SIMILARITY ||
      r.similarity < maxSim - MARGIN

    return {
      ...r,
      lowRelevance: isLow
    }
  })
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
      data.set(r.id, keywordToSearchResult(r))
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
  const cosineSim = 1 - (row.distance * row.distance) / 2
  let media: MediaMeta | null = null
  if (row.media_meta) {
    try {
      media = JSON.parse(row.media_meta) as MediaMeta
    } catch {
      media = null
    }
  }
  return {
    id: row.id,
    wa_msg_id: row.wa_msg_id,
    timestamp: row.timestamp,
    text: row.text,
    source: row.source,
    kind: row.kind,
    media,
    fromMe: row.from_me === 1,
    createdAt: row.created_at != null ? row.created_at * 1000 : undefined,
    contextNote: row.context_note ?? null,
    distance: row.distance,
    similarity: Math.max(0, Math.min(1, cosineSim)),
    matchSource: 'semantic'
  }
}

function keywordToSearchResult(row: KeywordResult): SearchResult {
  let media: MediaMeta | null = null
  if (row.media_meta) {
    try {
      media = JSON.parse(row.media_meta) as MediaMeta
    } catch {
      media = null
    }
  }
  return {
    id: row.id,
    wa_msg_id: row.wa_msg_id,
    timestamp: row.timestamp,
    text: row.text,
    source: row.source,
    kind: row.kind,
    media,
    fromMe: row.from_me === 1,
    createdAt: row.created_at != null ? row.created_at * 1000 : undefined,
    contextNote: row.context_note ?? null,
    distance: 0,
    similarity: 0,
    matchSource: 'keyword'
  }
}
