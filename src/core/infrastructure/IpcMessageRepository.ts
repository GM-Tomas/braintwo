import type { IMessageRepository } from '../ports/IMessageRepository'
import { MessageEntity } from '@shared/domain/message.entity'
import type { Unsubscribe } from '@shared/types'

export class IpcMessageRepository implements IMessageRepository {
  async getMessageCount(): Promise<number> {
    return window.braintwo.app.getMessageCount()
  }

  async getRecentMessages(limit: number): Promise<MessageEntity[]> {
    const raw = await window.braintwo.app.getRecentMessages(limit)
    return raw.map((msg) => new MessageEntity(msg))
  }

  async getMessageById(id: number): Promise<MessageEntity | null> {
    const raw = await window.braintwo.app.getMessageById(id)
    return raw ? new MessageEntity(raw) : null
  }

  onMessagesBatch(cb: (batch: MessageEntity[]) => void): Unsubscribe {
    return window.braintwo.app.onMessagesBatch((rawBatch) => {
      cb(rawBatch.map((msg) => new MessageEntity(msg)))
    })
  }
}
