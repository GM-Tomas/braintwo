// Pure PNG generator helpers — exported so they can be unit-tested without
// touching the filesystem.
import { deflateSync } from 'node:zlib'

export const BRAND_BG = [0x06, 0x0a, 0x12, 0xff]
export const BRAND_PRIMARY = [0x1a, 0x8f, 0xe3, 0xff]
export const BRAND_ACCENT = [0x2e, 0xc4, 0xa5, 0xff]
export const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(buf) {
  let crc = 0xffffffff
  for (const b of buf) crc = (crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8)) >>> 0
  return (crc ^ 0xffffffff) >>> 0
}

export function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

export function createPng(size, draw) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const rowLen = size * 4 + 1
  const raw = Buffer.alloc(rowLen * size)
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0
    for (let x = 0; x < size; x++) {
      const off = y * rowLen + 1 + x * 4
      const px = draw(x, y, size)
      raw[off] = px[0]
      raw[off + 1] = px[1]
      raw[off + 2] = px[2]
      raw[off + 3] = px[3]
    }
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

export function brainTwoIcon(x, y, size) {
  const cx = size / 2
  const cy = size / 2
  const dx = x - cx
  const dy = y - cy
  const distCenter = Math.sqrt(dx * dx + dy * dy)

  const cornerRadius = size * 0.22
  const half = size / 2 - 0.5
  const ax = Math.abs(x - cx + 0.5) - (half - cornerRadius)
  const ay = Math.abs(y - cy + 0.5) - (half - cornerRadius)
  const cornerDist = Math.sqrt(Math.max(ax, 0) ** 2 + Math.max(ay, 0) ** 2)
  if (cornerDist > cornerRadius + 0.5) return [0, 0, 0, 0]

  const accentR = size * 0.16
  const accentCx = cx + size * 0.22
  const accentCy = cy - size * 0.22
  const accentD = Math.sqrt((x - accentCx) ** 2 + (y - accentCy) ** 2)
  if (accentD < accentR) return BRAND_ACCENT

  if (distCenter < size * 0.34) return BRAND_PRIMARY
  return BRAND_BG
}

export function readPngHeader(buf) {
  if (buf.length < 24) throw new Error('buffer too short')
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== PNG_SIGNATURE[i]) throw new Error('invalid PNG signature')
  }
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const bitDepth = buf[24]
  const colorType = buf[25]
  return { width, height, bitDepth, colorType }
}
