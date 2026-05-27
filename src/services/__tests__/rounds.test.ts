import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../supabase'
import { startRound, finishRound, abandonRound, updateHolesPlayed } from '../rounds'

beforeEach(() => vi.resetAllMocks())

function makeActiveRoundChain(data: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  }
}

describe('startRound', () => {
  it('inserts a round then inserts round_players and returns the round id', async () => {
    const mockRound = { id: 'r1', course_id: 'c1', status: 'active', started_at: '2026-01-01', finished_at: null, holes_played: 0, created_by: 'u1' }
    const roundInsertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockRound, error: null }),
    }
    const playerChain = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeActiveRoundChain() as any) // getActiveRound — no existing round
      .mockReturnValueOnce(roundInsertChain as any)       // rounds insert
      .mockReturnValueOnce(playerChain as any)            // round_players insert

    const result = await startRound('c1', 'u1', [
      { userId: 'u1', displayName: 'Edvard', initials: 'EF', color: '#FF6B1F', isGuest: false },
    ])

    expect(roundInsertChain.insert).toHaveBeenCalledWith(expect.objectContaining({ course_id: 'c1', created_by: 'u1' }))
    expect(playerChain.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ round_id: 'r1', display_name: 'Edvard', is_guest: false }),
      ])
    )
    expect(result.id).toBe('r1')
  })

  it('throws when round_players insert fails', async () => {
    const mockRound = { id: 'r1', course_id: 'c1', status: 'active', started_at: '2026-01-01', finished_at: null, holes_played: 0, created_by: 'u1' }
    const roundInsertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockRound, error: null }),
    }
    const playerChain = {
      insert: vi.fn().mockResolvedValue({ error: { message: 'insert failed' } }),
    }
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeActiveRoundChain() as any) // getActiveRound — no existing round
      .mockReturnValueOnce(roundInsertChain as any)
      .mockReturnValueOnce(playerChain as any)

    await expect(startRound('c1', 'u1', [
      { userId: 'u1', displayName: 'Edvard', initials: 'EF', color: '#FF6B1F', isGuest: false },
    ])).rejects.toThrow('insert failed')
  })

  it('abandons existing active round before creating a new one', async () => {
    const existingRound = { id: 'r0', course_id: 'c0', status: 'active', started_at: '2026-01-01', holes_played: 0, created_by: 'u1' }
    const mockRound = { id: 'r1', course_id: 'c1', status: 'active', started_at: '2026-01-02', finished_at: null, holes_played: 0, created_by: 'u1' }
    const abandonChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    const roundInsertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockRound, error: null }),
    }
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeActiveRoundChain(existingRound) as any) // getActiveRound — returns existing
      .mockReturnValueOnce(abandonChain as any)                        // abandonRound update
      .mockReturnValueOnce(roundInsertChain as any)                    // rounds insert
      .mockReturnValueOnce({ insert: vi.fn().mockResolvedValue({ error: null }) } as any) // round_players

    const result = await startRound('c1', 'u1', [
      { userId: 'u1', displayName: 'Edvard', initials: 'EF', color: '#FF6B1F', isGuest: false },
    ])

    expect(abandonChain.update).toHaveBeenCalledWith({ status: 'abandoned' })
    expect(result.id).toBe('r1')
  })
})

describe('finishRound', () => {
  it('sets status to finished', async () => {
    const chain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)
    await finishRound('r1', 18)
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'finished', holes_played: 18 }))
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

describe('updateHolesPlayed', () => {
  it('updates holes_played for a round', async () => {
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(chain as any)
    await updateHolesPlayed('r1', 5)
    expect(chain.update).toHaveBeenCalledWith({ holes_played: 5 })
    expect(chain.eq).toHaveBeenCalledWith('id', 'r1')
  })
})
