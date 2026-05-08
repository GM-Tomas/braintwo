import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createIngestPipeline,
  extractText,
  extractTimestampMs,
  type WAMessageLike
} from './ingest'
import { openDatabase, type DbInstance } from './db'

const baseMsg = (overrides: Partial<WAMessageLike> = {}): WAMessageLike => ({
  key: { id: 'wa-1', remoteJid: '123@s.whatsapp.net', fromMe: true },
  messageTimestamp: 1_700_000_000,
  message: { conversation: 'hola' },
  ...overrides
})

describe('extractText', () => {
  it('reads .conversation', () => {
    expect(extractText(baseMsg({ message: { conversation: 'hi' } }))).toBe('hi')
  })

  it('reads .extendedTextMessage.text', () => {
    expect(
      extractText(
        baseMsg({ message: { extendedTextMessage: { text: 'extended' } } })
      )
    ).toBe('extended')
  })

  it('reads image caption', () => {
    expect(
      extractText(
        baseMsg({ message: { imageMessage: { caption: 'photo desc' } } })
      )
    ).toBe('photo desc')
  })

  it('reads video caption', () => {
    expect(
      extractText(
        baseMsg({ message: { videoMessage: { caption: 'clip' } } })
      )
    ).toBe('clip')
  })

  it('reads document caption', () => {
    expect(
      extractText(
        baseMsg({
          message: { documentMessage: { caption: 'doc-cap' } }
        })
      )
    ).toBe('doc-cap')
  })

  it('reads documentWithCaptionMessage nested caption', () => {
    expect(
      extractText(
        baseMsg({
          message: {
            documentWithCaptionMessage: {
              message: { documentMessage: { caption: 'nested cap' } }
            }
          }
        })
      )
    ).toBe('nested cap')
  })

  it('unwraps ephemeralMessage envelope', () => {
    expect(
      extractText(
        baseMsg({
          message: {
            ephemeralMessage: { message: { conversation: 'eph' } }
          }
        })
      )
    ).toBe('eph')
  })

  it('unwraps viewOnceMessage envelope', () => {
    expect(
      extractText(
        baseMsg({
          message: {
            viewOnceMessage: {
              message: { extendedTextMessage: { text: 'one-shot' } }
            }
          }
        })
      )
    ).toBe('one-shot')
  })

  it('trims whitespace', () => {
    expect(
      extractText(baseMsg({ message: { conversation: '   spaced   ' } }))
    ).toBe('spaced')
  })

  it('returns empty string when message is null', () => {
    expect(extractText({ ...baseMsg(), message: null })).toBe('')
  })

  it('returns empty string when no text variant present', () => {
    expect(
      extractText(
        baseMsg({
          message: {
            imageMessage: { caption: null },
            videoMessage: { caption: null }
          }
        })
      )
    ).toBe('')
  })

  it('prefers conversation over caption when both present', () => {
    expect(
      extractText(
        baseMsg({
          message: {
            conversation: 'plain',
            imageMessage: { caption: 'cap' }
          }
        })
      )
    ).toBe('plain')
  })
})

describe('extractTimestampMs', () => {
  it('multiplies plain number seconds by 1000', () => {
    expect(extractTimestampMs(baseMsg({ messageTimestamp: 1700 }))).toBe(
      1_700_000
    )
  })

  it('reads Long-shaped objects via .low', () => {
    expect(
      extractTimestampMs(
        baseMsg({ messageTimestamp: { low: 1_700_000_000, unsigned: false } })
      )
    ).toBe(1_700_000_000_000)
  })

  it('falls back to Date.now when timestamp missing or NaN', () => {
    const t0 = Date.now() - 1
    const r = extractTimestampMs({ ...baseMsg(), messageTimestamp: null })
    expect(r).toBeGreaterThanOrEqual(t0)

    const r2 = extractTimestampMs({
      ...baseMsg(),
      messageTimestamp: Number.NaN
    })
    expect(r2).toBeGreaterThanOrEqual(t0)
  })
})

describe('createIngestPipeline', () => {
  let db: DbInstance
  let logger: {
    info: ReturnType<typeof vi.fn>
    debug: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    db = openDatabase(':memory:')
    logger = { info: vi.fn(), debug: vi.fn() }
  })

  afterEach(() => {
    db.close()
  })

  it('inserts a valid message and returns rowId', () => {
    const p = createIngestPipeline(db, logger as never)
    const r = p.ingest(baseMsg(), 'realtime')
    expect(r.inserted).toBe(true)
    expect(r.rowId).toBeGreaterThan(0)
    expect(p.count()).toBe(1)
  })

  it('skips messages without a wa_msg_id', () => {
    const p = createIngestPipeline(db, logger as never)
    const r = p.ingest(
      { ...baseMsg(), key: { id: null, remoteJid: '123@s.whatsapp.net' } },
      'realtime'
    )
    expect(r.inserted).toBe(false)
    expect(r.skipped).toBe('no-id')
    expect(p.count()).toBe(0)
    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'realtime' }),
      expect.stringContaining('no wa_msg_id')
    )
  })

  it('captures media-only messages without caption (kind preserved)', () => {
    const p = createIngestPipeline(db, logger as never)
    const r = p.ingest(
      baseMsg({ message: { imageMessage: { caption: null } } }),
      'realtime'
    )
    expect(r.inserted).toBe(true)
    expect(r.kind).toBe('image')
    expect(p.count()).toBe(1)
  })

  it('captures voice notes (audio only) and stores ptt + duration meta', () => {
    const p = createIngestPipeline(db, logger as never)
    const r = p.ingest(
      baseMsg({
        key: { id: 'voice-1' },
        message: {
          audioMessage: {
            seconds: 12,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
          }
        }
      }),
      'realtime'
    )
    expect(r.inserted).toBe(true)
    expect(r.kind).toBe('audio')
    const row = db.raw
      .prepare('SELECT kind, media_meta, text FROM messages WHERE wa_msg_id = ?')
      .get('voice-1') as { kind: string; media_meta: string; text: string }
    expect(row.kind).toBe('audio')
    expect(row.text).toBe('')
    const meta = JSON.parse(row.media_meta) as Record<string, unknown>
    expect(meta.durationSec).toBe(12)
    expect(meta.ptt).toBe(true)
    expect(meta.mimetype).toBe('audio/ogg; codecs=opus')
  })

  it('skips fully-empty messages (no text, no media, unknown kind) as "empty"', () => {
    const p = createIngestPipeline(db, logger as never)
    const r = p.ingest(
      { ...baseMsg(), message: null },
      'realtime'
    )
    expect(r.inserted).toBe(false)
    expect(r.skipped).toBe('empty')
    expect(p.count()).toBe(0)
  })

  it('returns duplicate when wa_msg_id already exists', () => {
    const p = createIngestPipeline(db, logger as never)
    p.ingest(baseMsg({ key: { id: 'dup' } }), 'realtime')
    const second = p.ingest(
      baseMsg({ key: { id: 'dup' }, message: { conversation: 'second body' } }),
      'realtime'
    )
    expect(second.inserted).toBe(false)
    expect(second.skipped).toBe('duplicate')
    expect(p.count()).toBe(1)
  })

  it('logs an info event with text_preview on first ingest', () => {
    const p = createIngestPipeline(db, logger as never)
    p.ingest(baseMsg({ message: { conversation: 'hello world' } }), 'realtime')
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        wa_msg_id: 'wa-1',
        source: 'realtime',
        text_preview: 'hello world'
      }),
      'message ingested'
    )
  })

  it('truncates the text_preview log field at 80 chars', () => {
    const long = 'x'.repeat(200)
    const p = createIngestPipeline(db, logger as never)
    p.ingest(baseMsg({ message: { conversation: long } }), 'realtime')
    const call = logger.info.mock.calls[0]!
    expect((call[0] as { text_preview: string }).text_preview).toHaveLength(80)
  })

  it('persists raw_json verbatim', () => {
    const p = createIngestPipeline(db)
    const msg = baseMsg({ key: { id: 'raw-1' } })
    p.ingest(msg, 'realtime')
    const row = db.raw
      .prepare('SELECT raw_json FROM messages WHERE wa_msg_id = ?')
      .get('raw-1') as { raw_json: string }
    expect(JSON.parse(row.raw_json)).toEqual(msg)
  })

  it('source label propagates to the row', () => {
    const p = createIngestPipeline(db)
    p.ingest(baseMsg({ key: { id: 'src-1' } }), 'history-sync')
    const row = db.raw
      .prepare('SELECT source FROM messages WHERE wa_msg_id = ?')
      .get('src-1') as { source: string }
    expect(row.source).toBe('history-sync')
  })

  it('works without a logger', () => {
    const p = createIngestPipeline(db)
    expect(() => p.ingest(baseMsg(), 'realtime')).not.toThrow()
  })

  describe('recent', () => {
    it('returns up to N most recent messages, newest first', () => {
      const p = createIngestPipeline(db)
      for (let i = 0; i < 5; i++) {
        p.ingest(
          baseMsg({
            key: { id: `r${i}` },
            messageTimestamp: 1_700_000_000 + i,
            message: { conversation: `m${i}` }
          }),
          'realtime'
        )
      }
      const r = p.recent(3)
      expect(r).toHaveLength(3)
      expect(r.map((x) => x.text)).toEqual(['m4', 'm3', 'm2'])
    })

    it('returns [] when limit ≤ 0', () => {
      const p = createIngestPipeline(db)
      p.ingest(baseMsg(), 'realtime')
      expect(p.recent(0)).toEqual([])
      expect(p.recent(-3)).toEqual([])
    })

    it('returns [] when no messages', () => {
      const p = createIngestPipeline(db)
      expect(p.recent(10)).toEqual([])
    })
  })

  describe('count', () => {
    it('matches inserted rows', () => {
      const p = createIngestPipeline(db)
      expect(p.count()).toBe(0)
      for (let i = 0; i < 4; i++) {
        p.ingest(baseMsg({ key: { id: `c${i}` } }), 'realtime')
      }
      expect(p.count()).toBe(4)
    })

    it('does NOT count duplicates', () => {
      const p = createIngestPipeline(db)
      p.ingest(baseMsg({ key: { id: 'same' } }), 'realtime')
      p.ingest(baseMsg({ key: { id: 'same' } }), 'realtime')
      expect(p.count()).toBe(1)
    })
  })
})
