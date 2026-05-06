export type View = 'onboarding' | 'search' | 'timeline'

export type ConnectionState =
  | 'connecting'
  | 'open'
  | 'catching-up'
  | 'idle'
  | 'disconnected'
  | 'logged-out'

declare global {
  interface Window {
    braintwo: {
      platform: NodeJS.Platform
      versions: {
        electron: string
        node: string
        chrome: string
      }
    }
  }
}
