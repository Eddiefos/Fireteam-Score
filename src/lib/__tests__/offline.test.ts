import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('idb-keyval', () => ({
  set: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
  keys: vi.fn().mockResolvedValue([]),
}))

import * as idbKeyval from 'idb-keyval'
import { queueScore, flushScoreQueue } from '../offline'

beforeEach(() => vi.clearAllMocks())

describe('queueScore', () => {
  it('writes to idb-keyval with the correct key', async () => {
    await queueScore('round1', 'rp1', 'user1', 3, 4)
    expect(idbKeyval.set).toHaveBeenCalledWith(
      'pending-score:round1:rp1:3',
      expect.objectContaining({ round_id: 'round1', round_player_id: 'rp1', user_id: 'user1', hole_number: 3, strokes: 4 }),
    )
  })

  it('stores null userId for guests', async () => {
    await queueScore('round1', 'rp2', null, 1, 3)
    expect(idbKeyval.set).toHaveBeenCalledWith(
      'pending-score:round1:rp2:1',
      expect.objectContaining({ user_id: null }),
    )
  })
})

describe('flushScoreQueue', () => {
  it('calls onSubmit for each pending score and deletes the key', async () => {
    vi.mocked(idbKeyval.keys).mockResolvedValue(['pending-score:r1:rp1:1' as any])
    vi.mocked(idbKeyval.get).mockResolvedValue({ round_id: 'r1', round_player_id: 'rp1', user_id: 'u1', hole_number: 1, strokes: 3, timestamp: 1 })

    const onSubmit = vi.fn().mockResolvedValue(undefined)
    await flushScoreQueue(onSubmit)

    expect(onSubmit).toHaveBeenCalledWith('r1', 'rp1', 'u1', 1, 3)
    expect(idbKeyval.del).toHaveBeenCalledWith('pending-score:r1:rp1:1')
  })

  it('does not delete key if onSubmit throws', async () => {
    vi.mocked(idbKeyval.keys).mockResolvedValue(['pending-score:r1:rp1:2' as any])
    vi.mocked(idbKeyval.get).mockResolvedValue({ round_id: 'r1', round_player_id: 'rp1', user_id: 'u1', hole_number: 2, strokes: 5, timestamp: 1 })

    const onSubmit = vi.fn().mockRejectedValue(new Error('network'))
    await flushScoreQueue(onSubmit)

    expect(idbKeyval.del).not.toHaveBeenCalled()
  })
})
