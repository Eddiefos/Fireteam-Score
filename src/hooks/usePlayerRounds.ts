import { useState, useEffect, useCallback } from 'react'
import type { Round } from '../types'
import { getPlayerRoundsWithData } from '../services/rounds'

export function usePlayerRounds(userId: string | undefined) {
  const [rounds, setRounds] = useState<Round[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) return
    const data = await getPlayerRoundsWithData(userId)
    setRounds(data)
  }, [userId])

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    let ignore = false
    refresh().finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [userId, refresh])

  return { rounds, loading, refresh }
}
