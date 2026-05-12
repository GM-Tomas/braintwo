import { describe, expect, it } from 'vitest'
import { createSyncStatusTracker } from './sync-status'

describe('sync status tracker', () => {
  it('maps an open WhatsApp connection to idle sync status', () => {
    const tracker = createSyncStatusTracker(() => 1_000)
    const status = tracker.setConnection('open')
    expect(status.state).toBe('idle')
    expect(status.label).toBe('Al dia')
  })

  it('moves through catch-up and records new message count', () => {
    const tracker = createSyncStatusTracker(() => 1_000)
    expect(tracker.startCatchup().state).toBe('catching-up')
    const done = tracker.finishCatchup(12)
    expect(done.state).toBe('idle')
    expect(done.newMessages).toBe(12)
  })

  it('warns when primary phone activity is seven days stale', () => {
    const now = 8 * 86_400_000
    const tracker = createSyncStatusTracker(() => now)
    tracker.notePrimaryActivity(0)
    const status = tracker.get()
    expect(status.state).toBe('stale-primary')
    expect(status.stalePrimaryDays).toBe(8)
  })
})
