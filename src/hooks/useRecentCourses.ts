import { useMemo } from 'react'
import { usePlayerRounds } from './usePlayerRounds'
import type { RecentCourse } from '../types'

export function useRecentCourses(userId: string | undefined) {
  const { rounds, loading } = usePlayerRounds(userId)

  const recentCourses = useMemo<RecentCourse[]>(() => {
    const seen = new Set<string>()
    const result: RecentCourse[] = []
    // getPlayerRoundsWithData orders by started_at DESC — first occurrence per course_id is most recent
    for (const round of rounds) {
      if (!seen.has(round.course_id)) {
        seen.add(round.course_id)
        result.push({
          courseId: round.course_id,
          courseName: round.course_name,
          pars: round.pars,
          lastPlayedAt: round.finished_at ?? round.started_at,
        })
      }
      if (result.length === 5) break
    }
    return result
  }, [rounds])

  return { recentCourses, loading }
}
