import { supabase } from './supabase'
import type { Course, CourseHole, CourseSubmission } from '../types'
import { del } from 'idb-keyval'

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

export async function getOfficialCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*, course_holes(hole_number, par)')
    .eq('source', 'official')
    .order('name')

  if (error) throw new Error(error.message)
  return (data ?? []) as Course[]
}

export interface SubmissionInput {
  name: string
  location: string | null
  lat: number | null
  lng: number | null
  holes: number
  holes_detail: Array<{ hole_number: number; par: number }> | null
  notes: string | null
}

export async function submitCourse(
  userId: string,
  input: SubmissionInput,
): Promise<CourseSubmission> {
  const { data, error } = await supabase
    .from('course_submissions')
    .insert({ ...input, submitted_by: userId })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as CourseSubmission
}

export async function approveSubmission(
  adminId: string,
  sub: CourseSubmission,
): Promise<void> {
  const { data: courseRow, error: courseErr } = await supabase
    .from('courses')
    .insert({
      name: sub.name,
      location: sub.location,
      lat: sub.lat,
      lng: sub.lng,
      holes: sub.holes,
      source: 'official',
      is_public: true,
      created_by: null,
    })
    .select()
    .single()

  if (courseErr) throw new Error(courseErr.message)

  if (sub.holes_detail?.length) {
    const { error: holesErr } = await supabase
      .from('course_holes')
      .insert(
        sub.holes_detail.map(h => ({
          course_id: courseRow.id,
          hole_number: h.hole_number,
          par: h.par,
        })),
      )
    if (holesErr) throw new Error(holesErr.message)
  }

  const { error: updateErr } = await supabase
    .from('course_submissions')
    .update({
      status: 'approved',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', sub.id)

  if (updateErr) throw new Error(updateErr.message)

  await del('official-courses')
}
