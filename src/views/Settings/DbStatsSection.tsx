import type { DbStats } from '@shared/types'
import { formatBytes } from '@/lib/format'

interface DbStatsSectionProps {
  stats: DbStats | null
}

export function DbStatsSection({ stats }: DbStatsSectionProps) {
  const lastIngest = stats?.lastIngestAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(stats.lastIngestAt)
      )
    : 'Sin datos'

  return (
    <section className="rounded-[8px] border border-bt-border bg-bt-surf p-5">
      <h2 className="text-[15px] font-semibold text-bt-text">Base local</h2>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Mensajes" value={(stats?.messages ?? 0).toLocaleString()} />
        <Stat label="Embeddings" value={(stats?.embeddings ?? 0).toLocaleString()} />
        <Stat label="Tamano" value={formatBytes(stats?.sizeBytes ?? 0)} />
        <Stat label="Ultima ingesta" value={lastIngest} />
      </dl>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-eyebrow text-bt-dim">{label}</dt>
      <dd className="mt-1 text-[13px] text-bt-text">{value}</dd>
    </div>
  )
}
