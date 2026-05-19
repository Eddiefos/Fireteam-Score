import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../supabase'
import { addRoundPlayer, getRoundPlayers } from '../roundPlayers'

beforeEach(() => vi.clearAllMocks())

describe('addRoundPlayer', () => {
  it('inserts a round_player and returns it', async () => {
    const player = {
      id: 'rp1', round_id: 'r1', user_id: 'u1', guest_name: null,
      display_name: 'Edvard', initials: 'EF', color: '#FF6B1F', is_guest: false,
    }
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: player, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await addRoundPlayer('r1', {
      userId: 'u1',
      displayName: 'Edvard',
      initials: 'EF',
      color: '#FF6B1F',
      isGuest: false,
    })
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      round_id: 'r1',
      display_name: 'Edvard',
      is_guest: false,
    }))
    expect(result.id).toBe('rp1')
    expect(result.roundId).toBe('r1')
    expect(result.userId).toBe('u1')
    expect(result.isGuest).toBe(false)
    expect(result.displayName).toBe('Edvard')
  })
})

describe('getRoundPlayers', () => {
  it('returns players for a round', async () => {
    const rows = [
      { id: 'rp1', round_id: 'r1', user_id: 'u1', guest_name: null, display_name: 'Edvard', initials: 'EF', color: '#FF6B1F', is_guest: false },
    ]
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await getRoundPlayers('r1')
    expect(result).toHaveLength(1)
    expect(result[0].displayName).toBe('Edvard')
    expect(result[0].isGuest).toBe(false)
  })

  it('returns empty array when data is null', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(chain as any)
    const result = await getRoundPlayers('r1')
    expect(result).toEqual([])
  })
})
