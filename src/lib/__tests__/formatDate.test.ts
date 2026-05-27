import { describe, it, expect } from 'vitest'
import { formatLastPlayed } from '../formatDate'

// Fixed reference point: May 27, 2026 at noon (local)
const NOW = new Date(2026, 4, 27, 12, 0, 0)

describe('formatLastPlayed', () => {
  it('returns "Today" for a timestamp from the same calendar day', () => {
    const date = new Date(2026, 4, 27, 8, 30, 0)
    expect(formatLastPlayed(date.toISOString(), NOW)).toBe('Today')
  })

  it('returns "Yesterday" for a timestamp from the previous day', () => {
    const date = new Date(2026, 4, 26, 15, 0, 0)
    expect(formatLastPlayed(date.toISOString(), NOW)).toBe('Yesterday')
  })

  it('returns "X days ago" for 2 days', () => {
    const date = new Date(2026, 4, 25, 10, 0, 0)
    expect(formatLastPlayed(date.toISOString(), NOW)).toBe('2 days ago')
  })

  it('returns "X days ago" for 6 days', () => {
    const date = new Date(2026, 4, 21, 10, 0, 0)
    expect(formatLastPlayed(date.toISOString(), NOW)).toBe('6 days ago')
  })

  it('returns "D Mon" for 7 days', () => {
    const date = new Date(2026, 4, 20, 10, 0, 0)
    expect(formatLastPlayed(date.toISOString(), NOW)).toBe('20 May')
  })

  it('returns "D Mon" for dates in a different month', () => {
    const date = new Date(2026, 2, 15, 10, 0, 0)
    expect(formatLastPlayed(date.toISOString(), NOW)).toBe('15 Mar')
  })

  it('uses current time as default when now is omitted', () => {
    // Just verifies it runs without error — the result depends on real clock
    expect(() => formatLastPlayed(new Date().toISOString())).not.toThrow()
  })
})
