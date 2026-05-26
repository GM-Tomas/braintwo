import { MessageEntity } from '@shared/domain/message.entity'
import { Icon } from '@/lib/icons'
import { KIND_STYLE, SOURCE_DOT, SOURCE_LABEL } from './timeline-constants'

interface NoteRowProps {
  message: MessageEntity
  formatted: string
  isSelected: boolean
  onClick: () => void
  similarity?: number
  matchSource?: 'semantic' | 'keyword' | 'both'
}

export function NoteRow({ message, formatted, isSelected, onClick, similarity, matchSource }: NoteRowProps) {
  const style = KIND_STYLE[message.kind] ?? KIND_STYLE.other
  return (
    <li>
      <article
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onClick()
        }}
        aria-pressed={isSelected}
        className={`group grid min-h-[92px] cursor-pointer items-start gap-[18px] border-b border-bt-border px-4 py-5 transition-colors duration-100 outline-none focus-visible:ring-1 focus-visible:ring-bt-primary/40 ${
          isSelected
            ? 'bg-bt-primary/[0.06] border-l-2 border-l-bt-primary'
            : 'hover:bg-white/[0.018]'
        } ${similarity !== undefined ? 'grid-cols-[36px_minmax(0,1fr)_auto_16px]' : 'grid-cols-[36px_minmax(0,1fr)_16px]'}`}
      >
        <div
          aria-hidden
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{
            background: style.bg,
            border: `1px solid ${style.border}`
          }}
        >
          <Icon name={style.icon} size={15} className={style.iconColor} />
        </div>
        <div className="min-w-0 flex-1">
          <NotePreview message={message} kindLabel={style.label} />
          <div className="mt-2 flex items-center gap-2.5 text-[11.5px] text-bt-dim">
            <span className="inline-flex items-center gap-1.5 text-bt-muted">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${SOURCE_DOT[message.source]}`}
              />
              {SOURCE_LABEL[message.source]}
            </span>
            <span>·</span>
            <time
              dateTime={new Date(message.timestamp).toISOString()}
              className="text-bt-dim"
            >
              {formatted}
            </time>
            {message.fromMe ? (
              <>
                <span>·</span>
                <span className="text-bt-dim">enviado</span>
              </>
            ) : null}
          </div>
        </div>
        {similarity !== undefined && (
          <div className="flex shrink-0 items-center mt-1.5">
            {matchSource === 'keyword' ? (
              <span className="rounded-full border border-bt-accent/30 px-2.5 py-1 text-[11px] text-bt-accent font-medium">
                exacto
              </span>
            ) : matchSource === 'both' ? (
              <div className="flex items-center gap-1.5">
                <span className="rounded-full border border-bt-accent/30 px-2.5 py-1 text-[11px] text-bt-accent font-medium">
                  exacto
                </span>
                <span className="rounded-full border border-bt-brand/30 px-2.5 py-1 text-[11px] text-bt-brand font-medium">
                  {Math.round(similarity * 100)}%
                </span>
              </div>
            ) : (
              <span className="rounded-full border border-bt-brand/30 px-2.5 py-1 text-[11px] text-bt-brand font-medium">
                {Math.round(similarity * 100)}%
              </span>
            )}
          </div>
        )}
        <Icon
          name="chev"
          size={14}
          className={`mt-1 transition-colors ${
            isSelected ? 'rotate-90 text-bt-primary' : 'text-bt-dim group-hover:text-bt-muted'
          }`}
        />
      </article>
    </li>
  )
}

function NotePreview({ message, kindLabel }: { message: MessageEntity; kindLabel: string }) {
  if (message.text) {
    return (
      <p className="line-clamp-2 whitespace-pre-wrap text-[14.5px] leading-relaxed text-bt-text">
        {message.text}
      </p>
    )
  }
  return (
    <div className="flex items-baseline gap-2 text-[14.5px] leading-relaxed">
      <span className="text-bt-text">{kindLabel}</span>
      <span className="text-[12.5px] text-bt-muted">{message.getMediaSummary()}</span>
    </div>
  )
}
