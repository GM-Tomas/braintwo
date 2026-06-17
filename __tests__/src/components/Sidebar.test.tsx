import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from '../../../src/components/Sidebar'

describe('<Sidebar />', () => {
  it('exposes the BrainTwo wordmark accessibly (sr-only)', () => {
    const setView = vi.fn()
    render(<Sidebar view="search" setView={setView} connectionState="connecting" />)
    expect(screen.getByText('BrainTwo')).toBeInTheDocument()
  })

  it('renders the post-onboarding nav buttons with accessible names', () => {
    const setView = vi.fn()
    render(<Sidebar view="chat" setView={setView} connectionState="open" />)
    expect(screen.getByRole('button', { name: 'Chat IA' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mis mensajes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajustes' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Onboarding' })).not.toBeInTheDocument()
  })

  it('marks the current view with aria-current=page', () => {
    const setView = vi.fn()
    render(<Sidebar view="chat" setView={setView} connectionState="open" />)
    expect(screen.getByRole('button', { name: 'Chat IA' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('button', { name: 'Mis mensajes' })).not.toHaveAttribute(
      'aria-current'
    )
  })

  it('clicking a nav button calls setView with the view id', async () => {
    const setView = vi.fn()
    render(<Sidebar view="search" setView={setView} connectionState="connecting" />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Mis mensajes' }))
    expect(setView).toHaveBeenCalledWith('timeline')
  })

  it.each([
    ['connecting', 'Conectando...'],
    ['open', 'Conectado'],
    ['disconnected', 'Reconectando...'],
    ['logged-out', 'Sesión cerrada']
  ] as const)('shows the connection label for %s', (state, label) => {
    const setView = vi.fn()
    render(<Sidebar view="search" setView={setView} connectionState={state} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('renders version + platform footer when both are provided', () => {
    const setView = vi.fn()
    render(
      <Sidebar
        view="search"
        setView={setView}
        connectionState="open"
        version="1.2.3"
        platform="darwin"
      />
    )
    expect(screen.getByText(/v1\.2\.3/)).toBeInTheDocument()
    expect(screen.getByText(/darwin/)).toBeInTheDocument()
  })

  it('omits the footer version when no version/platform supplied', () => {
    const setView = vi.fn()
    render(<Sidebar view="search" setView={setView} connectionState="open" />)
    expect(screen.queryByText(/v\d/)).not.toBeInTheDocument()
  })

  it('renders only the platform when version is missing', () => {
    const setView = vi.fn()
    render(
      <Sidebar
        view="search"
        setView={setView}
        connectionState="open"
        platform="linux"
      />
    )
    expect(screen.getByText('linux')).toBeInTheDocument()
  })

  it('always renders the by-Syntropy stamp', () => {
    const setView = vi.fn()
    render(<Sidebar view="search" setView={setView} connectionState="open" />)
    expect(screen.getByText('by Syntropy')).toBeInTheDocument()
  })
})
