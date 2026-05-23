import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiChatResponse, AiConfig, ChatMessage, RetrievedContext, View } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '@/lib/icons'
import { useDateFormatter } from '@/hooks/useDateFormatter'

interface ChatProps {
  onNavigate: (view: View) => void
}

export function Chat({ onNavigate }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResponse, setLastResponse] = useState<AiChatResponse | null>(null)
  const [config, setConfig] = useState<AiConfig | null>(null)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    void window.braintwo.ai.getConfig().then(setConfig)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const hasConfig = Boolean(config?.apiKey && config.provider)

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const nextHistory = [...messages, userMsg]

    setMessages(nextHistory)
    setInput('')
    setLoading(true)
    setError(null)
    setSourcesOpen(false)
    setLastResponse(null)

    try {
      const res = await window.braintwo.ai.send(nextHistory)
      setMessages((prev) => [...prev, { role: 'assistant', content: res.content }])
      setLastResponse(res)
      if (res.sources.length > 0) setSourcesOpen(true)
    } catch (err) {
      setError(parseAiError(err))
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-fade-in">
      <PageHeader
        eyebrow="IA"
        title="Chat IA"
        subtitle="Preguntale al asistente sobre tus mensajes o sobre la app."
      />

      {!hasConfig && (
        <div className="mx-14 mt-4 rounded-[8px] border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-[13px] text-yellow-400">
          No hay proveedor de IA configurado.{' '}
          <button
            type="button"
            className="underline hover:no-underline"
            onClick={() => onNavigate('settings')}
          >
            Configurá uno en Settings
          </button>
          .
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-14 py-6">
        <div className="mx-auto flex max-w-[760px] flex-col gap-5">
          {messages.length === 0 && (
            <div className="py-16 text-center text-[13px] text-bt-dim">
              <p>Preguntá sobre tus mensajes de WhatsApp.</p>
              <p className="mt-1 text-[12px] opacity-60">
                Ejemplos: "qué películas anoté", "mensajes sobre fútbol", "cuántos mensajes tengo"
              </p>
            </div>
          )}

          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1
            const isAssistant = msg.role === 'assistant'
            return (
              <MessageBubble
                key={i}
                msg={msg}
                response={isLast && isAssistant ? lastResponse : null}
                sourcesOpen={sourcesOpen}
                onToggleSources={() => setSourcesOpen((o) => !o)}
                onNavigate={onNavigate}
              />
            )
          })}

          {loading && (
            <div className="flex items-start gap-3">
              <AssistantAvatar />
              <div className="rounded-[12px] border border-bt-border bg-bt-surf px-4 py-3 text-[13px] text-bt-muted">
                Pensando…
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-[8px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-400">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-bt-border px-14 py-4">
        <div className="mx-auto flex max-w-[760px] items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading || !hasConfig}
            rows={1}
            placeholder={
              hasConfig
                ? 'Preguntá algo… (Enter para enviar, Shift+Enter nueva línea)'
                : 'Configurá un proveedor de IA en Settings primero'
            }
            className="max-h-[120px] flex-1 resize-none rounded-[10px] border border-bt-border bg-bt-surf px-4 py-2.5 text-[14px] text-bt-text placeholder:text-bt-dim outline-none focus:border-bt-primary/40 disabled:opacity-40"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={loading || !input.trim() || !hasConfig}
            aria-label="Enviar mensaje"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-bt-primary text-white transition-colors hover:bg-bt-primary/90 disabled:opacity-40"
          >
            <Icon name="chev" size={18} className="rotate-90" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseAiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  // Strip Electron IPC wrapper: "Error invoking remote method 'ai:send': Error: ..."
  const stripped = raw.replace(/^Error invoking remote method '[^']+': Error: /, '')
  // Try to extract a human-readable message from a JSON error body (e.g. "Gemini 400: {...}")
  const jsonMatch = /:\s*(\{[\s\S]+\})$/.exec(stripped)
  if (jsonMatch) {
    try {
      const body = JSON.parse(jsonMatch[1]!) as { error?: { message?: string } }
      if (body?.error?.message) return body.error.message
    } catch { /* not JSON, fall through */ }
  }
  return stripped || 'Error al contactar la IA'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AssistantAvatar() {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bt-hover text-bt-accent">
      <Icon name="bolt" size={13} />
    </div>
  )
}

function MessageBubble({
  msg,
  response,
  sourcesOpen,
  onToggleSources,
  onNavigate
}: {
  msg: ChatMessage
  response: AiChatResponse | null
  sourcesOpen: boolean
  onToggleSources: () => void
  onNavigate: (view: View) => void
}) {
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

function SourcesList({ sources }: { sources: RetrievedContext[] }) {
  const fmt = useDateFormatter({ dateStyle: 'short', timeStyle: 'short' })
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {sources.map((s, i) => (
        <li
          key={s.id}
          className="rounded-[8px] border border-bt-border bg-bt-bg px-3 py-2 text-[12px]"
        >
          <span className="mr-2 text-bt-dim">[{i + 1}]</span>
          <time className="mr-2 text-bt-dim">{fmt.format(new Date(s.timestamp))}</time>
          {s.similarity !== undefined && (
            <span className="mr-2 text-bt-accent">{Math.round(s.similarity * 100)}%</span>
          )}
          <span className="text-bt-muted">
            {s.text.length > 120 ? `${s.text.slice(0, 120)}…` : s.text}
          </span>
        </li>
      ))}
    </ul>
  )
}

function InlineMarkdown({ text }: { text: string }) {
  // Minimal inline renderer: **bold** and `code`. No external dependency.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={i} className="rounded bg-bt-hover px-1 font-mono text-bt-accent">
              {part.slice(1, -1)}
            </code>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
