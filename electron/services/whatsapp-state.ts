// Pure state-machine helpers for the WhatsApp connection. Kept free of
// Baileys imports so they can be unit-tested without spinning up the heavy
// crypto / WebSocket stack.

export type WAConnectionState =
  | 'connecting'
  | 'open'
  | 'disconnected'
  | 'logged-out'

export interface RawConnectionUpdate {
  connection?: 'connecting' | 'open' | 'close'
  qr?: string
  lastDisconnect?: { error?: { output?: { statusCode?: number } } }
}

export interface DerivedTransition {
  state: WAConnectionState
  qr: string | null
  shouldReconnect: boolean
  isLoggedOut: boolean
}

// DisconnectReason.loggedOut is the only Baileys constant we need; inlining
// the value lets this module stay free of the @whiskeysockets/baileys import.
export const LOGGED_OUT_CODE = 401

export function isLoggedOutCode(code: number | undefined): boolean {
  return code === LOGGED_OUT_CODE
}

// Strip an optional `:<deviceId>` device suffix from a JID's user portion.
// 549...:42@s.whatsapp.net → 549...@s.whatsapp.net
export function normalizeJid(jid: string | null | undefined): string | null {
  if (!jid) return null
  return jid.replace(/:\d+(?=@)/, '')
}

// Returns just the user portion of a JID, before the `:device` suffix and
// before the `@server` part. Two JIDs share a user-part iff they refer to
// the same WhatsApp account regardless of which addressing form (PN, LID)
// the message happened to use.
//
//   549...:42@s.whatsapp.net  → "549..."
//   abc-xyz@lid               → "abc-xyz"
//   549...@s.whatsapp.net     → "549..."
export function jidUserPart(jid: string | null | undefined): string | null {
  if (!jid) return null
  const match = jid.match(/^([^:@]+)/)
  return match && match[1] ? match[1] : null
}

// True when `remoteJid` matches any of the user's known JID variants. Baileys
// 7's `sock.user` carries up to three forms of the same account — `id` (the
// preferred lid or phone), `phoneNumber` (`@s.whatsapp.net`) and `lid`
// (`@lid`). The message's `remoteJid` may use any of them, so we accept a
// match against ANY variant.
export function isSelfChat(
  remoteJid: string | null | undefined,
  myJids: ReadonlyArray<string | null | undefined> | string | null | undefined
): boolean {
  const r = jidUserPart(remoteJid)
  if (!r) return false
  // Skip groups, broadcasts, communities — those are server-suffix marked.
  if (remoteJid?.includes('@g.us') || remoteJid?.includes('@broadcast')) return false
  const candidates = Array.isArray(myJids) ? myJids : [myJids]
  for (const candidate of candidates) {
    if (jidUserPart(candidate) === r) return true
  }
  return false
}

export function nextBackoff(
  current: number,
  initialMs = 1000,
  maxMs = 30_000
): number {
  const base = current <= 0 ? initialMs : current
  return Math.min(base * 2, maxMs)
}

export function deriveTransition(update: RawConnectionUpdate): DerivedTransition {
  if (update.connection === 'open') {
    return {
      state: 'open',
      qr: null,
      shouldReconnect: false,
      isLoggedOut: false
    }
  }

  if (update.connection === 'close') {
    const code = update.lastDisconnect?.error?.output?.statusCode
    if (isLoggedOutCode(code)) {
      return {
        state: 'logged-out',
        qr: null,
        shouldReconnect: false,
        isLoggedOut: true
      }
    }
    return {
      state: 'disconnected',
      qr: null,
      shouldReconnect: true,
      isLoggedOut: false
    }
  }

  if (update.qr) {
    return {
      state: 'connecting',
      qr: update.qr,
      shouldReconnect: false,
      isLoggedOut: false
    }
  }

  return {
    state: 'connecting',
    qr: null,
    shouldReconnect: false,
    isLoggedOut: false
  }
}
