export type MessageSource = 'export' | 'history-sync' | 'realtime' | 'offline-sync'

export type MessageKind =
  | 'text'
  | 'audio'
  | 'image'
  | 'video'
  | 'document'
  | 'sticker'
  | 'other'

export interface MediaMeta {
  durationSec?: number
  fileName?: string
  fileLengthBytes?: number
  mimetype?: string
  /** Pre-existing transcript / OCR if WhatsApp/Baileys provided one. */
  transcript?: string
  /** True if the audio came as a voice note (push-to-talk) vs a regular file. */
  ptt?: boolean
  /** Local path to a temporary audio file (set during Groq transcription). */
  audioLocalPath?: string
  /** Local path to the stored image file (set on image ingest, for viewing). */
  imageLocalPath?: string
  /** Original caption the user sent with the image (the message `text` ends up
   *  combined with the AI description, so this preserves the user's own text). */
  caption?: string
  /** AI-generated description of the image content (for search + chat). */
  visionDescription?: string
}

export interface RecentMessage {
  id: number
  wa_msg_id: string
  timestamp: number
  text: string
  source: MessageSource
  kind: MessageKind
  media?: MediaMeta | null
  fromMe?: boolean
  createdAt?: number
  contextNote?: string | null
  ignored?: boolean
}
