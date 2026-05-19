import { useState, useEffect } from 'react'
import type { RoundPlayer } from '../types'
import { getRoundPlayers } from '../services/roundPlayers'

export function useRoundPlayers(roundId: string | undefined) {
  const [players, setPlayers] = useState<RoundPlayer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!roundId) { setLoading(false); return }
    let ignore = false
    getRoundPlayers(roundId)
      .then((data) => { if (!ignore) setPlayers(data) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [roundId])

  return { players, loading }
}
