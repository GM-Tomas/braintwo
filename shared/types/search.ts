import type { RecentMessage } from './messages'

export interface SearchResult extends RecentMessage {
  distance: number
  similarity: number
  matchSource?: 'semantic' | 'keyword' | 'both'
  lowRelevance?: boolean
}

export interface ModelProgress {
  status: 'idle' | 'downloading' | 'ready' | 'fallback' | 'error'
  message?: string
  progress?: number
}
