import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '../../../src/components/ErrorBoundary'

function Bomb({ message = 'kaboom' }: { message?: string }): never {
  throw new Error(message)
}

describe('<ErrorBoundary />', () => {
  let errSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // React logs the error itself; silence the noise so test output stays clean.
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errSpy.mockRestore()
  })

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>healthy</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('healthy')).toBeInTheDocument()
  })

  it('renders the fallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb message="custom message" />
      </ErrorBoundary>
    )
    expect(screen.getByText(/Error en la UI/)).toBeInTheDocument()
    expect(screen.getByText(/Algo se rompió al renderizar/)).toBeInTheDocument()
    expect(screen.getByText(/custom message/)).toBeInTheDocument()
  })

  it('logs the captured error via console.error', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    )
    const calls = errSpy.mock.calls.map((c) => String(c[0]))
    expect(calls.some((s) => s.includes('App ErrorBoundary'))).toBe(true)
  })
})
