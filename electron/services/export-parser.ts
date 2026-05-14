import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { DbInstance, InsertResult } from './db'

export interface ParsedMessage {
  timestamp: number
  sender: string
  text: string
}

export interface ImportProgress {
  processed: number
  total: number
  inserted: number
  skipped: number
  done: boolean
}

export interface ExportImportDeps {
  db: DbInstance
  onProgress?: (progress: ImportProgress) => void
  scheduler?: (cb: () => void) => unknown
  batchSize?: number
}

const ANDROID_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AP]\.?M\.?))?\s+-\s+([^:]+):\s([\s\S]*)$/i
const IOS_RE = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AP]\.?M\.?))?\]\s([^:]+):\s([\s\S]*)$/i

const SYSTEM_PATTERNS = [
  /mensajes y llamadas.*cifrados/i,
  /messages and calls.*end-to-end encrypted/i,
  /cambi[oó] su n[uú]mero/i,
  /changed their phone number/i,
  /creaste el grupo/i,
  /created group/i,
  /<multimedia omitido>/i,
  /<media omitted>/i,
  /se omiti[oó] multimedia/i
]

export function parseWhatsAppExport(content: string): ParsedMessage[] {
  const out: ParsedMessage[] = []
  let current: ParsedMessage | null = null

  for (const line of content.replace(/\r\n/g, '\n').split('\n')) {
    const parsed = parseLine(line)
    if (parsed) {
      if (current && shouldKeep(current.text)) out.push(current)
      current = parsed
      continue
    }
    if (current) {
      current.text = `${current.text}\n${line}`.trim()
    }
  }

  if (current && shouldKeep(current.text)) out.push(current)
  return out
}

export async function importExportFile(
  filePath: string,
  deps: ExportImportDeps
): Promise<ImportProgress> {
  const content = await readFile(filePath, 'utf8')
  return ingestFromExport(parseWhatsAppExport(content), deps)
}

export async function ingestFromExport(
  messages: ParsedMessage[],
  deps: ExportImportDeps
): Promise<ImportProgress> {
  const schedule = deps.scheduler ?? ((cb) => setImmediate(cb))
  const batchSize = deps.batchSize ?? 50
  const progress: ImportProgress = {
    processed: 0,
    total: messages.length,
    inserted: 0,
    skipped: 0,
    done: false
  }
  const publish = (): void => deps.onProgress?.({ ...progress })

  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize)
    for (const msg of batch) {
      const result = insertParsedMessage(deps.db, msg)
      progress.processed++
      if (result.inserted) progress.inserted++
      else progress.skipped++
    }
    publish()
    await new Promise<void>((resolve) => schedule(resolve))
  }

  progress.done = true
  publish()
  return progress
}

function insertParsedMessage(db: DbInstance, msg: ParsedMessage): InsertResult {
  return db.insertMessage({
    wa_msg_id: syntheticExportId(msg),
    timestamp: msg.timestamp,
    text: msg.text,
    source: 'export',
    kind: 'text',
    from_me: isSelfSender(msg.sender),
    raw_json: JSON.stringify(msg)
  })
}

export function syntheticExportId(msg: ParsedMessage): string {
  const sha = createHash('sha1')
    .update(`${msg.timestamp}|${msg.text}`)
    .digest('hex')
    .slice(0, 24)
  return `export:${sha}`
}

function parseLine(line: string): ParsedMessage | null {
  const match = line.match(ANDROID_RE) ?? line.match(IOS_RE)
  if (!match) return null
  const [, day, month, year, hour, minute, second, meridiem, sender, text] = match
  const timestamp = toTimestamp(
    Number(day),
    Number(month),
    normalizeYear(Number(year)),
    Number(hour),
    Number(minute),
    Number(second ?? 0),
    meridiem
  )
  return {
    timestamp,
    sender: (sender ?? '').trim(),
    text: (text ?? '').trim()
  }
}

function toTimestamp(
  day: number,
  month: number,
  year: number,
  hour: number,
  minute: number,
  second: number,
  meridiem: string | undefined
): number {
  let h = hour
  if (meridiem) {
    const normalized = meridiem.replace(/\./g, '').toUpperCase()
    if (normalized === 'PM' && h < 12) h += 12
    if (normalized === 'AM' && h === 12) h = 0
  }
  return new Date(year, month - 1, day, h, minute, second).getTime()
}

function normalizeYear(year: number): number {
  if (year >= 100) return year
  return year >= 70 ? 1900 + year : 2000 + year
}

function shouldKeep(text: string): boolean {
  const clean = text.trim()
  if (!clean) return false
  return !SYSTEM_PATTERNS.some((re) => re.test(clean))
}

function isSelfSender(sender: string): boolean {
  return /^(vos|you|me|yo)$/i.test(sender.trim())
}
