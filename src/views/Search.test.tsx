import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Search } from './Search'

describe('<Search />', () => {
  it('renders the title', () => {
    render(<Search />)
    expect(screen.getByText('Buscar')).toBeInTheDocument()
  })

  it('shows the placeholder explaining Etapa 5', () => {
    render(<Search />)
    expect(
      screen.getByText(/Búsqueda semántica disponible desde la Etapa 5/)
    ).toBeInTheDocument()
  })
})
