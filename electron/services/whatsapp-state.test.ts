import { describe, it, expect } from 'vitest'
import {
  deriveTransition,
  nextBackoff,
  isLoggedOutCode,
  LOGGED_OUT_CODE,
  type RawConnectionUpdate
} from './whatsapp-state'

describe('whatsapp-state', () => {
  describe('isLoggedOutCode', () => {
    it('returns true for 401', () => {
      expect(isLoggedOutCode(LOGGED_OUT_CODE)).toBe(true)
      expect(isLoggedOutCode(401)).toBe(true)
    })

    it('returns false for other disconnect codes', () => {
      expect(isLoggedOutCode(undefined)).toBe(false)
      expect(isLoggedOutCode(500)).toBe(false)
      expect(isLoggedOutCode(515)).toBe(false)
      expect(isLoggedOutCode(0)).toBe(false)
    })
  })

  describe('nextBackoff', () => {
    it('doubles current value', () => {
      expect(nextBackoff(1000)).toBe(2000)
      expect(nextBackoff(2000)).toBe(4000)
      expect(nextBackoff(4000)).toBe(8000)
    })

    it('caps at maxMs (default 30s)', () => {
      expect(nextBackoff(20_000)).toBe(30_000)
      expect(nextBackoff(50_000)).toBe(30_000)
    })

    it('uses initial when current is 0 or negative', () => {
      expect(nextBackoff(0)).toBe(2000) // initial 1000 doubled = 2000
      expect(nextBackoff(-5)).toBe(2000)
    })

    it('respects custom initial and max', () => {
      expect(nextBackoff(0, 500, 5000)).toBe(1000)
      expect(nextBackoff(3000, 500, 5000)).toBe(5000)
    })
  })

  describe('deriveTransition', () => {
    it('connection=open → state open, no qr, no reconnect', () => {
      const r = deriveTransition({ connection: 'open' })
      expect(r).toEqual({
        state: 'open',
        qr: null,
        shouldReconnect: false,
        isLoggedOut: false
      })
    })

    it('connection=close with loggedOut code → state logged-out, no reconnect', () => {
      const update: RawConnectionUpdate = {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: LOGGED_OUT_CODE } } }
      }
      const r = deriveTransition(update)
      expect(r.state).toBe('logged-out')
      expect(r.shouldReconnect).toBe(false)
      expect(r.isLoggedOut).toBe(true)
    })

    it('connection=close with non-loggedOut code → state disconnected, reconnect', () => {
      const update: RawConnectionUpdate = {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 515 } } }
      }
      const r = deriveTransition(update)
      expect(r.state).toBe('disconnected')
      expect(r.shouldReconnect).toBe(true)
      expect(r.isLoggedOut).toBe(false)
    })

    it('connection=close without lastDisconnect → state disconnected, reconnect', () => {
      const r = deriveTransition({ connection: 'close' })
      expect(r.state).toBe('disconnected')
      expect(r.shouldReconnect).toBe(true)
    })

    it('connection=close with missing error.output.statusCode → reconnect (treated as transient)', () => {
      const r = deriveTransition({
        connection: 'close',
        lastDisconnect: { error: {} }
      })
      expect(r.state).toBe('disconnected')
      expect(r.shouldReconnect).toBe(true)
    })

    it('qr present → state connecting with qr payload', () => {
      const r = deriveTransition({ qr: 'ABC123' })
      expect(r.state).toBe('connecting')
      expect(r.qr).toBe('ABC123')
      expect(r.shouldReconnect).toBe(false)
    })

    it('connection=connecting (no qr) → state connecting, no qr', () => {
      const r = deriveTransition({ connection: 'connecting' })
      expect(r.state).toBe('connecting')
      expect(r.qr).toBeNull()
    })

    it('empty update → state connecting fallback', () => {
      const r = deriveTransition({})
      expect(r.state).toBe('connecting')
      expect(r.qr).toBeNull()
      expect(r.shouldReconnect).toBe(false)
    })

    it('open beats qr (qr ignored once open)', () => {
      const r = deriveTransition({ connection: 'open', qr: 'X' })
      expect(r.state).toBe('open')
      expect(r.qr).toBeNull()
    })
  })
})
