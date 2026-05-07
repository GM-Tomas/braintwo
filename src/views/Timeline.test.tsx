import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Timeline } from './Timeline'

describe('<Timeline />', () => {
  it('renders the title', () => {
    render(<Timeline />)
    expect(screen.getByText('Timeline')).toBeInTheDocument()
  })

  it('shows the placeholder explaining Etapa 6', () => {
    render(<Timeline />)
    expect(screen.getByText(/Cronología completa disponible/)).toBeInTheDocument()
  })
})
