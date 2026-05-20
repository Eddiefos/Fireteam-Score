import { supabase } from './supabase'
import type { Friend, FriendRequest, Profile } from '../types'

type FriendProfileRow = {
  id: string
  display_name: string
  username: string
  initials: string
  avatar_color: string
  is_admin?: boolean
}

type FriendRow = {
  id: string
  requester_id: string
  addressee_id: string
  requester: FriendProfileRow
  addressee: FriendProfileRow
}

type FriendRequestRow = {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  profile: FriendProfileRow & { created_at: string }
}

export async function getFriends(userId: string): Promise<Friend[]> {
  const { data, error } = await supabase
    .from('friends')
    .select(`
      id,
      requester_id,
      addressee_id,
      requester:profiles!requester_id(id, display_name, username, initials, avatar_color),
      addressee:profiles!addressee_id(id, display_name, username, initials, avatar_color)
    `)
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
  if (error) throw new Error(error.message)

  return ((data ?? []) as unknown as FriendRow[]).map((row) => {
    const other = row.requester_id === userId ? row.addressee : row.requester
    return {
      id: row.id,
      userId: other.id,
      displayName: other.display_name,
      username: other.username,
      initials: other.initials,
      avatarColor: other.avatar_color,
      roundsTogether: 0,
      avgVsPar: null,
    }
  })
}

export async function getPendingRequests(userId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('friends')
    .select(`
      id, requester_id, addressee_id, status, created_at,
      profile:profiles!requester_id(id, display_name, username, initials, avatar_color, created_at)
    `)
    .eq('addressee_id', userId)
    .eq('status', 'pending')
  if (error) throw new Error(error.message)

  return ((data ?? []) as unknown as FriendRequestRow[]).map((row) => ({
    id: row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    status: row.status,
    profile: {
      id: row.profile.id,
      display_name: row.profile.display_name,
      username: row.profile.username,
      initials: row.profile.initials,
      avatar_color: row.profile.avatar_color,
      is_admin: row.profile.is_admin ?? false,
      created_at: row.profile.created_at,
    },
    createdAt: row.created_at,
  }))
}

export async function getSentRequests(userId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('friends')
    .select(`
      id, requester_id, addressee_id, status, created_at,
      profile:profiles!addressee_id(id, display_name, username, initials, avatar_color, created_at)
    `)
    .eq('requester_id', userId)
    .eq('status', 'pending')
  if (error) throw new Error(error.message)

  return ((data ?? []) as unknown as FriendRequestRow[]).map((row) => ({
    id: row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    status: row.status,
    profile: {
      id: row.profile.id,
      display_name: row.profile.display_name,
      username: row.profile.username,
      initials: row.profile.initials,
      avatar_color: row.profile.avatar_color,
      is_admin: row.profile.is_admin ?? false,
      created_at: row.profile.created_at,
    },
    createdAt: row.created_at,
  }))
}

export async function searchUsers(query: string, currentUserId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, initials, avatar_color, is_admin, created_at')
    .ilike('username', `%${query}%`)
    .neq('id', currentUserId)
    .limit(10)
  if (error) throw new Error(error.message)
  return (data ?? []) as Profile[]
}

export async function sendFriendRequest(requesterId: string, addresseeId: string): Promise<void> {
  const { error } = await supabase
    .from('friends')
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' })
  if (error) throw new Error(error.message)
}

export async function acceptRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friends')
    .update({ status: 'accepted' })
    .eq('id', requestId)
  if (error) throw new Error(error.message)
}

export async function declineRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friends')
    .update({ status: 'declined' })
    .eq('id', requestId)
  if (error) throw new Error(error.message)
}

export async function cancelRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friends')
    .delete()
    .eq('id', requestId)
  if (error) throw new Error(error.message)
}

export async function removeFriend(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friends')
    .delete()
    .eq('id', requestId)
  if (error) throw new Error(error.message)
}
