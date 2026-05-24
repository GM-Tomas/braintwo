import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiChatResponse, AiConfig, ChatMessage, View } from '@shared/types'
import { PageHeader } from '../../components/PageHeader'
import { Icon } from '@/lib/icons'
import { useDependencies } from '@/core/infrastructure/DependenciesContext'
import { AssistantAvatar, MessageBubble } from './MessageBubble'

interface ChatProps {
  onNavigate: (view: View) => void
}

export function Chat({ onNavigate }: ChatProps) {
  const { aiService } = useDependencies()
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
    void aiService.getConfig().then(setConfig)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [aiService])

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
      const res = await aiService.send(nextHistory)
      setMessages((prev) => [...prev, { role: 'assistant', content: res.content }])
      setLastResponse(res)
      if (res.sources.length > 0) setSourcesOpen(true)
    } catch (err) {
      setError(parseAiError(err))
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, aiService])

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

function parseAiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const stripped = raw.replace(/^Error invoking remote method '[^']+': Error: /, '')
  const jsonMatch = /:\s*(\{[\s\S]+\})$/.exec(stripped)
  if (jsonMatch) {
    try {
      const body = JSON.parse(jsonMatch[1]!) as { error?: { message?: string } }
      if (body?.error?.message) return body.error.message
    } catch { /* not JSON, fall through */ }
  }
  return stripped || 'Error al contactar la IA'
}
