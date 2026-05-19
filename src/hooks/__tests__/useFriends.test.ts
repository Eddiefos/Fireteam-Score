import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../services/friends', () => ({
  getFriends: vi.fn().mockResolvedValue([]),
  getPendingRequests: vi.fn().mockResolvedValue([]),
  getSentRequests: vi.fn().mockResolvedValue([]),
  sendFriendRequest: vi.fn().mockResolvedValue(undefined),
  acceptRequest: vi.fn().mockResolvedValue(undefined),
  declineRequest: vi.fn().mockResolvedValue(undefined),
  cancelRequest: vi.fn().mockResolvedValue(undefined),
  searchUsers: vi.fn().mockResolvedValue([]),
}))

import * as friendsService from '../../services/friends'
import { useFriends } from '../useFriends'

beforeEach(() => vi.clearAllMocks())

describe('useFriends', () => {
  it('loads friends, pending requests, and sent requests on mount', async () => {
    const mockFriend = { id: 'f1', userId: 'u2', displayName: 'Mara', username: 'mara', initials: 'M', avatarColor: '#FF6B1F', roundsTogether: 0, avgVsPar: null }
    vi.mocked(friendsService.getFriends).mockResolvedValue([mockFriend])

    const { result } = renderHook(() => useFriends('u1'))

    expect(result.current.loading).toBe(true)

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.friends).toHaveLength(1)
    expect(result.current.friends[0].displayName).toBe('Mara')
  })

  it('sendRequest calls service and refreshes', async () => {
    const { result } = renderHook(() => useFriends('u1'))
    await act(async () => {})

    await act(async () => {
      await result.current.sendRequest('u2')
    })

    expect(friendsService.sendFriendRequest).toHaveBeenCalledWith('u1', 'u2')
  })

  it('acceptRequest calls service and refreshes', async () => {
    const { result } = renderHook(() => useFriends('u1'))
    await act(async () => {})

    await act(async () => {
      await result.current.acceptRequest('req1')
    })

    expect(friendsService.acceptRequest).toHaveBeenCalledWith('req1')
  })

  it('returns empty arrays and not loading when userId is undefined', async () => {
    const { result } = renderHook(() => useFriends(undefined))
    await act(async () => {})
    expect(result.current.loading).toBe(false)
    expect(result.current.friends).toHaveLength(0)
    expect(friendsService.getFriends).not.toHaveBeenCalled()
  })
})
