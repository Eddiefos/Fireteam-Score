import { supabase } from './supabase'
import type { Course, CourseHole } from '../types'

export async function getCourses(userId: string, onlyMine = false): Promise<Course[]> {
  let query = supabase.from('courses').select('*')
  if (onlyMine) query = query.eq('created_by', userId)
  const { data: courses, error } = await query

  if (error) throw new Error(error.message)

  const withPars = await Promise.all(
    (courses as any[]).map(async (c) => {
      const { data: holes } = await supabase
        .from('course_holes')
        .select('hole_number, par, distance_m')
        .eq('course_id', c.id)
        .order('hole_number')

      const pars = holes
        ? (holes as CourseHole[]).map((h) => h.par)
        : Array(c.holes).fill(3)

      return { ...c, pars } as Course
    }),
  )

  return withPars
}

export async function createCourse(data: {
  name: string
  location?: string
  pars: number[]
  is_public?: boolean
  created_by: string
}): Promise<Course> {
  const { data: course, error } = await supabase
    .from('courses')
    .insert({
      name: data.name,
      location: data.location ?? null,
      holes: data.pars.length,
      par_total: data.pars.reduce((a, b) => a + b, 0),
      source: 'user',
      is_public: data.is_public ?? true,
      created_by: data.created_by,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  const courseId = (course as any).id
  const holes = data.pars.map((par, i) => ({
    course_id: courseId,
    hole_number: i + 1,
    par,
  }))

  const { error: holesError } = await supabase.from('course_holes').insert(holes)
  if (holesError) throw new Error(holesError.message)

  return { ...(course as any), pars: data.pars } as Course
}

export async function updateCourse(
  id: string,
  data: { name?: string; pars?: number[]; location?: string },
): Promise<void> {
  const updates: Record<string, unknown> = {}

  if (data.name) updates.name = data.name
  if (data.location !== undefined) updates.location = data.location
  if (data.pars) {
    updates.holes = data.pars.length
    updates.par_total = data.pars.reduce((a, b) => a + b, 0)
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from('courses').update(updates).eq('id', id)
    if (error) throw new Error(error.message)
  }

  if (data.pars) {
    await supabase.from('course_holes').delete().eq('course_id', id)
    const holes = data.pars.map((par, i) => ({
      course_id: id,
      hole_number: i + 1,
      par,
    }))
    const { error } = await supabase.from('course_holes').insert(holes)
    if (error) throw new Error(error.message)
  }
}

export async function deleteCourse(id: string): Promise<void> {
  const { error, count } = await supabase
    .from('courses')
    .delete({ count: 'exact' })
    .eq('id', id)
  if (error) throw new Error(error.message)
  if (count === 0) throw new Error('Delete blocked — missing RLS policy')
}
