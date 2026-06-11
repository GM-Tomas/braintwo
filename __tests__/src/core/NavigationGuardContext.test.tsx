import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  NavigationGuardContext,
  useNavigationGuard,
  type ExitGuard
} from '../../../src/core/NavigationGuardContext'

function Consumer({ onMount }: { onMount?: (g: ReturnType<typeof useNavigationGuard>) => void }) {
  const guard = useNavigationGuard()
  if (onMount) onMount(guard)
  return <div data-testid="consumer" />
}

function Host({
  initial = 'a',
  guard
}: {
  initial?: string
  guard?: ExitGuard | null
}) {
  const [view, setViewRaw] = useState(initial)
  const exitGuardRef = useRef<ExitGuard | null>(guard ?? null)
  const setView = useCallback((v: string) => {
    if (exitGuardRef.current && !exitGuardRef.current()) return
    setViewRaw(v)
  }, [])
  const navigationGuard = useMemo(
    () => ({ registerGuard: (fn: ExitGuard | null) => { exitGuardRef.current = fn } }),
    []
  )
  return (
    <NavigationGuardContext.Provider value={navigationGuard}>
      <div data-testid="view">{view}</div>
      <button type="button" onClick={() => setView('b')}>go-b</button>
      <Consumer onMount={() => { /* triggers context plumbing */ }} />
    </NavigationGuardContext.Provider>
  )
}

describe('NavigationGuardContext', () => {
  it('useNavigationGuard throws when used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Consumer />)).toThrow(
      /useNavigationGuard must be used within NavigationGuardContext.Provider/
    )
    spy.mockRestore()
  })

  it('useNavigationGuard returns the provided guard object', () => {
    const captured: ReturnType<typeof useNavigationGuard>[] = []
    render(
      <NavigationGuardContext.Provider value={{ registerGuard: vi.fn() }}>
        <Consumer onMount={(g) => captured.push(g)} />
      </NavigationGuardContext.Provider>
    )
    expect(captured[0]).toBeDefined()
    expect(typeof captured[0].registerGuard).toBe('function')
  })

  it('allows navigation when no guard is registered', async () => {
    render(<Host />)
    expect(screen.getByTestId('view')).toHaveTextContent('a')
    await userEvent.click(screen.getByRole('button', { name: 'go-b' }))
    expect(screen.getByTestId('view')).toHaveTextContent('b')
  })

  it('blocks navigation when an exit guard returns false', async () => {
    render(<Host guard={() => false} />)
    await userEvent.click(screen.getByRole('button', { name: 'go-b' }))
    expect(screen.getByTestId('view')).toHaveTextContent('a')
  })

  it('allows navigation when the registered guard returns true', async () => {
    render(<Host guard={() => true} />)
    await userEvent.click(screen.getByRole('button', { name: 'go-b' }))
    expect(screen.getByTestId('view')).toHaveTextContent('b')
  })

  it('registerGuard(null) removes a previously-registered guard', async () => {
    let captured: ReturnType<typeof useNavigationGuard> | null = null
    function Capture() {
      captured = useNavigationGuard()
      return null
    }
    function GuardedHost() {
      const [view, setViewRaw] = useState('a')
      const exitGuardRef = useRef<ExitGuard | null>(() => false)
      const setView = useCallback((v: string) => {
        if (exitGuardRef.current && !exitGuardRef.current()) return
        setViewRaw(v)
      }, [])
      const navigationGuard = useMemo(
        () => ({ registerGuard: (fn: ExitGuard | null) => { exitGuardRef.current = fn } }),
        []
      )
      return (
        <NavigationGuardContext.Provider value={navigationGuard}>
          <div data-testid="view">{view}</div>
          <button type="button" onClick={() => setView('b')}>go-b</button>
          <Capture />
        </NavigationGuardContext.Provider>
      )
    }
    render(<GuardedHost />)
    // guard returns false initially — click blocked
    await userEvent.click(screen.getByRole('button', { name: 'go-b' }))
    expect(screen.getByTestId('view')).toHaveTextContent('a')
    // clear guard from outside via the captured context
    act(() => { captured!.registerGuard(null) })
    await userEvent.click(screen.getByRole('button', { name: 'go-b' }))
    expect(screen.getByTestId('view')).toHaveTextContent('b')
  })
})
