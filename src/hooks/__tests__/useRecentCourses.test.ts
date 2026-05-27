import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../services/rounds', () => ({
  getPlayerRoundsWithData: vi.fn().mockResolvedValue([]),
}))

import * as roundsService from '../../services/rounds'
import { useRecentCourses } from '../useRecentCourses'
import type { Round } from '../../types'

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    id: 'r1',
    course_id: 'c1',
    course_name: 'Test Course',
    pars: [3, 3, 3],
    status: 'finished',
    holes_played: 3,
    created_by: 'u1',
    started_at: '2026-05-20T10:00:00Z',
    finished_at: '2026-05-20T11:00:00Z',
    players: [],
    scores: {},
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('useRecentCourses', () => {
  it('returns empty array and loading=false when userId is undefined', async () => {
    const { result } = renderHook(() => useRecentCourses(undefined))
    await act(async () => {})
    expect(result.current.recentCourses).toHaveLength(0)
    expect(result.current.loading).toBe(false)
    expect(roundsService.getPlayerRoundsWithData).not.toHaveBeenCalled()
  })

  it('returns a RecentCourse for each unique course_id played', async () => {
    vi.mocked(roundsService.getPlayerRoundsWithData).mockResolvedValue([
      makeRound({ id: 'r1', course_id: 'c1', course_name: 'Alpha', started_at: '2026-05-25T10:00:00Z', finished_at: '2026-05-25T11:00:00Z' }),
      makeRound({ id: 'r2', course_id: 'c2', course_name: 'Beta', started_at: '2026-05-22T10:00:00Z' }),
    ])

    const { result } = renderHook(() => useRecentCourses('u1'))
    await act(async () => {})

    expect(result.current.recentCourses).toHaveLength(2)
    expect(result.current.recentCourses[0]).toEqual({
      courseId: 'c1',
      courseName: 'Alpha',
      pars: [3, 3, 3],
      lastPlayedAt: '2026-05-25T11:00:00Z',
    })
  })

  it('deduplicates: keeps the most recent play when a course appears multiple times', async () => {
    vi.mocked(roundsService.getPlayerRoundsWithData).mockResolvedValue([
      // rounds are newest-first (service guarantees this)
      makeRound({ id: 'r3', course_id: 'c1', started_at: '2026-05-25T10:00:00Z', finished_at: '2026-05-25T11:00:00Z' }),
      makeRound({ id: 'r1', course_id: 'c1', started_at: '2026-05-10T10:00:00Z' }),
      makeRound({ id: 'r2', course_id: 'c2', course_name: 'Beta', started_at: '2026-05-20T10:00:00Z' }),
    ])

    const { result } = renderHook(() => useRecentCourses('u1'))
    await act(async () => {})

    expect(result.current.recentCourses).toHaveLength(2)
    // c1 appears with the most recent play date
    expect(result.current.recentCourses[0].courseId).toBe('c1')
    expect(result.current.recentCourses[0].lastPlayedAt).toBe('2026-05-25T11:00:00Z')
  })

  it('returns all unique courses with no cap', async () => {
    vi.mocked(roundsService.getPlayerRoundsWithData).mockResolvedValue(
      ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map((cid, i) =>
        makeRound({ id: `r${i}`, course_id: cid, course_name: `Course ${cid}` })
      )
    )

    const { result } = renderHook(() => useRecentCourses('u1'))
    await act(async () => {})

    expect(result.current.recentCourses).toHaveLength(6)
  })

  it('passes the userId to getPlayerRoundsWithData', async () => {
    const { result } = renderHook(() => useRecentCourses('user-abc'))
    await act(async () => {})
    expect(roundsService.getPlayerRoundsWithData).toHaveBeenCalledWith('user-abc')
  })
})
