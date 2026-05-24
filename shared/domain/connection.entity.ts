import type { SyncStatus, ConnectionState } from '../types'

export class ConnectionEntity {
  constructor(private readonly data: SyncStatus) {}

  get state(): ConnectionState {
    return this.data.state
  }

  get lastPrimaryActivityAt(): number | null {
    return this.data.lastPrimaryActivityAt
  }

  get stalePrimaryDays(): number {
    return this.data.stalePrimaryDays
  }

  get newMessages(): number {
    return this.data.newMessages
  }

  get label(): string {
    return this.getStatusLabel()
  }


  getStatusLabel(): string {
    switch (this.state) {
      case 'open':
      case 'idle':
        return 'Al dia'
      case 'disconnected':
        return 'Reconectando'
      case 'logged-out':
        return 'Sesion cerrada'
      case 'connecting':
        return 'Conectando'
      case 'catching-up':
        return 'Sincronizando...'
      case 'stale-primary':
        return 'Inactivo'
      default:
        return this.data.label || 'Conectando'
    }
  }

  isConnecting(): boolean {
    return this.state === 'connecting' || this.state === 'catching-up'
  }
}
