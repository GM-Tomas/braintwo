export type ConnectionState =
  | 'connecting'
  | 'open'
  | 'catching-up'
  | 'idle'
  | 'disconnected'
  | 'logged-out'
  | 'stale-primary'

export type WAConnectionState =
  | 'connecting'
  | 'open'
  | 'disconnected'
  | 'logged-out'

export interface SyncStatus {
  state: ConnectionState
  label: string
  lastPrimaryActivityAt: number | null
  stalePrimaryDays: number
  newMessages: number
}

export interface AppErrorEvent {
  code: string
  message: string
  recoverable: boolean
}
