import { useEffect, useMemo, useState } from 'react'
import type { MessageKind } from '@shared/types'
import { PageHeader } from '../../components/PageHeader'
import { useDateFormatter } from '@/hooks/useDateFormatter'
import { useIpcSubscription } from '@/hooks/useIpcSubscription'
import { useDependencies } from '@/core/infrastructure/DependenciesContext'
import { MessageEntity } from '@shared/domain/message.entity'
import { KindFilter } from './KindFilter'
import { EmptyState, FilteredEmpty } from './EmptyStates'
import { NoteRow } from './NoteRow'
import { MessageDetail } from './MessageDetail'

const RECENT_LIMIT = 50

export function Timeline() {
  const { messageRepository } = useDependencies()
  const [count, setCount] = useState<number>(0)
  const [messages, setMessages] = useState<MessageEntity[]>([])
  const [filter, setFilter] = useState<MessageKind | 'all'>('all')
  const [selected, setSelected] = useState<MessageEntity | null>(null)

  useEffect(() => {
    let mounted = true
    void messageRepository.getMessageCount().then((c) => {
      if (mounted) setCount(c)
    })
    void messageRepository.getRecentMessages(RECENT_LIMIT).then((rows) => {
      if (mounted) setMessages(rows)
    })
    return () => {
      mounted = false
    }
  }, [messageRepository])

  useIpcSubscription(messageRepository.onMessagesBatch, (batch) => {
    if (batch.length === 0) return
    setCount((prev) => prev + batch.length)
    setMessages((prev) => mergeRecent(batch, prev, RECENT_LIMIT))
  })

  // Close panel when Escape is pressed
  useEffect(() => {
    if (!selected) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selected])

  const formatter = useDateFormatter({ dateStyle: 'short', timeStyle: 'short' })

  const visible = useMemo<MessageEntity[]>(
    () =>
      filter === 'all'
        ? messages
        : messages.filter((m) => m.kind === filter),
    [messages, filter]
  )

  const counts = useMemo(() => kindCounts(messages), [messages])

  return (
    <div className="flex flex-1 flex-col overflow-hidden animate-fade-in">
      {selected ? (
        <MessageDetail
          message={selected}
          onClose={() => setSelected(null)}
        />
      ) : (
        <>
          <PageHeader
            eyebrow="Tu cerebro"
            title="Timeline"
            subtitle="Todo lo que mandaste a BrainTwo, ordenado cronológicamente — texto, audios, imágenes, videos y archivos."
            action={
              <span
                className="text-sm text-bt-muted"
                aria-label="Total de mensajes"
              >
                {count.toLocaleString()} {count === 1 ? 'mensaje' : 'mensajes'}
              </span>
            }
          />

          <KindFilter active={filter} onChange={setFilter} counts={counts} total={messages.length} />

          <div className="flex flex-1 overflow-hidden">
            {/* Message list */}
            <div className="flex-1 overflow-y-auto px-10 pb-14 pt-2">
              <div className="w-full">
                {messages.length === 0 ? (
                  <EmptyState />
                ) : visible.length === 0 ? (
                  <FilteredEmpty kind={filter as MessageKind} />
                ) : (
                  <ul className="w-full">
                    {visible.map((m) => (
                      <NoteRow
                        key={m.id}
                        message={m}
                        formatted={formatter.format(new Date(m.timestamp))}
                        isSelected={selected ? (selected as any).id === m.id : false}
                        onClick={() => setSelected(m)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function kindCounts(list: MessageEntity[]): Record<MessageKind, number> {
  const out: Record<MessageKind, number> = {
    text: 0,
    audio: 0,
    image: 0,
    video: 0,
    document: 0,
    sticker: 0,
    other: 0
  }
  for (const m of list) out[m.kind] = (out[m.kind] ?? 0) + 1
  return out
}

export function mergeRecent<T extends { id: number; timestamp: number }>(
  batch: T[],
  prev: T[],
  limit: number
): T[] {
  if (batch.length === 0) return prev
  const seen = new Set<number>()
  const merged: T[] = []
  const sortedBatch = [...batch].sort((a, b) => b.timestamp - a.timestamp)
  for (const m of sortedBatch) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    merged.push(m)
  }
  for (const m of prev) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    merged.push(m)
  }
  return merged.slice(0, limit)
}
