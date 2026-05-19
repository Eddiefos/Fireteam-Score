import { useState, useEffect, useCallback } from 'react'
import type { Score } from '../types'
import { submitScore as submitScoreService, getScores } from '../services/scores'
import { queueScore, flushScoreQueue } from '../lib/offline'

export function useScores(roundId: string | undefined) {
  const [scores, setScores] = useState<Score[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!roundId) { setLoading(false); return }
    getScores(roundId)
      .then(setScores)
      .finally(() => setLoading(false))
  }, [roundId])

  useEffect(() => {
    const handleOnline = () => {
      flushScoreQueue((rid, uid, hole, strokes) => submitScoreService(rid, uid, hole, strokes))
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  const submitScore = useCallback(async (userId: string, holeNumber: number, strokes: number) => {
    if (!roundId) return

    // Optimistic update
    setScores((prev) => {
      const existing = prev.findIndex((s) => s.round_id === roundId && s.user_id === userId && s.hole_number === holeNumber)
      const next: Score = { id: 'optimistic', round_id: roundId, user_id: userId, hole_number: holeNumber, strokes, created_at: new Date().toISOString() }
      if (existing >= 0) {
        const updated = [...prev]; updated[existing] = next; return updated
      }
      return [...prev, next]
    })

    if (navigator.onLine) {
      await submitScoreService(roundId, userId, holeNumber, strokes)
    } else {
      await queueScore(roundId, userId, holeNumber, strokes)
    }
  }, [roundId])

  return { scores, loading, submitScore }
}
