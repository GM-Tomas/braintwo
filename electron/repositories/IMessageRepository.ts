import type { RecentMessage } from '../services/ingest'

export interface IMessageRepository {
  getMessageCount(): number
  getRecentMessages(limit: number): RecentMessage[]
}
