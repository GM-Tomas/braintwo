import type { RecentMessage } from '../services/ingest'

export interface IMessageRepository {
  getMessageCount(): number
  getRecentMessages(limit: number): RecentMessage[]
  getMessageById(id: number): RecentMessage | null
  getMessagesSince(timestampMs: number, limit: number): RecentMessage[]
  getReminderCandidates(sinceMs: number, limit: number): RecentMessage[]
  toggleIgnored(id: number): boolean
  getIgnoredIds(): number[]
}
