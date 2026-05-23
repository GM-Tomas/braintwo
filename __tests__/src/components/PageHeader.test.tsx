import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from '../../../src/components/PageHeader'

describe('<PageHeader />', () => {
  it('renders the title as an h1', () => {
    render(<PageHeader title="Hola" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Hola' })).toBeInTheDocument()
  })

  it('renders eyebrow when provided', () => {
    render(<PageHeader eyebrow="Búsqueda" title="Hola" />)
    expect(screen.getByText('Búsqueda')).toBeInTheDocument()
  })

  it('omits eyebrow when not provided', () => {
    render(<PageHeader title="Solo título" />)
    // Only the h1 should render in the inner column
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.queryByText(/Solo título/)).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(<PageHeader title="X" subtitle="bajada de prueba" />)
    expect(screen.getByText('bajada de prueba')).toBeInTheDocument()
  })

  it('renders action node when provided', () => {
    render(
      <PageHeader
        title="X"
        action={<button type="button">Acción</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'Acción' })).toBeInTheDocument()
  })
})
