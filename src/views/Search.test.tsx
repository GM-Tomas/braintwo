import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Search } from './Search'

describe('<Search />', () => {
  it('renders the page header (eyebrow + title)', () => {
    render(<Search />)
    expect(screen.getByText('Búsqueda')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Preguntale a tu cerebro/ })
    ).toBeInTheDocument()
  })

  it('shows the placeholder explaining Etapa 5', () => {
    render(<Search />)
    expect(
      screen.getByText(/Búsqueda semántica disponible desde la Etapa 5/)
    ).toBeInTheDocument()
  })

  it('focuses the search input on mount', async () => {
    render(<Search />)
    const input = screen.getByRole('searchbox', { name: /Buscar en BrainTwo/ })
    // useEffect schedules focus on next tick; advance microtask + 100ms
    await new Promise((r) => setTimeout(r, 150))
    expect(input).toHaveFocus()
  })

  it('lists the suggested questions when the input is empty', () => {
    render(<Search />)
    expect(screen.getByText('Probá preguntar')).toBeInTheDocument()
    expect(screen.getByText('Ideas sobre BrainTwo')).toBeInTheDocument()
  })

  it('clicking a suggestion fills the search input', async () => {
    render(<Search />)
    const user = userEvent.setup()
    await user.click(screen.getByText('Ideas sobre BrainTwo'))
    expect(
      screen.getByRole('searchbox', { name: /Buscar en BrainTwo/ })
    ).toHaveValue('Ideas sobre BrainTwo')
  })

  it('typing swaps from suggestions to the coming-soon panel', async () => {
    render(<Search />)
    const user = userEvent.setup()
    const input = screen.getByRole('searchbox', { name: /Buscar en BrainTwo/ })
    await user.click(input)
    await user.keyboard('reunion')
    expect(screen.queryByText('Probá preguntar')).not.toBeInTheDocument()
    expect(screen.getByText(/"reunion"/)).toBeInTheDocument()
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
