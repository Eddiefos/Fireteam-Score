import { useState, useEffect } from 'react'
import type { RoundPlayer } from '../types'
import { getRoundPlayers } from '../services/roundPlayers'

export function useRoundPlayers(roundId: string | undefined) {
  const [players, setPlayers] = useState<RoundPlayer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!roundId) { setLoading(false); return }
    getRoundPlayers(roundId)
      .then(setPlayers)
      .finally(() => setLoading(false))
  }, [roundId])

  return { players, loading }
}
