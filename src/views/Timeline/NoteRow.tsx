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
  onToggleIgnore?: (msgId: number) => void
  isIgnored?: boolean
  highlight?: string
  delayMs?: number
}

const MARK_CLASS = 'rounded-sm bg-bt-accent/15 text-bt-text px-[2px]'

function highlightText(text: string, query: string) {
  if (!query.trim()) return text
  const terms = query.trim().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return text
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(pattern)
  return parts.map((part, i) =>
    terms.some((t) => t.toLowerCase() === part.toLowerCase())
      ? `<mark class="${MARK_CLASS}">${part}</mark>`
      : part
  ).join('')
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
  noApiKey,
  onToggleIgnore,
  isIgnored: isIgnoredProp,
  highlight,
  delayMs
}: NoteRowProps) {
  const style = KIND_STYLE[message.kind] ?? KIND_STYLE.other
  const isIgnored = isIgnoredProp ?? message.ignored
  return (
    <li className="animate-slide-in" style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}>
      <article
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onClick()
        }}
        aria-pressed={isSelected}
        className={`group grid min-h-[68px] cursor-pointer items-start gap-[18px] border-b border-bt-border px-4 py-3 outline-none focus-visible:ring-1 focus-visible:ring-bt-primary/40 ${
          isSelected
            ? 'bg-bt-primary/[0.06] border-l-2 border-l-bt-primary transition-colors duration-100'
            : 'hover:bg-bt-hover/20 transition-colors duration-150'
        } ${isIgnored ? 'opacity-40' : ''} ${similarity !== undefined ? 'grid-cols-[36px_minmax(0,1fr)_auto_16px]' : 'grid-cols-[36px_minmax(0,1fr)_16px]'}`}>
        <div
          aria-hidden
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] transition-transform duration-150 group-hover:scale-105"
          style={{
            background: style.bg,
            border: `1px solid ${style.border}`
          }}
        >
          <Icon name={style.icon} size={15} className={style.iconColor} />
        </div>
          <div className="min-w-0 flex-1">
          <NotePreview message={message} kindLabel={style.label} transcribing={transcribing} transcript={transcript} highlight={highlight} />
          <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-bt-dim">
            <span className="inline-flex items-center gap-1.5 text-bt-muted">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${SOURCE_DOT[message.source]}`}
              />
              {SOURCE_LABEL[message.source]}
            </span>
            {noApiKey ? (
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
              </span>
            ) : null}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleIgnore?.(message.id)
              }}
              className="text-bt-dim opacity-0 group-hover:opacity-100 transition-opacity duration-100 hover:text-bt-muted"
              title={isIgnored ? 'Incluir en contexto IA' : 'Ignorar (excluir del contexto IA)'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {isIgnored ? (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
            <time
              dateTime={new Date(message.timestamp).toISOString()}
              title={new Date(message.timestamp).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })}
              className="ml-auto text-[11px] text-bt-dim whitespace-nowrap"
            >
              {formatted}
            </time>
          </div>
        </div>
        {similarity !== undefined && (
          <div className="flex shrink-0 items-center mt-1.5">
            {matchSource === 'keyword' || matchSource === 'both' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-bt-accent/30 bg-bt-accent/[0.04] px-2.5 py-1 text-[11px] text-bt-accent font-medium uppercase tracking-wider">
                <Icon name="tag" size={11} />
                Keyword
              </span>
            ) : lowRelevance ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-bt-amber/30 bg-bt-amber/[0.04] px-2.5 py-1 text-[11px] text-bt-amber font-medium tracking-wider">
                <Icon name="help" size={11} />
                Baja relevancia
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-bt-brand/30 bg-bt-brand/[0.04] px-2.5 py-1 text-[11px] text-bt-brand font-medium uppercase tracking-wider">
                <Icon name="cpu" size={11} />
                Semantico
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
  transcript,
  highlight
}: {
  message: MessageEntity
  kindLabel: string
  transcribing?: boolean
  transcript?: string
  highlight?: string
}) {
  if (highlight && message.text && message.kind !== 'audio') {
    const html = highlightText(message.text, highlight)
    return (
      <p
        className="line-clamp-2 whitespace-pre-wrap text-[14.5px] leading-relaxed [&>mark]:rounded-sm [&>mark]:bg-bt-accent/15 [&>mark]:text-bt-text [&>mark]:px-[2px]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }
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
