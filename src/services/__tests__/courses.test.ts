import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../supabase'
import { getCourses, createCourse, deleteCourse } from '../courses'

beforeEach(() => vi.clearAllMocks())

const mockCourse = {
  id: 'c1',
  name: 'Bear Creek',
  location: null,
  holes: 9,
  par_total: 27,
  source: 'user' as const,
  is_public: true,
  created_by: 'u1',
  created_at: '2026-01-01',
  lat: null,
  lng: null,
}

const mockHoles = [
  { hole_number: 1, par: 3, distance_m: null },
  { hole_number: 2, par: 3, distance_m: null },
]

describe('getCourses', () => {
  it('fetches courses and hydrates pars from holes', async () => {
    const courseChain = {
      select: vi.fn().mockResolvedValue({ data: [mockCourse], error: null }),
    }
    const holeChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockHoles, error: null }),
    }
    vi.mocked(supabase.from)
      .mockReturnValueOnce(courseChain as any)
      .mockReturnValueOnce(holeChain as any)

    const result = await getCourses()
    expect(result[0].pars).toEqual([3, 3])
    expect(result[0].name).toBe('Bear Creek')
  })

  it('uses default pars if no holes found', async () => {
    const course = { ...mockCourse, holes: 9 }
    const courseChain = {
      select: vi.fn().mockResolvedValue({ data: [course], error: null }),
    }
    const holeChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(supabase.from)
      .mockReturnValueOnce(courseChain as any)
      .mockReturnValueOnce(holeChain as any)

    const result = await getCourses()
    expect(result[0].pars).toEqual([3, 3, 3, 3, 3, 3, 3, 3, 3])
  })

  it('throws if fetch fails', async () => {
    const courseChain = {
      select: vi.fn().mockResolvedValue({ data: null, error: { message: 'fetch error' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(courseChain as any)

    await expect(getCourses()).rejects.toThrow('fetch error')
  })
})

describe('createCourse', () => {
  it('creates course and holes', async () => {
    const courseChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockCourse, error: null }),
    }
    const holesChain = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabase.from)
      .mockReturnValueOnce(courseChain as any)
      .mockReturnValueOnce(holesChain as any)

    const result = await createCourse({
      name: 'Bear Creek',
      pars: [3, 3],
      created_by: 'u1',
    })

    expect(courseChain.insert).toHaveBeenCalledWith({
      name: 'Bear Creek',
      location: null,
      holes: 2,
      par_total: 6,
      source: 'user',
      is_public: true,
      created_by: 'u1',
    })
    expect(result.pars).toEqual([3, 3])
  })

  it('throws if course insert fails', async () => {
    const courseChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'insert error' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(courseChain as any)

    await expect(
      createCourse({
        name: 'Bear Creek',
        pars: [3, 3],
        created_by: 'u1',
      }),
    ).rejects.toThrow('insert error')
  })
})

describe('deleteCourse', () => {
  it('calls delete with correct id', async () => {
    const chain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await deleteCourse('c1')
    expect(supabase.from).toHaveBeenCalledWith('courses')
    expect(chain.delete).toHaveBeenCalled()
    expect(chain.eq).toHaveBeenCalledWith('id', 'c1')
  })

  it('throws if delete fails', async () => {
    const chain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: { message: 'delete error' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await expect(deleteCourse('c1')).rejects.toThrow('delete error')
  })
})
