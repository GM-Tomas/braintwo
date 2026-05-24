import type { ISearchService } from '../ports/ISearchService'
import type { SearchResult, ModelProgress, Unsubscribe } from '@shared/types'

export class IpcSearchService implements ISearchService {
  async query(text: string, k?: number): Promise<SearchResult[]> {
    return window.braintwo.search.query(text, k)
  }

  onModelProgress(cb: (progress: ModelProgress) => void): Unsubscribe {
    return window.braintwo.search.onModelProgress(cb)
  }
}
