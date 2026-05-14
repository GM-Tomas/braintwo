import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Search } from './Search'
import { installBraintwoBridge } from '../test-utils/braintwo-bridge'

describe('<Search />', () => {
  beforeEach(() => {
    installBraintwoBridge({
      searchResults: [
        {
          id: 1,
          wa_msg_id: 'a',
          timestamp: 1700000000000,
          text: 'Ideas sobre BrainTwo',
          source: 'realtime',
          kind: 'text',
          distance: 0.12,
          similarity: 0.88
        }
      ]
    })
  })

  it('renders the page header', () => {
    render(<Search />)
    expect(screen.getByText('Busqueda')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Preguntale a tu cerebro/ })
    ).toBeInTheDocument()
  })

  it('focuses the search input on mount', async () => {
    render(<Search />)
    const input = screen.getByRole('searchbox', { name: /Buscar en BrainTwo/ })
    await new Promise((r) => setTimeout(r, 150))
    expect(input).toHaveFocus()
  })

  it('lists suggested questions when the input is empty', () => {
    render(<Search />)
    expect(screen.getByText('Proba preguntar')).toBeInTheDocument()
    expect(screen.getByText('Ideas sobre BrainTwo')).toBeInTheDocument()
  })

  it('debounces and renders semantic results', async () => {
    render(<Search />)
    const user = userEvent.setup()
    await user.type(screen.getByRole('searchbox', { name: /Buscar en BrainTwo/ }), 'brain')
    await waitFor(() => expect(screen.getByText('88%')).toBeInTheDocument())
    expect(screen.getByText('Ideas sobre BrainTwo')).toBeInTheDocument()
  })

  it('the limpiar button resets the input', async () => {
    render(<Search />)
    const user = userEvent.setup()
    await user.click(screen.getByText('Ideas sobre BrainTwo'))
    await user.click(screen.getByRole('button', { name: 'limpiar' }))
    expect(
      screen.getByRole('searchbox', { name: /Buscar en BrainTwo/ })
    ).toHaveValue('')
  })
})
