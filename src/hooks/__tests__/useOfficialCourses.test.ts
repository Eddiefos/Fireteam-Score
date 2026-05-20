import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useOfficialCourses } from '../useOfficialCourses'
import * as coursesService from '../../services/courses'
import { get, set } from 'idb-keyval'

vi.mock('../../services/courses', () => ({
  getOfficialCourses: vi.fn()
}))

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}))

const mockCourses = [
  { id: 'c1', name: 'Bølgane Frisbeegolfpark', location: 'Kristiansand', source: 'official', course_holes: [] },
  { id: 'c2', name: 'Ekeberg Disc Golf', location: 'Oslo', source: 'official', course_holes: [] },
]

describe('useOfficialCourses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(get).mockResolvedValue(null)
    vi.mocked(set).mockResolvedValue(undefined)
  })

  it('fetches from service when no cache exists', async () => {
    vi.mocked(coursesService.getOfficialCourses).mockResolvedValue(mockCourses as any)

    const { result } = renderHook(() => useOfficialCourses())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(coursesService.getOfficialCourses).toHaveBeenCalledOnce()
    expect(result.current.courses).toHaveLength(2)
    expect(vi.mocked(set)).toHaveBeenCalledWith(
      'official-courses',
      expect.objectContaining({ courses: mockCourses })
    )
  })

  it('uses cache when valid (< 24h)', async () => {
    const cached = { courses: mockCourses, cachedAt: Date.now() - 1000 }
    vi.mocked(get).mockResolvedValue(cached)

    const { result } = renderHook(() => useOfficialCourses())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(coursesService.getOfficialCourses).not.toHaveBeenCalled()
    expect(result.current.courses).toHaveLength(2)
  })

  it('refetches when cache is stale (> 24h)', async () => {
    const stale = { courses: mockCourses, cachedAt: Date.now() - 25 * 3600 * 1000 }
    vi.mocked(get).mockResolvedValue(stale)
    vi.mocked(coursesService.getOfficialCourses).mockResolvedValue(mockCourses as any)

    const { result } = renderHook(() => useOfficialCourses())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(coursesService.getOfficialCourses).toHaveBeenCalledOnce()
  })

  it('search() filters by name case-insensitively including Norwegian chars', async () => {
    const cached = { courses: mockCourses, cachedAt: Date.now() }
    vi.mocked(get).mockResolvedValue(cached)

    const { result } = renderHook(() => useOfficialCourses())

    await waitFor(() => expect(result.current.loading).toBe(false))

    const results = result.current.search('bølg')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Bølgane Frisbeegolfpark')
  })

  it('search() returns all courses for empty query', async () => {
    const cached = { courses: mockCourses, cachedAt: Date.now() }
    vi.mocked(get).mockResolvedValue(cached)

    const { result } = renderHook(() => useOfficialCourses())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.search('')).toHaveLength(2)
  })
})
