import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockProfile = {
  id: 'u1',
  username: 'alice',
  display_name: 'Alice',
  initials: 'AL',
  avatar_color: '#FF6B1F',
  created_at: '2026-01-01',
}

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

import { supabase } from '../supabase'
import { getProfile, updateProfile } from '../profiles'

beforeEach(() => vi.clearAllMocks())

describe('getProfile', () => {
  it('fetches profile by userId', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await getProfile('u1')
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(chain.eq).toHaveBeenCalledWith('id', 'u1')
    expect(result).toEqual(mockProfile)
  })

  it('throws if Supabase returns an error', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await expect(getProfile('bad-id')).rejects.toThrow('not found')
  })
})

describe('updateProfile', () => {
  it('updates profile fields', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await updateProfile('u1', { display_name: 'Alice B', initials: 'AB' })
    expect(chain.update).toHaveBeenCalledWith({ display_name: 'Alice B', initials: 'AB' })
    expect(chain.eq).toHaveBeenCalledWith('id', 'u1')
  })
})
