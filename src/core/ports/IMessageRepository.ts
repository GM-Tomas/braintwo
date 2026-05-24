import { MessageEntity } from '@shared/domain/message.entity'
import type { Unsubscribe } from '@shared/types'

export interface IMessageRepository {
  getMessageCount(): Promise<number>
  getRecentMessages(limit: number): Promise<MessageEntity[]>
  onMessagesBatch(cb: (batch: MessageEntity[]) => void): Unsubscribe
}
