import { describe, it, expect } from 'vitest'
import {
  deriveTransition,
  jidUserPart,
  nextBackoff,
  isLoggedOutCode,
  isSelfChat,
  normalizeJid,
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

  describe('normalizeJid', () => {
    it('strips :N device suffix', () => {
      expect(normalizeJid('5491134567890:42@s.whatsapp.net')).toBe(
        '5491134567890@s.whatsapp.net'
      )
    })

    it('returns input unchanged when no device suffix', () => {
      expect(normalizeJid('5491134567890@s.whatsapp.net')).toBe(
        '5491134567890@s.whatsapp.net'
      )
    })

    it('returns null on null/undefined/empty', () => {
      expect(normalizeJid(null)).toBeNull()
      expect(normalizeJid(undefined)).toBeNull()
      expect(normalizeJid('')).toBeNull()
    })

    it('handles group JIDs (no @s.whatsapp.net) — leaves them as-is', () => {
      expect(normalizeJid('123-456@g.us')).toBe('123-456@g.us')
    })
  })

  describe('jidUserPart', () => {
    it('returns the digits before :device@server', () => {
      expect(jidUserPart('5491134567890:42@s.whatsapp.net')).toBe(
        '5491134567890'
      )
    })

    it('returns the user portion of an @lid jid', () => {
      expect(jidUserPart('abc-xyz@lid')).toBe('abc-xyz')
    })

    it('returns the user portion when there is no device suffix', () => {
      expect(jidUserPart('5491134567890@s.whatsapp.net')).toBe('5491134567890')
    })

    it('returns null on null/undefined/empty', () => {
      expect(jidUserPart(null)).toBeNull()
      expect(jidUserPart(undefined)).toBeNull()
      expect(jidUserPart('')).toBeNull()
    })

    it('returns null for a string with no user portion', () => {
      expect(jidUserPart(':42@s.whatsapp.net')).toBeNull()
      expect(jidUserPart('@server')).toBeNull()
    })
  })

  describe('isSelfChat', () => {
    it('true when remoteJid matches user JID without device suffix', () => {
      expect(
        isSelfChat('5491134567890@s.whatsapp.net', '5491134567890:42@s.whatsapp.net')
      ).toBe(true)
    })

    it('true when both already normalized', () => {
      expect(
        isSelfChat('5491134567890@s.whatsapp.net', '5491134567890@s.whatsapp.net')
      ).toBe(true)
    })

    it('false for a different remote JID', () => {
      expect(
        isSelfChat('5491100000000@s.whatsapp.net', '5491134567890:42@s.whatsapp.net')
      ).toBe(false)
    })

    it('false for group chats even with matching user portion', () => {
      expect(
        isSelfChat('5491134567890@g.us', '5491134567890:42@s.whatsapp.net')
      ).toBe(false)
    })

    it('false for broadcast lists', () => {
      expect(isSelfChat('status@broadcast', '54911@s.whatsapp.net')).toBe(false)
    })

    it('false when either side is null/undefined', () => {
      expect(isSelfChat(undefined, '5491134567890:42@s.whatsapp.net')).toBe(false)
      expect(isSelfChat('5491134567890@s.whatsapp.net', null)).toBe(false)
      expect(isSelfChat(null, null)).toBe(false)
    })

    describe('multi-variant matching (Baileys 7 LID + PN)', () => {
      it('matches against any of an array of candidates', () => {
        const variants = [
          'abc-xyz:42@lid',
          '5491134567890:42@s.whatsapp.net'
        ]
        // remoteJid in PN form, sock.user.id is the LID — still matches via
        // phoneNumber variant.
        expect(
          isSelfChat('5491134567890@s.whatsapp.net', variants)
        ).toBe(true)
      })

      it('matches against any of an array (LID side)', () => {
        const variants = [
          '5491134567890:42@s.whatsapp.net',
          'abc-xyz@lid'
        ]
        expect(isSelfChat('abc-xyz@lid', variants)).toBe(true)
      })

      it('returns false when no variant matches', () => {
        expect(
          isSelfChat('OTHER@s.whatsapp.net', [
            '5491134567890:42@s.whatsapp.net',
            'abc-xyz@lid'
          ])
        ).toBe(false)
      })

      it('skips empty / nullable entries in the variant list', () => {
        expect(
          isSelfChat('5491134567890@s.whatsapp.net', [
            null,
            undefined,
            '',
            '5491134567890:42@s.whatsapp.net'
          ])
        ).toBe(true)
      })

      it('returns false when the variant array is empty', () => {
        expect(isSelfChat('5491134567890@s.whatsapp.net', [])).toBe(false)
      })
    })
  })
})
