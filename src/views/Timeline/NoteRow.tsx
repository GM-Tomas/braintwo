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
  lowRelevance?: boolean
  transcribing?: boolean
  transcript?: string
  noApiKey?: boolean
}

export function NoteRow({
  message,
  formatted,
  isSelected,
  onClick,
  similarity,
  matchSource,
  lowRelevance,
  transcribing,
  transcript,
  noApiKey
}: NoteRowProps) {
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
          <NotePreview message={message} kindLabel={style.label} transcribing={transcribing} transcript={transcript} />
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
            {noApiKey ? (
              <>
                <span>·</span>
                <span
                  className="inline-flex items-center gap-1 text-bt-red cursor-pointer"
                  title="API key de Groq no configurada — clic para ir a Ajustes"
                  onClick={(e) => {
                    e.stopPropagation()
                    window.dispatchEvent(new CustomEvent('navigate-to-settings'))
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-80 hover:opacity-100 transition-opacity">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span className="text-[11px]">sin API key</span>
                </span>
              </>
            ) : null}
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
            {matchSource === 'keyword' || matchSource === 'both' ? (
              <span className="rounded-full border border-bt-accent/30 bg-bt-accent/[0.04] px-2.5 py-1 text-[11px] text-bt-accent font-medium uppercase tracking-wider">
                Máxima similitud
              </span>
            ) : lowRelevance ? (
              <span className="rounded-full border border-bt-amber/30 bg-bt-amber/[0.04] px-2.5 py-1 text-[11px] text-bt-amber font-medium uppercase tracking-wider">
                Similitud baja
              </span>
            ) : (
              <span className="rounded-full border border-bt-brand/30 bg-bt-brand/[0.04] px-2.5 py-1 text-[11px] text-bt-brand font-medium uppercase tracking-wider">
                Similitud alta
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

function NotePreview({
  message,
  kindLabel,
  transcribing,
  transcript
}: {
  message: MessageEntity
  kindLabel: string
  transcribing?: boolean
  transcript?: string
}) {
  if (message.text && message.kind !== 'audio') {
    return (
      <p className="line-clamp-2 whitespace-pre-wrap text-[14.5px] leading-relaxed text-bt-text">
        {message.text}
      </p>
    )
  }
  const hasTranscript = transcript || (message.kind === 'audio' && message.text)
  return (
    <div className="flex items-baseline gap-2 text-[14.5px] leading-relaxed">
      <span className="text-bt-text">{kindLabel}</span>
      {transcribing ? (
        <span className="flex items-center gap-1.5 text-[12.5px] text-bt-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bt-accent" />
          Transcribiendo…
        </span>
      ) : hasTranscript ? (
        <span className="text-[12.5px] italic text-bt-muted opacity-70 line-clamp-1">
          &ldquo;{transcript || message.text}&rdquo;
        </span>
      ) : (
        <span className="text-[12.5px] text-bt-muted">{message.getMediaSummary()}</span>
      )}
    </div>
  )
}
