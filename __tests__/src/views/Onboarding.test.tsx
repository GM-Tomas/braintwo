import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Onboarding, FTU } from '../../../src/views/Onboarding'
import {
  installBraintwoBridge,
  type BridgeHandle
} from '../test-utils/braintwo-bridge'

// vi.mock factories are hoisted above all imports — use vi.hoisted to share
// the mock fn between the factory and the test body.
const { toDataURL } = vi.hoisted(() => ({
  toDataURL: vi.fn(async (_payload: string) => 'data:image/png;base64,FAKE')
}))

vi.mock('qrcode', () => ({
  default: { toDataURL }
}))

describe('<Onboarding />', () => {
  let h: BridgeHandle

  beforeEach(() => {
    toDataURL.mockClear()
    toDataURL.mockResolvedValue('data:image/png;base64,FAKE')
  })

  describe('headline + description', () => {
    beforeEach(() => {
      h = installBraintwoBridge({ initialState: 'connecting' })
    })

    it('renders the title and privacy promise', () => {
      render(<Onboarding />)
      expect(screen.getByText('Vinculá tu WhatsApp')).toBeInTheDocument()
      expect(
        screen.getByText(/Tus mensajes se procesan localmente/)
      ).toBeInTheDocument()
    })
  })

  describe('connecting (no QR yet)', () => {
    beforeEach(() => {
      h = installBraintwoBridge({ initialState: 'connecting', initialQr: null })
    })

    it('shows "Generando QR…" status', async () => {
      render(<Onboarding />)
      expect(await screen.findByText(/Generando QR…/)).toBeInTheDocument()
    })

    it('does NOT render an <img> when no qr is present', async () => {
      render(<Onboarding />)
      await screen.findByText(/Generando QR…/)
      expect(screen.queryByRole('img', { name: /QR/i })).not.toBeInTheDocument()
    })

    it('shows step 3 prompting to wait', async () => {
      render(<Onboarding />)
      expect(
        await screen.findByText(/Esperá a que aparezca el código acá/)
      ).toBeInTheDocument()
    })
  })

  describe('connecting + QR seeded on mount', () => {
    beforeEach(() => {
      h = installBraintwoBridge({
        initialState: 'connecting',
        initialQr: 'EXISTING-PAYLOAD'
      })
    })

    it('renders QR <img> with the dataURL produced by qrcode', async () => {
      render(<Onboarding />)
      const img = await screen.findByRole('img', { name: /QR/i })
      expect(img).toHaveAttribute('src', 'data:image/png;base64,FAKE')
      expect(toDataURL).toHaveBeenCalledWith(
        'EXISTING-PAYLOAD',
        expect.objectContaining({ width: 280 })
      )
    })

    it('updates step 3 to "Escaneá el código" once the QR is rendered', async () => {
      render(<Onboarding />)
      await screen.findByRole('img', { name: /QR/i })
      expect(screen.getByText(/Escaneá el código/)).toBeInTheDocument()
    })
  })

  describe('QR refresh after mount', () => {
    beforeEach(() => {
      h = installBraintwoBridge({
        initialState: 'connecting',
        initialQr: 'A-INITIAL'
      })
    })

    it('replaces the QR when a newer one arrives', async () => {
      render(<Onboarding />)
      await screen.findByRole('img', { name: /QR/i })
      expect(toDataURL).toHaveBeenLastCalledWith(
        'A-INITIAL',
        expect.objectContaining({ width: 280 })
      )

      act(() => h.emitQr('B-NEWER'))
      await waitFor(() => {
        expect(toDataURL).toHaveBeenLastCalledWith(
          'B-NEWER',
          expect.objectContaining({ width: 280 })
        )
      })
    })
  })

  describe('disconnected', () => {
    beforeEach(() => {
      h = installBraintwoBridge({ initialState: 'disconnected' })
    })

    it('shows "No se pudo conectar" status', async () => {
      render(<Onboarding />)
      expect(await screen.findByText(/No se pudo conectar/)).toBeInTheDocument()
    })
  })

  describe('open (paired)', () => {
    beforeEach(() => {
      h = installBraintwoBridge({ initialState: 'open' })
    })

    it('shows the success ✓ panel', async () => {
      render(<Onboarding />)
      await screen.findByText('✓')
      // Constrain to the <p> tag so we don't match the bubbled text on
      // ancestor containers.
      expect(
        screen.getByText(/Ya pod[eé]s cerrar este panel/, { selector: 'p' })
      ).toBeInTheDocument()
    })

    it('hides the steps list once paired', async () => {
      render(<Onboarding />)
      await screen.findByText('✓')
      expect(
        screen.queryByText(/Configuración → Dispositivos vinculados/)
      ).not.toBeInTheDocument()
    })
  })

  describe('logged-out', () => {
    beforeEach(() => {
      h = installBraintwoBridge({ initialState: 'logged-out' })
    })

    it('shows the "Generar QR de nuevo" button', async () => {
      render(<Onboarding />)
      expect(
        await screen.findByRole('button', { name: /Generar QR de nuevo/ })
      ).toBeInTheDocument()
    })

    it('clicking the button calls wa.requestQr', async () => {
      render(<Onboarding />)
      const btn = await screen.findByRole('button', {
        name: /Generar QR de nuevo/
      })
      const user = userEvent.setup()
      await user.click(btn)
      expect(h.spies.requestQr).toHaveBeenCalledTimes(1)
    })

    it('hides any cached QR (logged-out branch ignores qrDataUrl)', async () => {
      // Even with a stale QR set later, the panel renders the logout UI.
      render(<Onboarding />)
      act(() => h.emitQr('STALE'))
      // wait a tick to let the QR effect run if it were going to render
      await waitFor(() => {
        expect(screen.queryByRole('img', { name: /QR/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('logged-out clears stale QR display', () => {
    beforeEach(() => {
      h = installBraintwoBridge({
        initialState: 'connecting',
        initialQr: 'WILL-BE-CLEARED'
      })
    })

    it('removes the QR <img> when wa:logged-out fires', async () => {
      render(<Onboarding />)
      await screen.findByRole('img', { name: /QR/i })

      act(() => h.emitLoggedOut())
      await waitFor(() => {
        expect(
          screen.queryByRole('img', { name: /QR/i })
        ).not.toBeInTheDocument()
      })
    })
  })

  describe('<FTU />', () => {
    beforeEach(() => {
      installBraintwoBridge({ initialState: 'connecting' })
    })

    it('renders the splash card on first render', () => {
      render(<FTU />)
      expect(screen.getByText('BRAINTWO')).toBeInTheDocument()
      expect(screen.getByText(/Tu segundo cerebro/)).toBeInTheDocument()
    })

    it('advances to the search card when Siguiente is clicked', async () => {
      render(<FTU />)
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /Siguiente/ }))
      expect(await screen.findByText(/BUSCÁ EN TU HISTORIAL/)).toBeInTheDocument()
    })

    it('reaches the QR step after clicking Siguiente three times', async () => {
      render(<FTU />)
      const user = userEvent.setup()
      for (let i = 0; i < 3; i++) {
        await user.click(screen.getByRole('button', { name: /Siguiente/ }))
      }
      expect(await screen.findByText(/VINCULÁ TU WHATSAPP/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Siguiente/ })).not.toBeInTheDocument()
    })

    it('starts at the QR step when startAtQr is true', async () => {
      render(<FTU startAtQr />)
      expect(await screen.findByText(/VINCULÁ TU WHATSAPP/)).toBeInTheDocument()
    })
  })

  describe('cleanup', () => {
    beforeEach(() => {
      h = installBraintwoBridge({ initialState: 'connecting' })
    })

    it('unsubscribes from all wa events on unmount', () => {
      const offState = vi.fn()
      const offQr = vi.fn()
      const offLogout = vi.fn()
      const orig = {
        s: h.bridge.wa.onConnectionState,
        q: h.bridge.wa.onQr,
        l: h.bridge.wa.onLoggedOut
      }
      h.bridge.wa.onConnectionState = (cb: any) => {
        const real = orig.s(cb)
        return () => {
          offState()
          real()
        }
      }
      h.bridge.wa.onQr = (cb: any) => {
        const real = orig.q(cb)
        return () => {
          offQr()
          real()
        }
      }
      h.bridge.wa.onLoggedOut = (cb: any) => {
        const real = orig.l(cb)
        return () => {
          offLogout()
          real()
        }
      }

      const { unmount } = render(<Onboarding />)
      unmount()
      expect(offState).toHaveBeenCalled()
      expect(offQr).toHaveBeenCalled()
      expect(offLogout).toHaveBeenCalled()
    })
  })
})
