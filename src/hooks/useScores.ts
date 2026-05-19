import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import type { Score } from '../types'
import { submitScore as submitScoreService, getScores } from '../services/scores'
import { queueScore, flushScoreQueue } from '../lib/offline'

export function useScores(roundId: string | undefined) {
  const [scores, setScores] = useState<Score[]>([])
  const [loading, setLoading] = useState(true)

  // Initial load
  useEffect(() => {
    if (!roundId) { setLoading(false); return }
    let ignore = false
    getScores(roundId)
      .then((data) => { if (!ignore) setScores(data) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [roundId])

  // Realtime subscription
  useEffect(() => {
    if (!roundId) return
    const channel = supabase
      .channel(`scores:${roundId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores', filter: `round_id=eq.${roundId}` },
        (payload: { new: Score }) => {
          const incoming = payload.new
          setScores((prev) => {
            const idx = prev.findIndex(
              (s) => s.round_player_id === incoming.round_player_id && s.hole_number === incoming.hole_number
            )
            if (idx >= 0) {
              const updated = [...prev]
              updated[idx] = incoming
              return updated
            }
            return [...prev, incoming]
          })
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roundId])

  // Flush offline queue when coming back online
  useEffect(() => {
    const handleOnline = () => {
      flushScoreQueue((rid, rp, uid, hole, strokes) =>
        submitScoreService(rid, rp, uid, hole, strokes)
      )
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  const submitScore = useCallback(async (
    roundPlayerId: string,
    userId: string | null,
    holeNumber: number,
    strokes: number,
  ) => {
    if (!roundId) return

    // Optimistic update
    setScores((prev) => {
      const existing = prev.findIndex(
        (s) => s.round_player_id === roundPlayerId && s.hole_number === holeNumber
      )
      const next: Score = {
        id: 'optimistic',
        round_id: roundId,
        round_player_id: roundPlayerId,
        user_id: userId,
        hole_number: holeNumber,
        strokes,
        created_at: new Date().toISOString(),
      }
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = next
        return updated
      }
      return [...prev, next]
    })

    if (navigator.onLine) {
      await submitScoreService(roundId, roundPlayerId, userId, holeNumber, strokes)
    } else {
      await queueScore(roundId, roundPlayerId, userId, holeNumber, strokes)
    }
  }, [roundId])

  return { scores, loading, submitScore }
}
