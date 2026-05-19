import { supabase } from './supabase'
import type { Score } from '../types'

export async function submitScore(
  roundId: string,
  roundPlayerId: string,
  userId: string | null,
  holeNumber: number,
  strokes: number,
): Promise<void> {
  const { error } = await supabase
    .from('scores')
    .upsert(
      { round_id: roundId, round_player_id: roundPlayerId, user_id: userId, hole_number: holeNumber, strokes },
      { onConflict: 'round_id,round_player_id,hole_number' },
    )
  if (error) throw new Error(error.message)
}

export async function getScores(roundId: string): Promise<Score[]> {
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('round_id', roundId)
  if (error) throw new Error(error.message)
  return (data ?? []) as Score[]
}
