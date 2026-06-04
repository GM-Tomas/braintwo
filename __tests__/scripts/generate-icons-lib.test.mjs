import { describe, it, expect } from 'vitest'
import {
  crc32,
  chunk,
  createPng,
  brainTwoIcon,
  readPngHeader,
  PNG_SIGNATURE,
  BRAND_BG,
  BRAND_PRIMARY,
  BRAND_ACCENT
} from '../../scripts/generate-icons-lib.mjs'

describe('generate-icons-lib', () => {
  describe('crc32', () => {
    it('matches RFC 1952 reference vector for "123456789"', () => {
      // Standard CRC-32/IEEE check value
      const buf = Buffer.from('123456789', 'ascii')
      expect(crc32(buf)).toBe(0xcbf43926)
    })

    it('crc32 of empty buffer is 0', () => {
      expect(crc32(Buffer.alloc(0))).toBe(0)
    })

    it('produces stable output for fixed input', () => {
      expect(crc32(Buffer.from([0x01, 0x02, 0x03, 0x04]))).toBe(crc32(Buffer.from([0x01, 0x02, 0x03, 0x04])))
    })
  })

  describe('chunk', () => {
    it('emits length + type + data + crc', () => {
      const data = Buffer.from([0xaa, 0xbb])
      const c = chunk('IEND', data)
      // Layout: 4-byte length, 4-byte type, data, 4-byte CRC
      expect(c.length).toBe(4 + 4 + data.length + 4)
      expect(c.readUInt32BE(0)).toBe(data.length)
      expect(c.subarray(4, 8).toString('ascii')).toBe('IEND')
      expect(c.subarray(8, 8 + data.length)).toEqual(data)
    })

    it('CRC includes the type bytes', () => {
      // Same data with different chunk types yields different CRCs
      const data = Buffer.from([0x01])
      const a = chunk('IHDR', data)
      const b = chunk('IDAT', data)
      expect(a.subarray(-4)).not.toEqual(b.subarray(-4))
    })
  })

  describe('createPng', () => {
    it('starts with the PNG signature', () => {
      const png = createPng(8, () => [0xff, 0xff, 0xff, 0xff])
      expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE)
    })

    it('encodes width and height in the IHDR chunk', () => {
      const png = createPng(32, () => [0, 0, 0, 0xff])
      const header = readPngHeader(png)
      expect(header.width).toBe(32)
      expect(header.height).toBe(32)
      expect(header.bitDepth).toBe(8)
      expect(header.colorType).toBe(6) // RGBA
    })

    it.each([1, 16, 32, 48, 64, 256])('produces a valid header for %dx%d', (size) => {
      const png = createPng(size, () => BRAND_BG)
      const header = readPngHeader(png)
      expect(header.width).toBe(size)
      expect(header.height).toBe(size)
    })

    it('passes (x, y, size) to the draw callback for every pixel', () => {
      const seen = new Set()
      createPng(4, (x, y, size) => {
        seen.add(`${x},${y},${size}`)
        return [0, 0, 0, 0xff]
      })
      expect(seen.size).toBe(16) // 4 × 4
      expect(seen.has('0,0,4')).toBe(true)
      expect(seen.has('3,3,4')).toBe(true)
    })

    it('ends with the IEND chunk', () => {
      const png = createPng(2, () => [0, 0, 0, 0xff])
      // last 12 bytes = IEND chunk: 4 length + IEND + 4 CRC
      const tail = png.subarray(-12)
      expect(tail.subarray(4, 8).toString('ascii')).toBe('IEND')
    })
  })

  describe('brainTwoIcon', () => {
    it('returns transparent pixels outside the rounded square corners', () => {
      // Top-left corner of a 32x32 icon: outside the rounded boundary
      const px = brainTwoIcon(0, 0, 32)
      expect(px).toEqual([0, 0, 0, 0])
    })

    it('returns the primary color in the center disc', () => {
      const px = brainTwoIcon(16, 16, 32)
      expect(px).toEqual(BRAND_PRIMARY)
    })

    it('returns the accent color inside the upper-right dot', () => {
      // accentCx = 16 + 32*0.22 ≈ 23, accentCy = 16 - 32*0.22 ≈ 9
      const px = brainTwoIcon(23, 9, 32)
      expect(px).toEqual(BRAND_ACCENT)
    })

    it('returns the bg color in the body but outside the disc/accent', () => {
      // Pick a pixel that is inside the rounded square, far from both center
      // and accent dot — bottom-left mid-region.
      const px = brainTwoIcon(6, 25, 32)
      expect(px).toEqual(BRAND_BG)
    })

    it('produces all four palette colors at scale 256', () => {
      const palette = new Set()
      const png = createPng(256, (x, y, size) => {
        const px = brainTwoIcon(x, y, size)
        palette.add(px.join(','))
        return px
      })
      expect(png.length).toBeGreaterThan(0)
      expect(palette.has([0, 0, 0, 0].join(','))).toBe(true)
      expect(palette.has(BRAND_BG.join(','))).toBe(true)
      expect(palette.has(BRAND_PRIMARY.join(','))).toBe(true)
      expect(palette.has(BRAND_ACCENT.join(','))).toBe(true)
    })
  })

  describe('readPngHeader (test util)', () => {
    it('throws on non-PNG buffer', () => {
      expect(() => readPngHeader(Buffer.alloc(30, 0))).toThrow(/PNG signature/)
    })

    it('throws on too-short buffer', () => {
      expect(() => readPngHeader(Buffer.alloc(10, 0))).toThrow(/too short/)
    })
  })
})
