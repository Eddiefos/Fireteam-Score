import { supabase } from './supabase'
import type { NewRoundPlayer, Round, RoundPlayer } from '../types'

export async function startRound(
  courseId: string,
  userId: string,
  players: NewRoundPlayer[],
  fireteamId?: string,
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('rounds')
    .insert({
      course_id: courseId,
      status: 'active',
      holes_played: 0,
      created_by: userId,
      fireteam_id: fireteamId ?? null,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)

  const roundId = (data as { id: string }).id

  if (players.length > 0) {
    const rows = players.map((p) => ({
      round_id: roundId,
      user_id: p.userId ?? null,
      guest_name: p.guestName ?? null,
      display_name: p.displayName,
      initials: p.initials,
      color: p.color,
      is_guest: p.isGuest,
    }))
    const { error: playerError } = await supabase.from('round_players').insert(rows)
    if (playerError) throw new Error(playerError.message)
  }

  return data as { id: string }
}

export async function getRounds(userId: string): Promise<{
  id: string
  course_id: string
  started_at: string
  finished_at: string | null
  status: string
  holes_played: number
  created_by: string
}[]> {
  const [{ data, error }, { data: dismissals }] = await Promise.all([
    supabase
      .from('rounds')
      .select('id, course_id, started_at, finished_at, status, holes_played, created_by')
      .order('started_at', { ascending: false }),
    supabase
      .from('round_dismissals')
      .select('round_id')
      .eq('user_id', userId),
  ])
  if (error) throw new Error(error.message)
  const dismissed = new Set((dismissals ?? []).map((d: any) => d.round_id))
  return ((data ?? []) as any[]).filter((r) => !dismissed.has(r.id))
}

export async function dismissRound(roundId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('round_dismissals')
    .insert({ round_id: roundId, user_id: userId })
  if (error) throw new Error(error.message)
}

export async function getActiveRound(_userId: string): Promise<{
  id: string
  course_id: string
  started_at: string
  holes_played: number
  created_by: string
} | null> {
  const { data, error } = await supabase
    .from('rounds')
    .select('id, course_id, started_at, holes_played, created_by, status')
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as any) ?? null
}

export async function updateHolesPlayed(roundId: string, holesPlayed: number): Promise<void> {
  const { error } = await supabase
    .from('rounds')
    .update({ holes_played: holesPlayed })
    .eq('id', roundId)
  if (error) throw new Error(error.message)
}

export async function finishRound(roundId: string, holesPlayed: number): Promise<void> {
  const { error } = await supabase
    .from('rounds')
    .update({ status: 'finished', finished_at: new Date().toISOString(), holes_played: holesPlayed })
    .eq('id', roundId)
  if (error) throw new Error(error.message)
}

export async function deleteRound(roundId: string): Promise<void> {
  const { error, count } = await supabase
    .from('rounds')
    .delete({ count: 'exact' })
    .eq('id', roundId)
  if (error) throw new Error(error.message)
  if (count === 0) throw new Error('Delete blocked — missing RLS policy')
}

export async function abandonRound(roundId: string): Promise<void> {
  const { error } = await supabase
    .from('rounds')
    .update({ status: 'abandoned' })
    .eq('id', roundId)
  if (error) throw new Error(error.message)
}

export async function getPlayerRoundsWithData(userId: string): Promise<Round[]> {
  const [{ data: roundsData, error }, { data: dismissals }] = await Promise.all([
    supabase
      .from('rounds')
      .select('id, course_id, started_at, finished_at, status, holes_played, created_by, courses(name, course_holes(hole_number, par))')
      .eq('status', 'finished')
      .order('started_at', { ascending: false })
      .limit(100),
    supabase
      .from('round_dismissals')
      .select('round_id')
      .eq('user_id', userId),
  ])
  if (error) throw new Error(error.message)
  const dismissed = new Set((dismissals ?? []).map((d: any) => d.round_id))
  const filtered = (roundsData ?? []).filter((r: any) => !dismissed.has(r.id))
  if (!filtered.length) return []

  const roundIds = filtered.map((r: any) => r.id)

  const [{ data: playersData }, { data: scoresData }] = await Promise.all([
    supabase.from('round_players').select('id, round_id, user_id, guest_name, display_name, initials, color, is_guest').in('round_id', roundIds),
    supabase.from('scores').select('round_id, round_player_id, hole_number, strokes').in('round_id', roundIds),
  ])

  const playersByRound: Record<string, RoundPlayer[]> = {}
  for (const p of (playersData ?? []) as any[]) {
    if (!playersByRound[p.round_id]) playersByRound[p.round_id] = []
    playersByRound[p.round_id].push({
      id: p.id, roundId: p.round_id, userId: p.user_id, guestName: p.guest_name,
      displayName: p.display_name, initials: p.initials, color: p.color, isGuest: p.is_guest,
    })
  }

  const scoresByRound: Record<string, Record<string, (number | null)[]>> = {}
  for (const s of (scoresData ?? []) as any[]) {
    if (!scoresByRound[s.round_id]) scoresByRound[s.round_id] = {}
    if (!scoresByRound[s.round_id][s.round_player_id]) scoresByRound[s.round_id][s.round_player_id] = []
    scoresByRound[s.round_id][s.round_player_id][s.hole_number - 1] = s.strokes
  }

  return filtered
    .filter((r: any) => playersByRound[r.id]?.some((p: RoundPlayer) => p.userId === userId))
    .map((r: any) => {
      const pars = ((r.courses?.course_holes ?? []) as any[])
        .sort((a: any, b: any) => a.hole_number - b.hole_number)
        .map((h: any) => h.par as number)
      return {
        id: r.id,
        course_id: r.course_id,
        course_name: r.courses?.name ?? (r.course_id === null ? 'Deleted course' : 'Unknown course'),
        pars,
        status: r.status as 'finished',
        holes_played: r.holes_played,
        created_by: r.created_by,
        started_at: r.started_at,
        finished_at: r.finished_at,
        players: playersByRound[r.id] ?? [],
        scores: scoresByRound[r.id] ?? {},
      } as Round
    })
}
