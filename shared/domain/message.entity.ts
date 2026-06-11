import type { RecentMessage, MessageKind, MessageSource, MediaMeta } from '../types'
import { formatBytes, formatDuration } from './format'

export class MessageEntity {
  constructor(private readonly data: RecentMessage) {}

  get id(): number {
    return this.data.id
  }

  get waMsgId(): string {
    return this.data.wa_msg_id
  }

  get timestamp(): number {
    return this.data.timestamp
  }

  get text(): string {
    return this.data.text
  }

  get source(): MessageSource {
    return this.data.source
  }

  get kind(): MessageKind {
    return this.data.kind
  }

  get media(): MediaMeta | null {
    return this.data.media ?? null
  }

  get fromMe(): boolean {
    return !!this.data.fromMe
  }

  get createdAt(): number | undefined {
    return this.data.createdAt
  }

  get contextNote(): string | null {
    return this.data.contextNote ?? null
  }

  get ignored(): boolean {
    return !!this.data.ignored
  }

  getMediaSummary(): string {
    const m = this.media
    if (!m) return 'Sin contenido textual'
    const parts: string[] = []
    if (typeof m.durationSec === 'number' && m.durationSec > 0) {
      parts.push(formatDuration(m.durationSec))
    }
    if (m.fileName) parts.push(m.fileName)
    if (!m.fileName && typeof m.fileLengthBytes === 'number') {
      parts.push(formatBytes(m.fileLengthBytes))
    }
    if (m.ptt) parts.push('Nota de voz')
    if (m.transcript) parts.push(`"${m.transcript.slice(0, 60)}…"`)
    return parts.length ? parts.join(' · ') : 'Sin descripción'
  }
}

