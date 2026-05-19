import { supabase } from './supabase'
import type { Fireteam, FireteamInvite, Profile, Round, RoundPlayer } from '../types'

export async function createFireteam(name: string, userId: string): Promise<Fireteam> {
  const { data, error } = await supabase
    .from('fireteams')
    .insert({ name, created_by: userId })
    .select()
    .single()
  if (error) throw new Error(error.message)

  const { error: memberError } = await supabase
    .from('fireteam_members')
    .insert({ fireteam_id: (data as Fireteam).id, user_id: userId })
  if (memberError) throw new Error(memberError.message)

  return data as Fireteam
}

export async function getMyFireteam(userId: string): Promise<Fireteam | null> {
  const { data, error } = await supabase
    .from('fireteam_members')
    .select('fireteam_id, fireteams(id, name, created_by, invite_code, created_at)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return (data as any).fireteams as Fireteam
}

export async function getFireteamMembers(fireteamId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('fireteam_members')
    .select('profiles(id, username, display_name, initials, avatar_color, created_at)')
    .eq('fireteam_id', fireteamId)
  if (error) throw new Error(error.message)
  return ((data ?? []) as any[]).map((row) => row.profiles as Profile)
}

export async function inviteToFireteam(
  fireteamId: string,
  inviterId: string,
  inviteeId: string,
): Promise<void> {
  const { error } = await supabase
    .from('fireteam_invites')
    .insert({ fireteam_id: fireteamId, inviter_id: inviterId, invitee_id: inviteeId })
  if (error) throw new Error(error.message)
}

export async function getPendingInvites(userId: string): Promise<FireteamInvite[]> {
  const { data, error } = await supabase
    .from('fireteam_invites')
    .select(`
      id, fireteam_id, inviter_id, invitee_id, status, created_at,
      fireteams(name),
      profiles!fireteam_invites_inviter_id_fkey(display_name)
    `)
    .eq('invitee_id', userId)
    .eq('status', 'pending')
  if (error) throw new Error(error.message)
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    fireteam_id: row.fireteam_id,
    fireteam_name: row.fireteams?.name ?? '',
    inviter_id: row.inviter_id,
    inviter_name: row.profiles?.display_name ?? '',
    invitee_id: row.invitee_id,
    status: row.status,
    created_at: row.created_at,
  }))
}

export async function acceptInvite(
  inviteId: string,
  fireteamId: string,
  userId: string,
): Promise<void> {
  const { error: updateError } = await supabase
    .from('fireteam_invites')
    .update({ status: 'accepted' })
    .eq('id', inviteId)
  if (updateError) throw new Error(updateError.message)

  const { error: memberError } = await supabase
    .from('fireteam_members')
    .insert({ fireteam_id: fireteamId, user_id: userId })
  if (memberError) throw new Error(memberError.message)
}

export async function declineInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('fireteam_invites')
    .update({ status: 'declined' })
    .eq('id', inviteId)
  if (error) throw new Error(error.message)
}

export async function getFireteamRoundsWithData(fireteamId: string): Promise<Round[]> {
  const { data: roundsData, error: roundsError } = await supabase
    .from('rounds')
    .select('id, course_id, started_at, finished_at, status, holes_played, created_by, courses(name, course_holes(hole_number, par))')
    .eq('fireteam_id', fireteamId)
    .eq('status', 'finished')
    .order('started_at', { ascending: false })
    .limit(20)
  if (roundsError) throw new Error(roundsError.message)
  if (!roundsData?.length) return []

  const roundIds = roundsData.map((r: any) => r.id)

  const { data: playersData, error: playersError } = await supabase
    .from('round_players')
    .select('id, round_id, user_id, guest_name, display_name, initials, color, is_guest')
    .in('round_id', roundIds)
  if (playersError) throw new Error(playersError.message)

  const { data: scoresData, error: scoresError } = await supabase
    .from('scores')
    .select('round_id, round_player_id, hole_number, strokes')
    .in('round_id', roundIds)
  if (scoresError) throw new Error(scoresError.message)

  const playersByRound: Record<string, RoundPlayer[]> = {}
  for (const p of (playersData ?? []) as any[]) {
    if (!playersByRound[p.round_id]) playersByRound[p.round_id] = []
    playersByRound[p.round_id].push({
      id: p.id,
      roundId: p.round_id,
      userId: p.user_id,
      guestName: p.guest_name,
      displayName: p.display_name,
      initials: p.initials,
      color: p.color,
      isGuest: p.is_guest,
    })
  }

  const scoresByRound: Record<string, Record<string, (number | null)[]>> = {}
  for (const s of (scoresData ?? []) as any[]) {
    if (!scoresByRound[s.round_id]) scoresByRound[s.round_id] = {}
    if (!scoresByRound[s.round_id][s.round_player_id])
      scoresByRound[s.round_id][s.round_player_id] = []
    scoresByRound[s.round_id][s.round_player_id][s.hole_number - 1] = s.strokes
  }

  return (roundsData as any[]).map((r) => {
    const pars = ((r.courses?.course_holes ?? []) as any[])
      .sort((a: any, b: any) => a.hole_number - b.hole_number)
      .map((h: any) => h.par as number)
    return {
      id: r.id,
      course_id: r.course_id,
      course_name: r.courses?.name ?? 'Unknown course',
      pars,
      status: r.status as 'active' | 'finished' | 'abandoned',
      holes_played: r.holes_played,
      created_by: r.created_by,
      started_at: r.started_at,
      finished_at: r.finished_at,
      players: playersByRound[r.id] ?? [],
      scores: scoresByRound[r.id] ?? {},
    }
  })
}
