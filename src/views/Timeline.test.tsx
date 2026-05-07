import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { Timeline, mergeRecent } from './Timeline'
import {
  installBraintwoBridge,
  type BridgeHandle
} from '../test-utils/braintwo-bridge'
import type { RecentMessage } from '@shared/types'

const sample = (over: Partial<RecentMessage> = {}): RecentMessage => ({
  id: 1,
  wa_msg_id: 'wa-1',
  timestamp: 1_700_000_000_000,
  text: 'hello',
  source: 'realtime',
  ...over
})

describe('mergeRecent (pure)', () => {
  it('returns prev when batch is empty', () => {
    const prev = [sample({ id: 1 })]
    expect(mergeRecent([], prev, 50)).toBe(prev)
  })

  it('prepends batch in front of prev', () => {
    const prev = [sample({ id: 1, timestamp: 100 })]
    const batch = [sample({ id: 2, timestamp: 200 })]
    const r = mergeRecent(batch, prev, 50)
    expect(r.map((m) => m.id)).toEqual([2, 1])
  })

  it('dedupes by id (batch wins)', () => {
    const prev = [sample({ id: 1, text: 'old' })]
    const batch = [sample({ id: 1, text: 'new' })]
    const r = mergeRecent(batch, prev, 50)
    expect(r).toHaveLength(1)
    expect(r[0]!.text).toBe('new')
  })

  it('sorts the batch by timestamp DESC before merging', () => {
    const batch = [
      sample({ id: 1, timestamp: 100 }),
      sample({ id: 2, timestamp: 300 }),
      sample({ id: 3, timestamp: 200 })
    ]
    const r = mergeRecent(batch, [], 50)
    expect(r.map((m) => m.id)).toEqual([2, 3, 1])
  })

  it('truncates to limit', () => {
    const prev = Array.from({ length: 5 }, (_, i) =>
      sample({ id: i + 1, timestamp: i })
    )
    const batch = [sample({ id: 100, timestamp: 999 })]
    const r = mergeRecent(batch, prev, 3)
    expect(r).toHaveLength(3)
    expect(r[0]!.id).toBe(100)
  })
})

describe('<Timeline />', () => {
  let h: BridgeHandle

  beforeEach(() => {
    h = installBraintwoBridge({
      initialState: 'open',
      initialMessageCount: 0,
      initialRecent: []
    })
  })

  it('renders the title', async () => {
    render(<Timeline />)
    expect(screen.getByText('Timeline')).toBeInTheDocument()
  })

  it('shows empty-state when there are no messages', async () => {
    render(<Timeline />)
    expect(
      await screen.findByText(/Aún no hay mensajes/)
    ).toBeInTheDocument()
  })

  it('renders the seeded count + recent rows on mount', async () => {
    h = installBraintwoBridge({
      initialMessageCount: 3,
      initialRecent: [
        sample({ id: 1, text: 'one' }),
        sample({ id: 2, text: 'two' }),
        sample({ id: 3, text: 'three' })
      ]
    })
    render(<Timeline />)
    await waitFor(() => {
      expect(screen.getByText(/3 mensajes/)).toBeInTheDocument()
      expect(screen.getByText('one')).toBeInTheDocument()
      expect(screen.getByText('two')).toBeInTheDocument()
      expect(screen.getByText('three')).toBeInTheDocument()
    })
  })

  it('uses singular "mensaje" for count of 1', async () => {
    h = installBraintwoBridge({
      initialMessageCount: 1,
      initialRecent: [sample()]
    })
    render(<Timeline />)
    await waitFor(() =>
      expect(screen.getByText(/1 mensaje$/)).toBeInTheDocument()
    )
  })

  it('appends incoming batch to the list and bumps the count', async () => {
    render(<Timeline />)
    await screen.findByText(/Aún no hay mensajes/)

    act(() =>
      h.emitMessagesBatch([
        sample({ id: 10, text: 'fresh', timestamp: 1_700_000_001_000 })
      ])
    )

    await waitFor(() => {
      expect(screen.queryByText(/Aún no hay mensajes/)).not.toBeInTheDocument()
      expect(screen.getByText('fresh')).toBeInTheDocument()
      expect(screen.getByText(/1 mensaje$/)).toBeInTheDocument()
    })
  })

  it('an empty batch does NOT bump the count', async () => {
    h = installBraintwoBridge({
      initialMessageCount: 5,
      initialRecent: [sample({ id: 1, text: 'a' })]
    })
    render(<Timeline />)
    await screen.findByText(/5 mensajes/)
    act(() => h.emitMessagesBatch([]))
    expect(screen.getByText(/5 mensajes/)).toBeInTheDocument()
  })

  it('renders source badges per message', async () => {
    h = installBraintwoBridge({
      initialMessageCount: 4,
      initialRecent: [
        sample({ id: 1, source: 'realtime' }),
        sample({ id: 2, source: 'offline-sync' }),
        sample({ id: 3, source: 'history-sync' }),
        sample({ id: 4, source: 'export' })
      ]
    })
    render(<Timeline />)
    await waitFor(() => {
      expect(screen.getByText('Tiempo real')).toBeInTheDocument()
      expect(screen.getByText('Catch-up')).toBeInTheDocument()
      expect(screen.getByText('Histórico')).toBeInTheDocument()
      expect(screen.getByText('Importado')).toBeInTheDocument()
    })
  })

  it('renders an absolute time per message', async () => {
    h = installBraintwoBridge({
      initialMessageCount: 1,
      initialRecent: [
        sample({ id: 1, timestamp: new Date('2026-01-15T10:30:00Z').valueOf() })
      ]
    })
    render(<Timeline />)
    const time = await screen.findByRole('time')
    expect(time).toHaveAttribute('datetime', '2026-01-15T10:30:00.000Z')
  })

  it('unsubscribes from messages-batch on unmount', () => {
    const off = vi.fn()
    const original = h.bridge.app.onMessagesBatch
    h.bridge.app.onMessagesBatch = (cb) => {
      const real = original(cb)
      return () => {
        off()
        real()
      }
    }
    const { unmount } = render(<Timeline />)
    unmount()
    expect(off).toHaveBeenCalled()
  })

  it('drops late updates after unmount (no React state warning)', async () => {
    h = installBraintwoBridge({
      initialMessageCount: 0,
      initialRecent: []
    })
    const { unmount } = render(<Timeline />)
    unmount()
    // Late batch arriving after unmount should be a no-op.
    expect(() => h.emitMessagesBatch([sample({ id: 1 })])).not.toThrow()
  })
})
