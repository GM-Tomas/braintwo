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

// The chat-with-self has `remoteJid` equal to the user's own JID, but Baileys
// reports `sock.user.id` with the linked-device suffix (`:N`). Compare the
// normalized forms.
export function isSelfChat(
  remoteJid: string | null | undefined,
  myJid: string | null | undefined
): boolean {
  const a = normalizeJid(remoteJid)
  const b = normalizeJid(myJid)
  if (!a || !b) return false
  return a === b
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
