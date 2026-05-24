import type { AiChatResponse, ChatMessage, View } from '@shared/types'
import { Icon } from '@/lib/icons'
import { InlineMarkdown } from '@/components/InlineMarkdown'
import { SourcesList } from './SourcesList'

export function AssistantAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bt-hover text-bt-accent">
      <Icon name="bolt" size={13} />
    </div>
  )
}

interface MessageBubbleProps {
  msg: ChatMessage
  response: AiChatResponse | null
  sourcesOpen: boolean
  onToggleSources: () => void
  onNavigate: (view: View) => void
}

export function MessageBubble({
  msg,
  response,
  sourcesOpen,
  onToggleSources,
  onNavigate
}: MessageBubbleProps) {
  const isUser = msg.role === 'user'

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {isUser ? (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bt-primary text-[11px] font-semibold text-white">
          T
        </div>
      ) : (
        <AssistantAvatar />
      )}

      <div className={`flex max-w-[85%] flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-[12px] px-4 py-3 text-[14px] leading-relaxed ${
            isUser
              ? 'bg-bt-primary text-white'
              : 'border border-bt-border bg-bt-surf text-bt-text'
          }`}
        >
          <InlineMarkdown text={msg.content} />
        </div>

        {response && !isUser && (
          <>
            {response.sources.length > 0 && (
              <div className="w-full">
                <button
                  type="button"
                  onClick={onToggleSources}
                  className="flex items-center gap-1.5 text-[11px] text-bt-muted transition-colors hover:text-bt-text"
                >
                  <Icon name={sourcesOpen ? 'x' : 'search'} size={12} />
                  {sourcesOpen
                    ? 'Ocultar fuentes'
                    : `${response.sources.length} mensaje${response.sources.length !== 1 ? 's' : ''} consultado${response.sources.length !== 1 ? 's' : ''}`}
                </button>
                {sourcesOpen && <SourcesList sources={response.sources} />}
              </div>
            )}
            {response.action?.action === 'navigate' && (
              <button
                type="button"
                onClick={() => onNavigate(response.action!.view as View)}
                className="inline-flex items-center gap-2 rounded-full border border-bt-primary/30 px-3.5 py-1.5 text-[12px] text-bt-primary transition-colors hover:bg-bt-primary/10"
              >
                <Icon name="chev" size={12} />
                Ir a {response.action.view}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
