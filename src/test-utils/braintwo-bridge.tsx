import { vi } from 'vitest'
import type { BrainTwoBridge, WAConnectionState } from '@shared/types'

export interface BridgeHandle {
  bridge: BrainTwoBridge
  emitConnectionState: (state: WAConnectionState) => void
  emitQr: (qr: string) => void
  emitLoggedOut: () => void
  spies: {
    requestQr: ReturnType<typeof vi.fn>
    logout: ReturnType<typeof vi.fn>
    openWindow: ReturnType<typeof vi.fn>
    quit: ReturnType<typeof vi.fn>
    getVersion: ReturnType<typeof vi.fn>
    getPlatform: ReturnType<typeof vi.fn>
    getConnectionState: ReturnType<typeof vi.fn>
    getCurrentQr: ReturnType<typeof vi.fn>
  }
}

export interface BridgeOpts {
  initialState?: WAConnectionState
  initialQr?: string | null
  version?: string
  platform?: NodeJS.Platform
}

export function installBraintwoBridge(opts: BridgeOpts = {}): BridgeHandle {
  const stateListeners: ((s: WAConnectionState) => void)[] = []
  const qrListeners: ((qr: string) => void)[] = []
  const loggedOutListeners: (() => void)[] = []

  const spies = {
    requestQr: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
    openWindow: vi.fn(async () => {}),
    quit: vi.fn(async () => {}),
    getVersion: vi.fn(async () => opts.version ?? '0.1.0'),
    getPlatform: vi.fn(async () => opts.platform ?? 'win32'),
    getConnectionState: vi.fn(async () => opts.initialState ?? 'connecting'),
    getCurrentQr: vi.fn(async () => opts.initialQr ?? null)
  }

  const bridge: BrainTwoBridge = {
    platform: opts.platform ?? 'win32',
    versions: { electron: '33.0.0', node: '20.0.0', chrome: '130.0.0' },
    app: {
      openWindow: spies.openWindow,
      quit: spies.quit,
      getVersion: spies.getVersion,
      getPlatform: spies.getPlatform
    },
    wa: {
      getConnectionState: spies.getConnectionState as unknown as () => Promise<WAConnectionState>,
      getCurrentQr: spies.getCurrentQr as unknown as () => Promise<string | null>,
      requestQr: spies.requestQr,
      logout: spies.logout,
      onConnectionState: (cb) => {
        stateListeners.push(cb)
        return () => {
          const i = stateListeners.indexOf(cb)
          if (i >= 0) stateListeners.splice(i, 1)
        }
      },
      onQr: (cb) => {
        qrListeners.push(cb)
        return () => {
          const i = qrListeners.indexOf(cb)
          if (i >= 0) qrListeners.splice(i, 1)
        }
      },
      onLoggedOut: (cb) => {
        loggedOutListeners.push(cb)
        return () => {
          const i = loggedOutListeners.indexOf(cb)
          if (i >= 0) loggedOutListeners.splice(i, 1)
        }
      }
    }
  }

  ;(window as unknown as { braintwo: BrainTwoBridge }).braintwo = bridge

  return {
    bridge,
    emitConnectionState: (state) => stateListeners.forEach((l) => l(state)),
    emitQr: (qr) => qrListeners.forEach((l) => l(qr)),
    emitLoggedOut: () => loggedOutListeners.forEach((l) => l()),
    spies
  }
}
