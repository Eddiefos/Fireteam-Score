import { set, get, del, keys } from 'idb-keyval'
import type { PendingScore } from '../types'

const SCORE_PREFIX = 'pending-score:'

export async function queueScore(
  round_id: string,
  round_player_id: string,
  user_id: string | null,
  hole_number: number,
  strokes: number,
): Promise<void> {
  const key = `${SCORE_PREFIX}${round_id}:${round_player_id}:${hole_number}`
  const entry: PendingScore = { round_id, round_player_id, user_id, hole_number, strokes, timestamp: Date.now() }
  await set(key, entry)
}

export async function flushScoreQueue(
  onSubmit: (
    round_id: string,
    round_player_id: string,
    user_id: string | null,
    hole_number: number,
    strokes: number,
  ) => Promise<void>,
): Promise<void> {
  const allKeys = await keys()
  const scoreKeys = (allKeys as string[]).filter((k) => k.startsWith(SCORE_PREFIX))

  const entries = await Promise.all(
    scoreKeys.map(async (k) => ({ key: k, entry: await get<PendingScore>(k) }))
  )

  const sorted = entries
    .filter((e) => e.entry != null)
    .sort((a, b) => a.entry!.timestamp - b.entry!.timestamp)

  for (const { key, entry } of sorted) {
    try {
      await onSubmit(
        entry!.round_id,
        entry!.round_player_id!,
        entry!.user_id,
        entry!.hole_number,
        entry!.strokes,
      )
      await del(key)
    } catch {
      // Leave in queue — will retry next flush
    }
  }
}
