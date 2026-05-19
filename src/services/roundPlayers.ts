import { supabase } from './supabase'
import type { RoundPlayer, NewRoundPlayer } from '../types'

function toRoundPlayer(row: any): RoundPlayer {
  return {
    id: row.id,
    roundId: row.round_id,
    userId: row.user_id ?? null,
    guestName: row.guest_name ?? null,
    displayName: row.display_name,
    initials: row.initials,
    color: row.color,
    isGuest: row.is_guest,
  }
}

export async function addRoundPlayer(
  roundId: string,
  player: NewRoundPlayer,
): Promise<RoundPlayer> {
  const { data, error } = await supabase
    .from('round_players')
    .insert({
      round_id: roundId,
      user_id: player.userId ?? null,
      guest_name: player.guestName ?? null,
      display_name: player.displayName,
      initials: player.initials,
      color: player.color,
      is_guest: player.isGuest,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return toRoundPlayer(data)
}

export async function getRoundPlayers(roundId: string): Promise<RoundPlayer[]> {
  const { data, error } = await supabase
    .from('round_players')
    .select('*')
    .eq('round_id', roundId)
  if (error) throw new Error(error.message)
  return (data ?? []).map(toRoundPlayer)
}
