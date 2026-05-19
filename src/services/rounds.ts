import { supabase } from './supabase'
import type { NewRoundPlayer } from '../types'

export async function startRound(
  courseId: string,
  userId: string,
  players: NewRoundPlayer[],
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('rounds')
    .insert({ course_id: courseId, status: 'active', holes_played: 0, created_by: userId })
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

export async function getRounds(_userId: string): Promise<{
  id: string
  course_id: string
  started_at: string
  finished_at: string | null
  status: string
  holes_played: number
  created_by: string
}[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('id, course_id, started_at, finished_at, status, holes_played, created_by')
    .order('started_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as any[]
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
    .select('id, course_id, started_at, holes_played, created_by')
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as any) ?? null
}

export async function finishRound(roundId: string): Promise<void> {
  const { error } = await supabase
    .from('rounds')
    .update({ status: 'finished', finished_at: new Date().toISOString() })
    .eq('id', roundId)
  if (error) throw new Error(error.message)
}

export async function abandonRound(roundId: string): Promise<void> {
  const { error } = await supabase
    .from('rounds')
    .update({ status: 'abandoned' })
    .eq('id', roundId)
  if (error) throw new Error(error.message)
}
