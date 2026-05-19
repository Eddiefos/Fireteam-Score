import { useState, useEffect, useCallback } from 'react'
import type { Course } from '../types'
import { getCourses, createCourse as createCourseService, updateCourse as updateCourseService, deleteCourse as deleteCourseService } from '../services/courses'

export function useCourses(userId: string | undefined, onlyMine = false) {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    getCourses(userId, onlyMine)
      .then(setCourses)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [userId, onlyMine])

  const createCourse = useCallback(async (data: { name: string; location?: string; pars: number[] }) => {
    if (!userId) return
    const course = await createCourseService({ ...data, created_by: userId })
    setCourses((prev) => [course, ...prev])
    return course
  }, [userId])

  const updateCourse = useCallback(async (id: string, data: { name?: string; pars?: number[]; location?: string }) => {
    await updateCourseService(id, data)
    setCourses((prev) => prev.map((c) => c.id === id ? { ...c, ...data, pars: data.pars ?? c.pars } : c))
  }, [])

  const deleteCourse = useCallback(async (id: string) => {
    await deleteCourseService(id)
    setCourses((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return { courses, loading, error, createCourse, updateCourse, deleteCourse }
}
