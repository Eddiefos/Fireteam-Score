import { useState, useEffect } from 'react'
import type { RoundPlayer } from '../types'
import { getRoundPlayers } from '../services/roundPlayers'
import { supabase } from '../services/supabase'

export function useRoundPlayers(roundId: string | undefined) {
  const [players, setPlayers] = useState<RoundPlayer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!roundId) { setLoading(false); return }
    let ignore = false
    getRoundPlayers(roundId)
      .then((data) => { if (!ignore) setPlayers(data) })
      .finally(() => { if (!ignore) setLoading(false) })

    const channel = supabase
      .channel(`round_players:${roundId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'round_players', filter: `round_id=eq.${roundId}` },
        (payload: { new: Record<string, unknown> }) => {
          if (ignore) return
          const row = payload.new
          setPlayers((prev) => {
            if (prev.some((p) => p.id === row['id'])) return prev
            return [...prev, {
              id: row['id'] as string,
              roundId: row['round_id'] as string,
              userId: (row['user_id'] as string | null) ?? null,
              guestName: (row['guest_name'] as string | null) ?? null,
              displayName: row['display_name'] as string,
              initials: row['initials'] as string,
              color: row['color'] as string,
              isGuest: row['is_guest'] as boolean,
            }]
          })
        },
      )
      .subscribe()

    return () => {
      ignore = true
      supabase.removeChannel(channel)
    }
  }, [roundId])

  return { players, loading }
}
