import { describe, it, expect } from 'vitest'
import {
  playerTotal, playerVsPar, holesCompleted, isRoundComplete,
  winnerOf, initialsOf, totalPar, formatDate, formatShortDate, formatDuration, liveTimer,
  computePlayerStats,
} from '../gameLogic'
import type { Round } from '../../types'

const makeRound = (overrides: Partial<Round> = {}): Round => ({
  id: 'r1',
  course_id: 'c1',
  course_name: 'Test Course',
  pars: [3, 3, 4],
  status: 'active',
  holes_played: 0,
  created_by: 'u1',
  started_at: new Date().toISOString(),
  finished_at: null,
  players: [{ id: 'u1', name: 'Alice', color: '#FF6B1F' }],
  scores: { u1: [3, 2, null] },
  ...overrides,
})

describe('playerTotal', () => {
  it('sums strokes for scored holes', () => {
    expect(playerTotal(makeRound(), 'u1')).toBe(5)
  })
  it('stops at throughHole', () => {
    expect(playerTotal(makeRound(), 'u1', 1)).toBe(3)
  })
  it('returns 0 for unknown player', () => {
    expect(playerTotal(makeRound(), 'unknown')).toBe(0)
  })
})

describe('playerVsPar', () => {
  it('calculates score relative to par', () => {
    // hole1: 3 strokes, par 3 = E; hole2: 2 strokes, par 3 = -1
    expect(playerVsPar(makeRound(), 'u1')).toBe(-1)
  })
})

describe('holesCompleted', () => {
  it('counts holes where all players have a score', () => {
    expect(holesCompleted(makeRound())).toBe(2)
  })
  it('returns 0 for null round', () => {
    expect(holesCompleted(null as any)).toBe(0)
  })
})

describe('isRoundComplete', () => {
  it('returns false when some holes are null', () => {
    expect(isRoundComplete(makeRound())).toBe(false)
  })
  it('returns true when all holes are scored', () => {
    const r = makeRound({ scores: { u1: [3, 3, 4] } })
    expect(isRoundComplete(r)).toBe(true)
  })
})

describe('winnerOf', () => {
  it('returns the player with the lowest total', () => {
    const r = makeRound({
      players: [
        { id: 'u1', name: 'Alice', color: '#FF6B1F' },
        { id: 'u2', name: 'Bob', color: '#3A5A40' },
      ],
      scores: { u1: [3, 3, 4], u2: [4, 4, 5] },
    })
    expect(winnerOf(r)?.name).toBe('Alice')
  })
})

describe('initialsOf', () => {
  it('returns two initials for a full name', () => {
    expect(initialsOf('Alice Borg')).toBe('AB')
  })
  it('returns first two chars for single name', () => {
    expect(initialsOf('Alice')).toBe('AL')
  })
  it('returns placeholder for empty string', () => {
    expect(initialsOf('')).toBe('··')
  })
})

describe('totalPar', () => {
  it('sums par values', () => {
    expect(totalPar([3, 3, 4, 3])).toBe(13)
  })
})

describe('formatDate', () => {
  it('formats a timestamp as "Day · Month Date"', () => {
    // Jan 1, 2023, 00:00:00 UTC
    const ts = new Date('2023-01-01').getTime()
    const result = formatDate(ts)
    expect(result).toMatch(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) · (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d+$/)
  })
})

describe('formatShortDate', () => {
  it('formats a timestamp as "Month Date"', () => {
    const ts = new Date('2023-01-15').getTime()
    const result = formatShortDate(ts)
    expect(result).toMatch(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d+$/)
  })
})

describe('formatDuration', () => {
  it('formats hours and minutes', () => {
    expect(formatDuration(3600000 + 1800000)).toBe('1h 30m')
  })
  it('formats minutes only', () => {
    expect(formatDuration(600000)).toBe('10m')
  })
  it('returns dash for null', () => {
    expect(formatDuration(null as any)).toBe('—')
  })
  it('returns dash for zero', () => {
    expect(formatDuration(0)).toBe('—')
  })
})

describe('liveTimer', () => {
  it('returns mm:ss format', () => {
    const start = Date.now() - 65000
    expect(liveTimer(start)).toMatch(/^\d+:\d{2}$/)
  })
  it('shows 1:05 after 65 seconds', () => {
    const start = Date.now() - 65000
    const result = liveTimer(start)
    expect(result).toBe('1:05')
  })
})

describe('computePlayerStats', () => {
  it('returns zero stats for empty rounds', () => {
    const stats = computePlayerStats([], 'Alice')
    expect(stats.totalRounds).toBe(0)
    expect(stats.avgVs).toBe(0)
    expect(stats.birdies).toBe(0)
    expect(stats.wins).toBe(0)
    expect(stats.winPct).toBe(0)
    expect(stats.perCourse).toEqual([])
    expect(stats.h2h).toEqual([])
  })

  it('counts completed rounds only', () => {
    const rounds: Round[] = [
      makeRound({
        id: 'r1',
        finished_at: new Date().toISOString(),
        players: [
          { id: 'u1', name: 'Alice', color: '#FF6B1F' },
          { id: 'u2', name: 'Bob', color: '#3A5A40' },
        ],
        scores: { u1: [3, 3, 4], u2: [4, 4, 5] },
      }),
      makeRound({
        id: 'r2',
        finished_at: null, // active, not completed
        players: [{ id: 'u1', name: 'Alice', color: '#FF6B1F' }],
        scores: { u1: [3, null, null] },
      }),
    ]
    const stats = computePlayerStats(rounds, 'Alice')
    expect(stats.totalRounds).toBe(1)
  })

  it('calculates vs par and wins', () => {
    const rounds: Round[] = [
      makeRound({
        id: 'r1',
        finished_at: new Date().toISOString(),
        course_id: 'c1',
        course_name: 'Course 1',
        pars: [3, 3, 4],
        players: [
          { id: 'u1', name: 'Alice', color: '#FF6B1F' },
          { id: 'u2', name: 'Bob', color: '#3A5A40' },
        ],
        scores: { u1: [3, 3, 4], u2: [4, 4, 5] }, // Alice: E, Bob: +3
      }),
    ]
    const stats = computePlayerStats(rounds, 'Alice')
    expect(stats.totalRounds).toBe(1)
    expect(stats.avgVs).toBe(0)
    expect(stats.wins).toBe(1)
    expect(stats.winPct).toBe(100)
  })

  it('counts birdies', () => {
    const rounds: Round[] = [
      makeRound({
        id: 'r1',
        finished_at: new Date().toISOString(),
        pars: [3, 3, 4],
        players: [{ id: 'u1', name: 'Alice', color: '#FF6B1F' }],
        scores: { u1: [2, 3, 3] }, // birdie, par, birdie
      }),
    ]
    const stats = computePlayerStats(rounds, 'Alice')
    expect(stats.birdies).toBe(2)
  })

  it('tracks per-course stats', () => {
    const rounds: Round[] = [
      makeRound({
        id: 'r1',
        finished_at: new Date().toISOString(),
        course_id: 'c1',
        course_name: 'Course A',
        pars: [3, 3, 4],
        players: [{ id: 'u1', name: 'Alice', color: '#FF6B1F' }],
        scores: { u1: [3, 3, 4] },
      }),
      makeRound({
        id: 'r2',
        finished_at: new Date().toISOString(),
        course_id: 'c1',
        course_name: 'Course A',
        pars: [3, 3, 4],
        players: [{ id: 'u1', name: 'Alice', color: '#FF6B1F' }],
        scores: { u1: [4, 3, 5] },
      }),
    ]
    const stats = computePlayerStats(rounds, 'Alice')
    expect(stats.perCourse.length).toBe(1)
    expect(stats.perCourse[0].courseName).toBe('Course A')
    expect(stats.perCourse[0].rounds).toBe(2)
  })

  it('tracks head-to-head records', () => {
    const rounds: Round[] = [
      makeRound({
        id: 'r1',
        finished_at: new Date().toISOString(),
        pars: [3, 3, 4],
        players: [
          { id: 'u1', name: 'Alice', color: '#FF6B1F' },
          { id: 'u2', name: 'Bob', color: '#3A5A40' },
        ],
        scores: { u1: [3, 3, 4], u2: [4, 4, 5] }, // Alice wins
      }),
    ]
    const stats = computePlayerStats(rounds, 'Alice')
    expect(stats.h2h.length).toBe(1)
    expect(stats.h2h[0].name).toBe('Bob')
    expect(stats.h2h[0].w).toBe(1)
    expect(stats.h2h[0].l).toBe(0)
  })
})
