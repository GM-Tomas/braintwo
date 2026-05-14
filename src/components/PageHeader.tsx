import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
}

export function PageHeader({ eyebrow, title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-6 border-b border-bt-border px-14 pb-7 pt-10">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-2 text-[11px] uppercase tracking-eyebrow text-bt-dim">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="font-display text-[44px] leading-none tracking-[0.02em] text-bt-text">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2.5 max-w-[540px] text-sm leading-relaxed text-bt-muted">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
