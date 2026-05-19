import { useState, useEffect, useCallback } from 'react'
import type { Friend, FriendRequest, Profile } from '../types'
import {
  getFriends,
  getPendingRequests,
  getSentRequests,
  sendFriendRequest,
  acceptRequest as acceptRequestService,
  declineRequest as declineRequestService,
  cancelRequest as cancelRequestService,
  searchUsers as searchUsersService,
} from '../services/friends'

export function useFriends(userId: string | undefined) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([])
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) return
    const [f, p, s] = await Promise.all([
      getFriends(userId),
      getPendingRequests(userId),
      getSentRequests(userId),
    ])
    setFriends(f)
    setPendingRequests(p)
    setSentRequests(s)
  }, [userId])

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    let ignore = false
    refresh().finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [userId, refresh])

  const sendRequest = useCallback(async (addresseeId: string) => {
    if (!userId) return
    await sendFriendRequest(userId, addresseeId)
    await refresh()
  }, [userId, refresh])

  const acceptRequest = useCallback(async (requestId: string) => {
    await acceptRequestService(requestId)
    await refresh()
  }, [refresh])

  const declineRequest = useCallback(async (requestId: string) => {
    await declineRequestService(requestId)
    await refresh()
  }, [refresh])

  const cancelRequest = useCallback(async (requestId: string) => {
    await cancelRequestService(requestId)
    await refresh()
  }, [refresh])

  const searchUsers = useCallback(async (query: string): Promise<Profile[]> => {
    if (!userId || query.length < 2) return []
    return searchUsersService(query, userId)
  }, [userId])

  return {
    friends,
    pendingRequests,
    sentRequests,
    loading,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    searchUsers,
  }
}
