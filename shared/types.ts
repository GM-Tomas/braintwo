export type View = 'onboarding' | 'search' | 'timeline'

export type ConnectionState =
  | 'connecting'
  | 'open'
  | 'catching-up'
  | 'idle'
  | 'disconnected'
  | 'logged-out'

export type WAConnectionState =
  | 'connecting'
  | 'open'
  | 'disconnected'
  | 'logged-out'

export type Unsubscribe = () => void

export interface BrainTwoBridge {
  platform: NodeJS.Platform
  versions: {
    electron: string
    node: string
    chrome: string
  }
  app: {
    openWindow: () => Promise<void>
    quit: () => Promise<void>
    getVersion: () => Promise<string>
    getPlatform: () => Promise<NodeJS.Platform>
  }
  wa: {
    getConnectionState: () => Promise<WAConnectionState>
    getCurrentQr: () => Promise<string | null>
    requestQr: () => Promise<void>
    logout: () => Promise<void>
    onConnectionState: (cb: (state: WAConnectionState) => void) => Unsubscribe
    onQr: (cb: (qr: string) => void) => Unsubscribe
    onLoggedOut: (cb: () => void) => Unsubscribe
  }
}

declare global {
  interface Window {
    braintwo: BrainTwoBridge
  }
}
