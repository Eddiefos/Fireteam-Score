import { supabase } from './supabase'
import type { Friend, FriendActivityRound, FriendRequest, Profile } from '../types'

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

export async function getFriendActivity(friendUserId: string): Promise<FriendActivityRound[]> {
  const { data: roundsData, error } = await supabase
    .from('rounds')
    .select('id, course_id, started_at, holes_played, courses(name, course_holes(hole_number, par))')
    .eq('status', 'finished')
    .eq('created_by', friendUserId)
    .not('course_id', 'is', null)
    .order('started_at', { ascending: false })
    .limit(5)

  if (error) throw new Error(error.message)
  if (!roundsData?.length) return []

  const roundIds = roundsData.map((r: any) => r.id)

  const [{ data: playersData }, { data: scoresData }] = await Promise.all([
    supabase.from('round_players').select('id, round_id').in('round_id', roundIds).eq('user_id', friendUserId),
    supabase.from('scores').select('round_player_id, hole_number, strokes').in('round_id', roundIds),
  ])

  const playerIdByRound: Record<string, string> = {}
  for (const p of (playersData ?? []) as any[]) {
    playerIdByRound[p.round_id] = p.id
  }

  const strokesByPlayer: Record<string, number[]> = {}
  for (const s of (scoresData ?? []) as any[]) {
    if (!strokesByPlayer[s.round_player_id]) strokesByPlayer[s.round_player_id] = []
    strokesByPlayer[s.round_player_id][s.hole_number - 1] = s.strokes
  }

  return roundsData.map((r: any) => {
    const pars = ((r.courses?.course_holes ?? []) as any[])
      .sort((a: any, b: any) => a.hole_number - b.hole_number)
      .map((h: any) => h.par as number)

    const playerId = playerIdByRound[r.id]
    const strokes = playerId ? (strokesByPlayer[playerId] ?? []) : []
    const filledStrokes = strokes.filter((s) => s != null)
    const totalStrokes = filledStrokes.length ? filledStrokes.reduce((a, b) => a + b, 0) : null
    const totalPar = filledStrokes.length ? pars.slice(0, filledStrokes.length).reduce((a: number, b: number) => a + b, 0) : null
    const scoreVsPar = totalStrokes !== null && totalPar !== null ? totalStrokes - totalPar : null

    return {
      id: r.id,
      courseName: r.courses?.name ?? (r.course_id === null ? 'Deleted course' : 'Unknown course'),
      startedAt: r.started_at,
      holesPlayed: r.holes_played,
      scoreVsPar,
    }
  })
}
