import type { ConnectionState, SyncStatus } from '@shared/types'
import type { WAConnectionState } from './whatsapp-state'

const STALE_PRIMARY_DAYS = 7

export interface SyncStatusTracker {
  get: () => SyncStatus
  setConnection: (state: WAConnectionState) => SyncStatus
  startCatchup: () => SyncStatus
  finishCatchup: (newMessages: number) => SyncStatus
  notePrimaryActivity: (at?: number) => SyncStatus
}

export function createSyncStatusTracker(now: () => number = () => Date.now()): SyncStatusTracker {
  let state: ConnectionState = 'connecting'
  let lastPrimaryActivityAt: number | null = null
  let newMessages = 0

  function current(): SyncStatus {
    const stalePrimaryDays = lastPrimaryActivityAt !== null
      ? Math.floor((now() - lastPrimaryActivityAt) / 86_400_000)
      : 0
    const effectiveState =
      state !== 'logged-out' &&
      lastPrimaryActivityAt !== null &&
      stalePrimaryDays >= STALE_PRIMARY_DAYS
        ? 'stale-primary'
        : state
    return {
      state: effectiveState,
      label: labelFor(effectiveState),
      lastPrimaryActivityAt,
      stalePrimaryDays,
      newMessages
    }
  }

  return {
    get: current,
    setConnection(next) {
      state = next === 'open' ? 'idle' : next
      if (next === 'open') lastPrimaryActivityAt = now()
      return current()
    },
    startCatchup() {
      state = 'catching-up'
      return current()
    },
    finishCatchup(count) {
      newMessages = count
      state = 'idle'
      lastPrimaryActivityAt = now()
      return current()
    },
    notePrimaryActivity(at = now()) {
      lastPrimaryActivityAt = at
      return current()
    }
  }
}

export function labelFor(state: ConnectionState): string {
  switch (state) {
    case 'connecting':
      return 'Conectando'
    case 'open':
    case 'idle':
      return 'Al dia'
    case 'catching-up':
      return 'Sincronizando'
    case 'disconnected':
      return 'Reconectando'
    case 'logged-out':
      return 'Sesion cerrada'
    case 'stale-primary':
      return 'Primary inactivo'
  }
}
