import { useState } from 'react'
import type { AiChatResponse, ChatMessage, View } from '@shared/types'
import { Icon } from '@/lib/icons'
import { InlineMarkdown } from '@/components/InlineMarkdown'
import { SourcesList } from './SourcesList'

const VIEW_NAMES: Record<string, string> = {
  timeline: 'Mis mensajes',
  chat: 'Chat',
  settings: 'Ajustes',
  onboarding: 'Inicio',
  search: 'Búsqueda'
}

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
  onNavigate: (view: View) => void
  onOpenMessage: (id: number) => void
  onFeedbackGood?: (sourceId: number) => void
}

export function MessageBubble({
  msg,
  response,
  onNavigate,
  onOpenMessage,
  onFeedbackGood
}: MessageBubbleProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const isUser = msg.role === 'user'

  const showResponse = response || (msg.sources && msg.sources.length > 0 ? { sources: msg.sources } : null)

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {isUser ? (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-bt-user-bubble-border bg-bt-user-bubble text-[11px] font-semibold text-bt-user-bubble-text">
          T
        </div>
      ) : (
        <AssistantAvatar />
      )}

      <div className={`flex max-w-[85%] flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-[12px] px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap ${
            isUser
               ? 'border border-bt-user-bubble-border bg-bt-user-bubble text-bt-user-bubble-text'
               : 'border border-bt-border bg-bt-surf text-bt-text'
          }`}
        >
          <InlineMarkdown text={msg.content} />
        </div>

        {showResponse && !isUser && (
          <>
            {showResponse.sources && showResponse.sources.length > 0 && (
              <div className="w-full">
                <button
                  type="button"
                  onClick={() => setSourcesOpen((o) => !o)}
                  className="flex items-center gap-1.5 text-[11px] text-bt-muted transition-colors hover:text-bt-text"
                >
                  <Icon name={sourcesOpen ? 'x' : 'search'} size={12} />
                  {sourcesOpen
                    ? 'Ocultar fuentes'
                    : `${showResponse.sources.length} mensaje${showResponse.sources.length !== 1 ? 's' : ''} consultado${showResponse.sources.length !== 1 ? 's' : ''}`}
                </button>
                {sourcesOpen && (
                  <SourcesList
                    sources={showResponse.sources}
                    onOpenMessage={onOpenMessage}
                    onFeedbackGood={onFeedbackGood}
                  />
                )}
              </div>
            )}
            {'action' in showResponse && showResponse.action?.action === 'navigate' && (
              <button
                type="button"
                onClick={() => onNavigate(showResponse.action!.view as View)}
                className="inline-flex items-center gap-2 rounded-full border border-bt-primary/30 px-3.5 py-1.5 text-[12px] text-bt-primary transition-colors hover:bg-bt-primary/10"
              >
                <Icon name="chev" size={12} />
                Ir a {VIEW_NAMES[showResponse.action.view] ?? showResponse.action.view}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
