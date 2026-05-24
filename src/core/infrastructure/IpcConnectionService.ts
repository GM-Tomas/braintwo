import type { IConnectionService } from '../ports/IConnectionService'
import { ConnectionEntity } from '@shared/domain/connection.entity'
import type { WAConnectionState, AppErrorEvent, Unsubscribe } from '@shared/types'

export class IpcConnectionService implements IConnectionService {
  async getConnectionState(): Promise<WAConnectionState> {
    return window.braintwo.wa.getConnectionState()
  }

  async getSyncStatus(): Promise<ConnectionEntity> {
    const raw = await window.braintwo.app.getSyncStatus()
    return new ConnectionEntity(raw)
  }

  async getCurrentQr(): Promise<string | null> {
    return window.braintwo.wa.getCurrentQr()
  }

  async requestQr(): Promise<void> {
    return window.braintwo.wa.requestQr()
  }

  async logout(): Promise<void> {
    return window.braintwo.wa.logout()
  }

  onConnectionState(cb: (state: WAConnectionState) => void): Unsubscribe {
    return window.braintwo.wa.onConnectionState(cb)
  }

  onSyncStateChanged(cb: (status: ConnectionEntity) => void): Unsubscribe {
    return window.braintwo.app.onSyncStateChanged((raw) => {
      cb(new ConnectionEntity(raw))
    })
  }

  onError(cb: (error: AppErrorEvent) => void): Unsubscribe {
    return window.braintwo.app.onError(cb)
  }

  onQr(cb: (qr: string) => void): Unsubscribe {
    return window.braintwo.wa.onQr(cb)
  }

  onLoggedOut(cb: () => void): Unsubscribe {
    return window.braintwo.wa.onLoggedOut(cb)
  }
}
