import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Icon, BrainMark, type IconName } from '../../../src/lib/icons'

const ALL_ICONS: IconName[] = [
  'home',
  'search',
  'folder',
  'archive',
  'settings',
  'plus',
  'mic',
  'bolt',
  'wa',
  'play',
  'pause',
  'chev',
  'tag',
  'logout',
  'check',
  'x'
]

describe('Icon', () => {
  it.each(ALL_ICONS)('renders %s with the requested size', (name) => {
    const { container } = render(<Icon name={name} size={24} />)
    const svg = container.querySelector('svg')!
    expect(svg).toBeInTheDocument()
    expect(svg.getAttribute('width')).toBe('24')
    expect(svg.getAttribute('height')).toBe('24')
    expect(svg.children.length).toBeGreaterThan(0)
  })

  it('honors aria-hidden by default', () => {
    const { container } = render(<Icon name="home" />)
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('passes className through', () => {
    const { container } = render(<Icon name="home" className="text-bt-primary" />)
    expect(container.querySelector('svg')!.classList.contains('text-bt-primary')).toBe(true)
  })

  it('renders nothing for an unknown name', () => {
    // Type-cast to bypass the union; defensive default branch.
    const { container } = render(<Icon name={'__nope__' as IconName} />)
    expect(container.querySelector('svg')!.children.length).toBe(0)
  })
})

describe('BrainMark', () => {
  it('renders an SVG with the given size', () => {
    const { container } = render(<BrainMark size={48} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('48')
    expect(svg.getAttribute('height')).toBe('48')
  })

  it('uses a unique gradient id per instance', () => {
    const { container: a } = render(<BrainMark size={26} />)
    const { container: b } = render(<BrainMark size={26} />)
    const idA = a.querySelector('linearGradient')!.getAttribute('id')!
    const idB = b.querySelector('linearGradient')!.getAttribute('id')!
    expect(idA).not.toBe(idB)
  })
})
