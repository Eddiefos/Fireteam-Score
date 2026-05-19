import { useState, useEffect, useCallback } from 'react'
import type { NewRoundPlayer } from '../types'
import { supabase } from '../services/supabase'
import {
  getRounds,
  getActiveRound,
  startRound as startRoundService,
  finishRound as finishRoundService,
  abandonRound as abandonRoundService,
} from '../services/rounds'

export function useRounds(userId: string | undefined) {
  const [rounds, setRounds] = useState<any[]>([])
  const [activeRound, setActiveRound] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) return
    const [allRounds, active] = await Promise.all([
      getRounds(userId),
      getActiveRound(userId),
    ])
    setRounds(allRounds)
    setActiveRound(active)
  }, [userId])

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    let ignore = false
    refresh().catch((e) => { if (!ignore) setError(e.message) }).finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [userId, refresh])

  // Refresh whenever any round we can see gets updated (e.g. host finishes the round)
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`rounds-updates:${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rounds' }, () => {
        refresh()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, refresh])

  const startRound = useCallback(async (courseId: string, players: NewRoundPlayer[], fireteamId?: string) => {
    if (!userId) return null
    const round = await startRoundService(courseId, userId, players, fireteamId)
    setActiveRound(round)
    return round
  }, [userId])

  const finishRound = useCallback(async (roundId: string, holesPlayed: number) => {
    await finishRoundService(roundId, holesPlayed)
    setActiveRound(null)
    await refresh()
  }, [refresh])

  const abandonRound = useCallback(async (roundId: string) => {
    await abandonRoundService(roundId)
    setActiveRound(null)
  }, [])

  return { rounds, activeRound, loading, error, startRound, finishRound, abandonRound, refresh }
}
