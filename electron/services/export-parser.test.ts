import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openDatabase, type DbInstance } from './db'
import {
  ingestFromExport,
  parseWhatsAppExport,
  syntheticExportId
} from './export-parser'

describe('WhatsApp export parser', () => {
  let db: DbInstance

  beforeEach(() => {
    db = openDatabase(':memory:')
  })

  afterEach(() => {
    db.close()
  })

  it('parses Android lines and multiline continuations', () => {
    const rows = parseWhatsAppExport(
      '16/3/2024, 14:32 - Vos: primera linea\nsegunda linea\n16/3/2024, 14:33 - Ana: respuesta'
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]!.sender).toBe('Vos')
    expect(rows[0]!.text).toBe('primera linea\nsegunda linea')
  })

  it('parses iOS bracketed lines', () => {
    const rows = parseWhatsAppExport('[16/3/2024, 14:32:15] You: hello')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.sender).toBe('You')
    expect(rows[0]!.text).toBe('hello')
  })

  it('filters system and omitted-media lines', () => {
    const rows = parseWhatsAppExport(
      '16/3/2024, 14:32 - Vos: <Multimedia omitido>\n16/3/2024, 14:33 - Vos: mensaje real'
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text).toBe('mensaje real')
  })

  it('uses deterministic synthetic ids so re-import skips duplicates', async () => {
    const rows = parseWhatsAppExport('16/3/2024, 14:32 - Vos: mensaje real')
    expect(syntheticExportId(rows[0]!)).toMatch(/^export:[a-f0-9]{24}$/)
    const first = await ingestFromExport(rows, { db, scheduler: (cb) => cb() })
    const second = await ingestFromExport(rows, { db, scheduler: (cb) => cb() })
    expect(first.inserted).toBe(1)
    expect(second.inserted).toBe(0)
    expect(second.skipped).toBe(1)
    expect(db.countMessages()).toBe(1)
  })

  it('emits progress once per batch and at completion', async () => {
    const progress = vi.fn()
    const rows = parseWhatsAppExport(
      '16/3/2024, 14:32 - Vos: uno\n16/3/2024, 14:33 - Vos: dos'
    )
    await ingestFromExport(rows, {
      db,
      batchSize: 1,
      scheduler: (cb) => cb(),
      onProgress: progress
    })
    expect(progress).toHaveBeenLastCalledWith(
      expect.objectContaining({ processed: 2, total: 2, done: true })
    )
  })
})
