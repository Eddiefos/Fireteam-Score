import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../supabase'
import { startRound, finishRound, abandonRound } from '../rounds'

beforeEach(() => vi.clearAllMocks())

describe('startRound', () => {
  it('inserts a round and returns it', async () => {
    const mockRound = { id: 'r1', course_id: 'c1', status: 'active', started_at: '2026-01-01', finished_at: null, holes_played: 0, created_by: 'u1' }
    const chain = { insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockRound, error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await startRound('c1', 'u1')
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ course_id: 'c1', created_by: 'u1', status: 'active' }))
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
