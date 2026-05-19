import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../supabase'
import { submitScore, getScores } from '../scores'

beforeEach(() => vi.clearAllMocks())

describe('submitScore', () => {
  it('upserts using round_player_id conflict key', async () => {
    const chain = { upsert: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await submitScore('r1', 'rp1', 'u1', 3, 4)
    expect(chain.upsert).toHaveBeenCalledWith(
      { round_id: 'r1', round_player_id: 'rp1', user_id: 'u1', hole_number: 3, strokes: 4 },
      { onConflict: 'round_id,round_player_id,hole_number' },
    )
  })

  it('allows null userId for guests', async () => {
    const chain = { upsert: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await submitScore('r1', 'rp2', null, 1, 3)
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: null }),
      expect.anything(),
    )
  })
})

describe('getScores', () => {
  it('fetches scores for a round', async () => {
    const scores = [{ id: 's1', round_id: 'r1', round_player_id: 'rp1', user_id: 'u1', hole_number: 1, strokes: 3 }]
    const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: scores, error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await getScores('r1')
    expect(result).toEqual(scores)
  })
})
