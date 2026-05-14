import type { SyncStatus, WAConnectionState } from '@shared/types'

const DOT: Record<string, string> = {
  connecting: 'bg-bt-dim',
  open: 'bg-bt-accent shadow-bt-glow-teal',
  idle: 'bg-bt-accent shadow-bt-glow-teal',
  'catching-up': 'animate-pulse bg-bt-primary',
  disconnected: 'bg-bt-amber',
  'logged-out': 'bg-bt-red',
  'stale-primary': 'bg-bt-amber'
}

const FALLBACK_LABEL: Record<WAConnectionState, string> = {
  connecting: 'Conectando...',
  open: 'Conectado',
  disconnected: 'Reconectando...',
  'logged-out': 'Sesion cerrada'
}

export function SyncStatusBadge({
  connectionState,
  syncStatus
}: {
  connectionState: WAConnectionState
  syncStatus?: SyncStatus | null
}) {
  const state = syncStatus?.state ?? connectionState
  const label = syncStatus?.label ?? FALLBACK_LABEL[connectionState]
  const warning =
    syncStatus?.state === 'stale-primary'
      ? `Primary phone inactivo hace ${syncStatus.stalePrimaryDays} dias`
      : null

  return (
    <section
      className="mb-5 flex items-center gap-2.5 rounded-[8px] border border-bt-border bg-white/[0.025] px-3 py-2.5"
      aria-label="Estado de sincronizacion"
      title={warning ?? label}
    >
      <span className={`h-2 w-2 rounded-full ${DOT[state] ?? DOT.connecting}`} aria-hidden />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-eyebrow text-bt-dim">
          WhatsApp
        </p>
        <p aria-live="polite" className="truncate text-[13px] font-medium text-bt-text">
          {label}
        </p>
        {warning ? (
          <p className="truncate text-[10.5px] text-bt-amber">{warning}</p>
        ) : null}
      </div>
    </section>
  )
}
