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
  getFriends,
  getPendingRequests,
  getSentRequests,
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

describe('getFriends', () => {
  it('returns accepted friends with the other person mapped', async () => {
    const rows = [{
      id: 'f1',
      requester_id: 'u1',
      addressee_id: 'u2',
      requester: { id: 'u1', display_name: 'Me', username: 'me', initials: 'M', avatar_color: '#FF6B1F' },
      addressee: { id: 'u2', display_name: 'Mara', username: 'mara', initials: 'M', avatar_color: '#3A5A40' },
    }]
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await getFriends('u1')
    expect(result).toHaveLength(1)
    expect(result[0].userId).toBe('u2')
    expect(result[0].displayName).toBe('Mara')
    expect(result[0].username).toBe('mara')
  })

  it('returns the requester when current user is the addressee', async () => {
    const rows = [{
      id: 'f1',
      requester_id: 'u2',
      addressee_id: 'u1',
      requester: { id: 'u2', display_name: 'Soren', username: 'soren', initials: 'S', avatar_color: '#FF6B1F' },
      addressee: { id: 'u1', display_name: 'Me', username: 'me', initials: 'M', avatar_color: '#3A5A40' },
    }]
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await getFriends('u1')
    expect(result[0].userId).toBe('u2')
    expect(result[0].displayName).toBe('Soren')
  })
})

describe('getPendingRequests', () => {
  it('returns incoming pending requests with requester profile', async () => {
    const rows = [{
      id: 'r1',
      requester_id: 'u2',
      addressee_id: 'u1',
      status: 'pending',
      created_at: '2026-01-01',
      profile: { id: 'u2', display_name: 'Soren', username: 'soren', initials: 'S', avatar_color: '#FF6B1F', created_at: '2026-01-01' },
    }]
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis().mockReturnThis(),
    }
    // last eq resolves
    let eqCount = 0
    chain.eq = vi.fn().mockImplementation(() => {
      eqCount++
      if (eqCount === 2) return Promise.resolve({ data: rows, error: null })
      return chain
    })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await getPendingRequests('u1')
    expect(result).toHaveLength(1)
    expect(result[0].requesterId).toBe('u2')
    expect(result[0].addresseeId).toBe('u1')
    expect(result[0].profile.id).toBe('u2')
  })
})

describe('getSentRequests', () => {
  it('returns outgoing pending requests with addressee profile', async () => {
    const rows = [{
      id: 'r1',
      requester_id: 'u1',
      addressee_id: 'u2',
      status: 'pending',
      created_at: '2026-01-01',
      profile: { id: 'u2', display_name: 'Mara', username: 'mara', initials: 'M', avatar_color: '#3A5A40', created_at: '2026-01-01' },
    }]
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    let eqCount = 0
    chain.eq = vi.fn().mockImplementation(() => {
      eqCount++
      if (eqCount === 2) return Promise.resolve({ data: rows, error: null })
      return chain
    })
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await getSentRequests('u1')
    expect(result).toHaveLength(1)
    expect(result[0].requesterId).toBe('u1')
    expect(result[0].profile.id).toBe('u2')
  })
})
