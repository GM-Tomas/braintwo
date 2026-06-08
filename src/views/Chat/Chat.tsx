import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiChatResponse, AiConfig, ChatMessage, RetrievedContext, View } from '@shared/types'
import type { MessageEntity } from '@shared/domain/message.entity'
import { PageHeader } from '../../components/PageHeader'
import { Icon } from '@/lib/icons'
import { useDependencies } from '@/core/infrastructure/DependenciesContext'
import { AssistantAvatar, MessageBubble } from './MessageBubble'
import { MessageDetail } from '../Timeline/MessageDetail'

interface ChatProps {
  onNavigate: (view: View) => void
  activeChatId: number | null
  setActiveChatId: (id: number | null) => void
  loadChats: () => Promise<void>
}

export function Chat({ onNavigate, activeChatId, setActiveChatId, loadChats }: ChatProps) {
  const { aiService, messageRepository, ollamaService } = useDependencies()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResponse, setLastResponse] = useState<AiChatResponse | null>(null)
  const [config, setConfig] = useState<AiConfig | null>(null)
  const [detailMessage, setDetailMessage] = useState<MessageEntity | null>(null)
  const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null)

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const loadedChatIdRef = useRef<number | null>(null)

  useEffect(() => {
    void aiService.getConfig().then(setConfig)
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [aiService])

  // When the local provider (Ollama / manual server) is active, track whether the server is up.
  useEffect(() => {
    if (config?.provider !== 'ollama') {
      setOllamaRunning(null)
      return
    }
    let cancelled = false
    const check = () => {
      void ollamaService.getStatus(config.ollama?.serverUrl)
        .then((s) => { if (!cancelled) setOllamaRunning(s === 'running') })
        .catch(() => { if (!cancelled) setOllamaRunning(false) })
    }
    check()
    const unsub = ollamaService.onStatusChange((s) => {
      if (!cancelled) setOllamaRunning(s === 'running')
    })
    return () => { cancelled = true; unsub() }
  }, [config, ollamaService])


  const selectChat = useCallback(async (chatId: number) => {
    setLoading(false)
    setError(null)
    setLastResponse(null)
    try {
      const dbMsgs = await aiService.getChatMessages(chatId)
      const chatMsgs: ChatMessage[] = dbMsgs.map((m) => {
        let parsedSources: RetrievedContext[] | undefined
        if (m.sources) {
          try {
            parsedSources = JSON.parse(m.sources) as RetrievedContext[]
          } catch {
            // ignore
          }
        }
        return {
          role: m.role,
          content: m.content,
          sources: parsedSources,
          created_at: m.created_at
        }
      })
      setMessages(chatMsgs)
      setTimeout(() => inputRef.current?.focus(), 100)
    } catch (err) {
      setError('Error al cargar los mensajes del chat.')
      console.error(err)
    }
  }, [aiService])

  useEffect(() => {
    if (activeChatId !== loadedChatIdRef.current) {
      loadedChatIdRef.current = activeChatId
      if (activeChatId !== null) {
        void selectChat(activeChatId)
      } else {
        setMessages([])
        setLastResponse(null)
        setError(null)
      }
    }
  }, [activeChatId, selectChat])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const hasConfig = Boolean(config?.provider && (config.provider === 'ollama' || config.apiKey))
  const localServerDown = config?.provider === 'ollama' && ollamaRunning === false
  const localModelMissing = config?.provider === 'ollama' && ollamaRunning === true && !config.model
  const canSend = hasConfig && !localServerDown && !localModelMissing

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    let currentChatId = activeChatId

    // 1. If no active chat, create one in SQLite first
    if (currentChatId === null) {
      try {
        const defaultTitle = text.length > 30 ? text.slice(0, 30) + '...' : text
        const newId = await aiService.createChat(defaultTitle)
        currentChatId = newId
        loadedChatIdRef.current = newId // Set ref to prevent trigger of selectChat useEffect
        setActiveChatId(newId)
        await loadChats()
      } catch (err) {
        setError('No se pudo crear el chat en la base de datos.')
        console.error(err)
        return
      }
    }

    const userMsg: ChatMessage = { role: 'user', content: text }
    const nextHistory = [...messages, userMsg]

    // Save user message to database
    try {
      await aiService.saveChatMessage(currentChatId, 'user', text, null)
    } catch (err) {
      console.error('Error saving user message:', err)
    }

    setMessages(nextHistory)
    setInput('')
    setLoading(true)
    setError(null)
    setLastResponse(null)

    try {
      const res = await aiService.send(nextHistory, undefined, currentChatId)

      // Save assistant message to database
      const serializedSources = res.sources.length > 0 ? JSON.stringify(res.sources) : null
      try {
        await aiService.saveChatMessage(currentChatId, 'assistant', res.content, serializedSources)
      } catch (err) {
        console.error('Error saving assistant message:', err)
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: res.content, sources: res.sources }])
      setLastResponse(res)
    } catch (err) {
      setError(parseAiError(err))
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, activeChatId, aiService, loadChats, setActiveChatId])

  const handleFeedbackGood = useCallback((sourceId: number) => {
    if (loading || messages.length < 2 || activeChatId === null) return
    const historyToReSend = messages.slice(0, -1)
    void aiService.send(historyToReSend, sourceId, activeChatId).then(async (res) => {
      try {
        await aiService.deleteLastMessage(activeChatId)
        const serializedSources = res.sources.length > 0 ? JSON.stringify(res.sources) : null
        await aiService.saveChatMessage(activeChatId, 'assistant', res.content, serializedSources)
      } catch (err) {
        console.error('Error saving updated feedback message:', err)
      }

      setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: res.content, sources: res.sources }])
      setLastResponse(res)
    }).catch(() => { /* silent — feedback is best-effort */ })
  }, [loading, messages, activeChatId, aiService])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  async function openSource(id: number) {
    const msg = await messageRepository.getMessageById(id)
    if (msg) setDetailMessage(msg)
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-bt-bg animate-fade-in">
      <PageHeader
        eyebrow="IA"
        title="Chat IA"
        subtitle="Preguntale al asistente sobre tus mensajes o sobre la app."
      />

      {!hasConfig && (
        <div className="mx-14 mt-4 rounded-[8px] border border-bt-amber/40 bg-bt-amber/10 px-4 py-3 text-[13px] text-bt-amber">
          No hay proveedor de IA configurado.{' '}
          <button
            type="button"
            className="underline hover:no-underline"
            onClick={() => onNavigate('settings')}
          >
            Configurá uno en Ajustes
          </button>
          .
        </div>
      )}

      {hasConfig && localModelMissing && (
        <div className="mx-14 mt-4 rounded-[8px] border border-bt-amber/40 bg-bt-amber/10 px-4 py-3 text-[13px] text-bt-amber">
          Todavía no elegiste un modelo de IA local.{' '}
          <button
            type="button"
            className="underline hover:no-underline"
            onClick={() => onNavigate('settings')}
          >
            Terminá la configuración en Ajustes
          </button>
          .
        </div>
      )}

      {hasConfig && localServerDown && (
        <div className="mx-14 mt-4 rounded-[8px] border border-bt-amber/40 bg-bt-amber/10 px-4 py-3 text-[13px] text-bt-amber">
          El servidor local de IA no está corriendo.{' '}
          <button
            type="button"
            className="underline hover:no-underline"
            onClick={() => onNavigate('settings')}
          >
            Iniciálo en Ajustes
          </button>
          .
        </div>
      )}


      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-14 py-6">
        <div className="mx-auto flex max-w-[760px] flex-col gap-5">
          {messages.length === 0 && (
            <div className="py-16 text-center text-[13px] text-bt-dim select-none">
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
                onNavigate={onNavigate}
                onOpenMessage={(id) => void openSource(id)}
                onFeedbackGood={isLast && isAssistant ? handleFeedbackGood : undefined}
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
            <div className="rounded-[8px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-400 animate-fade-in">
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
            disabled={loading || !canSend}
            rows={1}
            placeholder={
              !hasConfig
                ? 'Configurá un proveedor de IA en Ajustes primero'
                : localModelMissing
                  ? 'Elegí un modelo en Ajustes para empezar'
                  : localServerDown
                    ? 'El servidor local de IA no está corriendo'
                    : 'Preguntá algo… (Enter para enviar, Shift+Enter nueva línea)'
            }
            className="max-h-[120px] flex-1 resize-none rounded-[10px] border border-bt-border bg-bt-surf px-4 py-2.5 text-[14px] text-bt-text placeholder:text-bt-dim outline-none focus:border-bt-primary/40 disabled:opacity-40"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={loading || !input.trim() || !canSend}
            aria-label="Enviar mensaje"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-bt-send-btn text-white transition-colors hover:bg-bt-send-btn-hover disabled:opacity-40"
          >
            <Icon name="send" size={18} className="rotate-45 -translate-x-[2px] translate-y-[1px]" />
          </button>
        </div>
      </div>

      {detailMessage && (
        <div className="absolute inset-0 z-10 flex bg-bt-bg animate-fade-in">
          <MessageDetail message={detailMessage} onClose={() => setDetailMessage(null)} />
        </div>
      )}
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
