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

const FTU_KEY = 'braintwo:ftu-seen'
const ONBOARDED_KEY = 'braintwo:onboarded'

function markOnboarded() {
  window.localStorage.setItem(FTU_KEY, '1')
  window.localStorage.setItem(ONBOARDED_KEY, '1')
}

function markFtuSeen() {
  window.localStorage.setItem(FTU_KEY, '1')
}

describe('<App />', () => {
  let h: BridgeHandle

  beforeEach(() => {
    window.localStorage.clear()
    h = installBraintwoBridge({
      initialState: 'connecting',
      initialQr: null,
      version: '1.2.3',
      platform: 'darwin'
    })
  })

  describe('phase: welcome (FTU)', () => {
    it('renders feature cards and the Continuar button on first launch', () => {
      render(<App />)
      expect(screen.getByText(/Tu segundo cerebro de WhatsApp/)).toBeInTheDocument()
      expect(screen.getByText(/Buscá en tu historial/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Continuar/ })).toBeInTheDocument()
    })

    it('does NOT render the sidebar during welcome', () => {
      render(<App />)
      expect(
        screen.queryByRole('navigation', { name: /Navegación principal/ })
      ).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Buscar' })).not.toBeInTheDocument()
    })

    it('clicking Continuar moves to the QR phase', async () => {
      render(<App />)
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /Continuar/ }))
      expect(screen.getByText('Vinculá tu WhatsApp')).toBeInTheDocument()
      expect(window.localStorage.getItem(FTU_KEY)).toBe('1')
    })
  })

  describe('phase: qr (FTU already seen)', () => {
    beforeEach(() => {
      markFtuSeen()
    })

    it('skips welcome and shows the QR onboarding directly', () => {
      render(<App />)
      expect(screen.getByText('Vinculá tu WhatsApp')).toBeInTheDocument()
      expect(screen.queryByText(/Tu segundo cerebro de WhatsApp/)).not.toBeInTheDocument()
    })

    it('does NOT render the sidebar while waiting for pairing', () => {
      render(<App />)
      expect(screen.queryByRole('button', { name: 'Buscar' })).not.toBeInTheDocument()
    })
  })

  describe('phase: app (already onboarded)', () => {
    beforeEach(() => {
      markOnboarded()
    })

    it('renders the sidebar with title and status badge', async () => {
      render(<App />)
      expect(screen.getByText('BrainTwo')).toBeInTheDocument()
      expect(await screen.findByText('Conectando')).toBeInTheDocument()
    })

    it('reads version + platform from the IPC bridge', async () => {
      render(<App />)
      await waitFor(() => {
        expect(screen.getByText(/v1\.2\.3/)).toBeInTheDocument()
        expect(screen.getByText(/darwin/)).toBeInTheDocument()
      })
    })

    it.each([
      ['connecting', 'Conectando'],
      ['open', 'Al dia']
    ] as const)('on %s the sidebar shows %s', async (state, label) => {
      render(<App />)
      await screen.findByText('Conectando')
      act(() => h.emitConnectionState(state))
      expect(await screen.findByText(label)).toBeInTheDocument()
    })

    it('on disconnected the sidebar status shows Reconectando', async () => {
      render(<App />)
      await screen.findByText(/Conectando/)
      act(() => h.emitConnectionState('disconnected'))
      await waitFor(() => {
        expect(screen.getAllByText('Reconectando').length).toBeGreaterThan(0)
      })
    })
  })

  describe('auto-routing', () => {
    it('welcome → continuar → QR → open routes to Search with sidebar', async () => {
      render(<App />)
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /Continuar/ }))
      expect(screen.getByText(/Vinculá tu WhatsApp/)).toBeInTheDocument()

      act(() => h.emitConnectionState('open'))

      await waitFor(() => {
        expect(screen.queryByText(/Vinculá tu WhatsApp/)).not.toBeInTheDocument()
      })
      expect(screen.getByText('Proba preguntar')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Timeline' })).toBeInTheDocument()
      expect(window.localStorage.getItem(ONBOARDED_KEY)).toBe('1')
    })

    it('after auto-routing, subsequent open events do NOT re-route', async () => {
      markOnboarded()
      render(<App />)
      await screen.findByText('Conectando')

      act(() => h.emitConnectionState('open'))
      await waitFor(() =>
        expect(screen.getByText('Proba preguntar')).toBeInTheDocument()
      )

      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Timeline' }))
      expect(screen.getByText(/Aún no hay mensajes/)).toBeInTheDocument()

      act(() => h.emitConnectionState('open'))
      expect(screen.getByText(/Aún no hay mensajes/)).toBeInTheDocument()
    })

    it('logged-out from app phase falls back to QR (skipping welcome)', async () => {
      markOnboarded()
      render(<App />)
      await screen.findByText('Conectando')

      act(() => h.emitConnectionState('logged-out'))
      expect(await screen.findByText(/Vinculá tu WhatsApp/)).toBeInTheDocument()
      expect(screen.queryByText(/Tu segundo cerebro de WhatsApp/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Buscar' })).not.toBeInTheDocument()
    })
  })

  describe('manual nav (within app phase)', () => {
    beforeEach(() => {
      markOnboarded()
    })

    it('both nav buttons swap the view', async () => {
      render(<App />)
      await screen.findByText('Conectando')
      const user = userEvent.setup()

      await user.click(screen.getByRole('button', { name: 'Buscar' }))
      expect(screen.getByText('Proba preguntar')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Timeline' }))
      expect(screen.getByText(/Aún no hay mensajes/)).toBeInTheDocument()
    })

    it('does NOT expose an Onboarding nav button after onboarding', async () => {
      render(<App />)
      await screen.findByText('Conectando')
      expect(
        screen.queryByRole('button', { name: 'Onboarding' })
      ).not.toBeInTheDocument()
    })
  })

  describe('IPC subscription cleanup', () => {
    beforeEach(() => {
      markOnboarded()
    })

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
      await screen.findByText(/Conectando/)
      unmount()
      expect(offSpy).toHaveBeenCalled()
    })
  })
})
