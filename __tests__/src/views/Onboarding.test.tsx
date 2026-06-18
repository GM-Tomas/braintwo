import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FTU } from '../../../src/views/Onboarding'
import { installBraintwoBridge } from '../test-utils/braintwo-bridge'

// vi.mock factories are hoisted above all imports — use vi.hoisted to share
// the mock fn between the factory and the test body.
const { toDataURL } = vi.hoisted(() => ({
  toDataURL: vi.fn(async (_payload: string) => 'data:image/png;base64,FAKE')
}))

vi.mock('qrcode', () => ({
  default: { toDataURL }
}))

describe('<FTU />', () => {
  beforeEach(() => {
    toDataURL.mockClear()
    toDataURL.mockResolvedValue('data:image/png;base64,FAKE')
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
