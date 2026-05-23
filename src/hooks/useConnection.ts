import { useState, useEffect } from 'react'
import type { WAConnectionState, SyncStatus, AppErrorEvent } from '@shared/types'

export function useConnection() {
  const [waState, setWaState] = useState<WAConnectionState>('connecting')
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [appError, setAppError] = useState<AppErrorEvent | null>(null)

  useEffect(() => {
    let mounted = true

    void window.braintwo.wa.getConnectionState().then(state => {
      if (mounted) setWaState(state)
    })
    
    void window.braintwo.app.getSyncStatus().then(status => {
      if (mounted) setSyncStatus(status)
    })

    const offWa = window.braintwo.wa.onConnectionState((state) => {
      setWaState(state)
      setSyncStatus((prev) =>
        prev
          ? {
              ...prev,
              state: state === 'open' ? 'idle' : state,
              label:
                state === 'open'
                  ? 'Al dia'
                  : state === 'disconnected'
                    ? 'Reconectando'
                    : state === 'logged-out'
                      ? 'Sesion cerrada'
                      : 'Conectando'
            }
          : prev
      )
    })

    const offSync = window.braintwo.app.onSyncStateChanged((status) => {
      setSyncStatus(status)
    })
    
    const offError = window.braintwo.app.onError((err) => {
      setAppError(err)
      window.setTimeout(() => setAppError(null), 5000)
    })

    return () => {
      mounted = false
      offWa()
      offSync()
      offError()
    }
  }, [])

  return { waState, syncStatus, appError }
}
