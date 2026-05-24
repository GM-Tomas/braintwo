import type { SearchResult, ModelProgress, Unsubscribe } from '@shared/types'

export interface ISearchService {
  query(text: string, k?: number): Promise<SearchResult[]>
  onModelProgress(cb: (progress: ModelProgress) => void): Unsubscribe
}
