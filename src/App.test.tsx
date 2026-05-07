import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { installBraintwoBridge, type BridgeHandle } from './test-utils/braintwo-bridge'

// Onboarding pulls in `qrcode` which uses canvas APIs. Stub it out so the
// component subtree mounts cleanly under jsdom.
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(async () => 'data:image/png;base64,STUB')
  }
}))

describe('<App />', () => {
  let h: BridgeHandle

  beforeEach(() => {
    h = installBraintwoBridge({
      initialState: 'connecting',
      initialQr: null,
      version: '1.2.3',
      platform: 'darwin'
    })
  })

  describe('header', () => {
    it('renders BrainTwo title', async () => {
      render(<App />)
      expect(screen.getByText('BrainTwo')).toBeInTheDocument()
    })

    it('shows the connecting badge initially', async () => {
      render(<App />)
      expect(await screen.findByText('Conectando…')).toBeInTheDocument()
    })

    it('reads version + platform from the IPC bridge', async () => {
      render(<App />)
      await waitFor(() => {
        expect(screen.getByText(/v1\.2\.3/)).toBeInTheDocument()
        expect(screen.getByText(/darwin/)).toBeInTheDocument()
      })
    })
  })

  describe('status badge', () => {
    it.each([
      ['connecting', 'Conectando…'],
      ['open', 'Conectado']
    ] as const)('on %s shows %s', async (state, label) => {
      render(<App />)
      await screen.findByText('Conectando…')
      act(() => h.emitConnectionState(state))
      expect(await screen.findByText(label)).toBeInTheDocument()
    })

    // For 'disconnected' and 'logged-out' the same label appears in both
    // the header badge and the Onboarding pairing panel, so getAllByText.
    it.each([
      ['disconnected', 'Reconectando…'],
      ['logged-out', 'Sesión cerrada']
    ] as const)('on %s the header badge shows %s', async (state, label) => {
      render(<App />)
      await screen.findByText('Conectando…')
      act(() => h.emitConnectionState(state))
      await waitFor(() => {
        expect(screen.getAllByText(label).length).toBeGreaterThan(0)
      })
    })
  })

  describe('auto-routing', () => {
    it('switches to Buscar (Search view) on first open transition', async () => {
      render(<App />)
      await screen.findByText('Conectando…')
      // Onboarding shown initially
      expect(screen.getByText(/Vinculá tu WhatsApp/)).toBeInTheDocument()

      act(() => h.emitConnectionState('open'))

      await waitFor(() => {
        expect(screen.queryByText(/Vinculá tu WhatsApp/)).not.toBeInTheDocument()
      })
      expect(
        screen.getByText(/Búsqueda semántica disponible desde la Etapa 5/)
      ).toBeInTheDocument()
    })

    it('after auto-routing, subsequent open events do NOT re-route', async () => {
      render(<App />)
      await screen.findByText('Conectando…')

      act(() => h.emitConnectionState('open'))
      await waitFor(() =>
        expect(screen.queryByText(/Vinculá tu WhatsApp/)).not.toBeInTheDocument()
      )

      const user = userEvent.setup()
      // user navigates to Timeline manually
      await user.click(screen.getByRole('button', { name: 'Timeline' }))
      expect(screen.getByText(/Aún no hay mensajes/)).toBeInTheDocument()

      // a re-emit of 'open' should NOT yank them back to Search
      act(() => h.emitConnectionState('open'))
      expect(screen.getByText(/Aún no hay mensajes/)).toBeInTheDocument()
    })

    it('logged-out forces back to Onboarding even after auto-route', async () => {
      render(<App />)
      await screen.findByText('Conectando…')
      act(() => h.emitConnectionState('open'))
      await waitFor(() =>
        expect(screen.queryByText(/Vinculá tu WhatsApp/)).not.toBeInTheDocument()
      )

      act(() => h.emitConnectionState('logged-out'))
      expect(await screen.findByText(/Vinculá tu WhatsApp/)).toBeInTheDocument()
    })
  })

  describe('manual nav', () => {
    it('all three nav buttons swap the view', async () => {
      render(<App />)
      await screen.findByText('Conectando…')
      const user = userEvent.setup()

      await user.click(screen.getByRole('button', { name: 'Buscar' }))
      expect(
        screen.getByText(/Búsqueda semántica disponible desde la Etapa 5/)
      ).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Timeline' }))
      expect(screen.getByText(/Aún no hay mensajes/)).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Onboarding' }))
      expect(screen.getByText(/Vinculá tu WhatsApp/)).toBeInTheDocument()
    })
  })

  describe('IPC subscription cleanup', () => {
    it('unsubscribes connection-state listener on unmount', async () => {
      const offSpy = vi.fn()
      const original = h.bridge.wa.onConnectionState
      h.bridge.wa.onConnectionState = (cb) => {
        const real = original(cb)
        return () => {
          offSpy()
          real()
        }
      }
      const { unmount } = render(<App />)
      await screen.findByText('Conectando…')
      unmount()
      expect(offSpy).toHaveBeenCalled()
    })
  })
})
