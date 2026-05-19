import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../supabase'
import {
  sendFriendRequest,
  acceptRequest,
  declineRequest,
  cancelRequest,
  removeFriend,
  searchUsers,
} from '../friends'

beforeEach(() => vi.clearAllMocks())

describe('sendFriendRequest', () => {
  it('inserts a pending friend row', async () => {
    const chain = { insert: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)
    await sendFriendRequest('u1', 'u2')
    expect(chain.insert).toHaveBeenCalledWith({
      requester_id: 'u1',
      addressee_id: 'u2',
      status: 'pending',
    })
  })
})

describe('acceptRequest', () => {
  it('updates status to accepted', async () => {
    const chain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)
    await acceptRequest('req1')
    expect(chain.update).toHaveBeenCalledWith({ status: 'accepted' })
  })
})

describe('declineRequest', () => {
  it('updates status to declined', async () => {
    const chain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)
    await declineRequest('req1')
    expect(chain.update).toHaveBeenCalledWith({ status: 'declined' })
  })
})

describe('cancelRequest', () => {
  it('deletes the friend row', async () => {
    const chain = { delete: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)
    await cancelRequest('req1')
    expect(chain.delete).toHaveBeenCalled()
  })
})

describe('removeFriend', () => {
  it('deletes the friend row', async () => {
    const chain = { delete: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)
    await removeFriend('req1')
    expect(chain.delete).toHaveBeenCalled()
  })
})

describe('searchUsers', () => {
  it('searches profiles by username excluding self', async () => {
    const profiles = [{ id: 'u2', username: 'mara', display_name: 'Mara', initials: 'M', avatar_color: '#FF6B1F', created_at: '' }]
    const chain = {
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: profiles, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(chain as any)
    const result = await searchUsers('mar', 'u1')
    expect(chain.ilike).toHaveBeenCalledWith('username', '%mar%')
    expect(chain.neq).toHaveBeenCalledWith('id', 'u1')
    expect(result).toEqual(profiles)
  })
})
