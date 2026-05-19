import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../supabase'
import { startRound, finishRound, abandonRound } from '../rounds'

beforeEach(() => vi.clearAllMocks())

describe('startRound', () => {
  it('inserts a round then inserts round_players and returns the round id', async () => {
    const mockRound = { id: 'r1', course_id: 'c1', status: 'active', started_at: '2026-01-01', finished_at: null, holes_played: 0, created_by: 'u1' }
    const roundChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockRound, error: null }),
    }
    const playerChain = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabase.from)
      .mockReturnValueOnce(roundChain as any)  // rounds insert
      .mockReturnValueOnce(playerChain as any) // round_players insert

    const result = await startRound('c1', 'u1', [
      { userId: 'u1', displayName: 'Edvard', initials: 'EF', color: '#FF6B1F', isGuest: false },
    ])

    expect(roundChain.insert).toHaveBeenCalledWith(expect.objectContaining({ course_id: 'c1', created_by: 'u1' }))
    expect(playerChain.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ round_id: 'r1', display_name: 'Edvard', is_guest: false }),
      ])
    )
    expect(result.id).toBe('r1')
  })
})

describe('finishRound', () => {
  it('sets status to finished', async () => {
    const chain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)
    await finishRound('r1')
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'finished' }))
  })
})

describe('abandonRound', () => {
  it('sets status to abandoned', async () => {
    const chain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)
    await abandonRound('r1')
    expect(chain.update).toHaveBeenCalledWith({ status: 'abandoned' })
  })
})
