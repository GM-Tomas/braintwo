import type { IMessageRepository } from './IMessageRepository'
import type { IngestPipeline, RecentMessage } from '../services/ingest'

export class SqliteMessageRepository implements IMessageRepository {
  constructor(private readonly ingest: IngestPipeline) {}

  getMessageCount(): number {
    return this.ingest.count()
  }

  getRecentMessages(limit: number): RecentMessage[] {
    return this.ingest.recent(limit)
  }

  getMessageById(id: number): RecentMessage | null {
    return this.ingest.getById(id)
  }
}
