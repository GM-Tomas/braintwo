import { describe, expect, it } from 'vitest'
import { parseFtsQuery } from '../../../electron/services/db'

describe('parseFtsQuery', () => {
  it('returns empty string for empty or whitespace query', () => {
    expect(parseFtsQuery('')).toBe('')
    expect(parseFtsQuery('   ')).toBe('')
  })

  it('preserves exact phrase searches when already wrapped in double quotes', () => {
    expect(parseFtsQuery('"carpintero madera"')).toBe('"carpintero madera"')
    expect(parseFtsQuery('"médico"')).toBe('"médico"')
  })

  it('converts single word query into quoted term with prefix wildcard', () => {
    expect(parseFtsQuery('medico')).toBe('"medico"*')
    expect(parseFtsQuery('médico')).toBe('"médico"*')
  })

  it('converts multi-word query into AND terms with prefix wildcards', () => {
    expect(parseFtsQuery('carpintero madera')).toBe('"carpintero"* AND "madera"*')
  })

  it('ignores extra spaces between terms', () => {
    expect(parseFtsQuery('   carpintero    madera   ')).toBe('"carpintero"* AND "madera"*')
  })

  it('strips quotes, wildcards, and special characters to prevent FTS5 syntax errors', () => {
    expect(parseFtsQuery('carpintero\'s "madera"*')).toBe('"carpinteros"* AND "madera"*')
  })
})
