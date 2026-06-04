import { ConnectionEntity } from '@shared/domain/connection.entity'
import type { WAConnectionState, AppErrorEvent, Unsubscribe } from '@shared/types'

export interface IConnectionService {
  getConnectionState(): Promise<WAConnectionState>
  getSyncStatus(): Promise<ConnectionEntity>
  getCurrentQr(): Promise<string | null>
  requestQr(): Promise<void>
  logout(): Promise<void>
  onConnectionState(cb: (state: WAConnectionState) => void): Unsubscribe
  onSyncStateChanged(cb: (status: ConnectionEntity) => void): Unsubscribe
  onError(cb: (error: AppErrorEvent) => void): Unsubscribe
  onQr(cb: (qr: string) => void): Unsubscribe
  onLoggedOut(cb: () => void): Unsubscribe
}
