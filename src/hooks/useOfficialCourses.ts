import { useState, useEffect, useCallback } from 'react'
import { get, set } from 'idb-keyval'
import { getOfficialCourses } from '../services/courses'
import type { Course } from '../types'

const CACHE_KEY = 'official-courses-v2'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000  // 24 hours

interface CacheEntry {
  courses: Course[]
  cachedAt: number
}

export function useOfficialCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const cached = await get<CacheEntry>(CACHE_KEY)
        const isFresh = cached && Date.now() - cached.cachedAt < CACHE_TTL_MS

        if (isFresh) {
          if (!cancelled) {
            setCourses(cached.courses)
            setLoading(false)
          }
          return
        }

        const data = await getOfficialCourses()
        await set(CACHE_KEY, { courses: data, cachedAt: Date.now() })

        if (!cancelled) {
          setCourses(data)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load courses')
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const search = useCallback(
    (query: string): Course[] => {
      if (!query.trim()) return courses
      const q = query.toLowerCase()
      return courses.filter(
        c =>
          c.name.toLowerCase().includes(q) ||
          (c.location ?? '').toLowerCase().includes(q)
      )
    },
    [courses]
  )

  return { courses, loading, error, search }
}
