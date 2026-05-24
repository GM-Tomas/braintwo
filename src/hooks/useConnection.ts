import { useState, useEffect } from 'react'
import { useDependencies } from '@/core/infrastructure/DependenciesContext'
import { ConnectionEntity } from '@shared/domain/connection.entity'
import type { WAConnectionState, AppErrorEvent } from '@shared/types'

export function useConnection() {
  const { connectionService } = useDependencies()
  const [waState, setWaState] = useState<WAConnectionState>('connecting')
  const [syncStatus, setSyncStatus] = useState<ConnectionEntity | null>(null)
  const [appError, setAppError] = useState<AppErrorEvent | null>(null)

  useEffect(() => {
    let mounted = true

    void connectionService.getConnectionState().then((state) => {
      if (mounted) setWaState(state)
    })

    void connectionService.getSyncStatus().then((status) => {
      if (mounted) setSyncStatus(status)
    })

    const offWa = connectionService.onConnectionState((state) => {
      if (!mounted) return
      setWaState(state)
      setSyncStatus((prev) =>
        prev
          ? new ConnectionEntity({
              state: state === 'open' ? 'idle' : state,
              label:
                state === 'open'
                  ? 'Al dia'
                  : state === 'disconnected'
                    ? 'Reconectando'
                    : state === 'logged-out'
                      ? 'Sesion cerrada'
                      : 'Conectando',
              lastPrimaryActivityAt: prev.lastPrimaryActivityAt,
              stalePrimaryDays: prev.stalePrimaryDays,
              newMessages: prev.newMessages
            })
          : prev
      )
    })

    const offSync = connectionService.onSyncStateChanged((status) => {
      if (mounted) setSyncStatus(status)
    })

    const offError = connectionService.onError((err) => {
      if (!mounted) return
      setAppError(err)
      window.setTimeout(() => setAppError(null), 5000)
    })

    return () => {
      mounted = false
      offWa()
      offSync()
      offError()
    }
  }, [connectionService])

  return { waState, syncStatus, appError }
}
