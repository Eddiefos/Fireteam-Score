import { createClient } from '@supabase/supabase-js'
import courses from './predefined-courses.json'

const supabase = createClient(
  (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function seed() {
  console.log(`Seeding ${courses.length} official courses…`)

  for (const course of courses) {
    const { course_holes, ...courseData } = course

    const existingQuery = supabase.from('courses').select('id')
    const { data: existing } = await (
      courseData.pdga_id
        ? existingQuery.eq('pdga_id', courseData.pdga_id).maybeSingle()
        : existingQuery.eq('name', courseData.name).maybeSingle()
    )

    let courseId: string

    if (existing) {
      const { error } = await supabase
        .from('courses')
        .update({ ...courseData, source: 'official', is_public: true, created_by: null })
        .eq('id', existing.id)
      if (error) throw new Error(`Update failed for ${courseData.name}: ${error.message}`)
      courseId = existing.id
      console.log(`  Updated: ${courseData.name}`)
    } else {
      const { data, error } = await supabase
        .from('courses')
        .insert({ ...courseData, source: 'official', is_public: true, created_by: null })
        .select()
        .single()
      if (error) throw new Error(`Insert failed for ${courseData.name}: ${error.message}`)
      courseId = data.id
      console.log(`  Inserted: ${courseData.name}`)
    }

    if (course_holes.length > 0) {
      await supabase.from('course_holes').delete().eq('course_id', courseId)
      const { error } = await supabase
        .from('course_holes')
        .insert(course_holes.map(h => ({ course_id: courseId, ...h })))
      if (error) throw new Error(`Holes insert failed for ${courseData.name}: ${error.message}`)
    }
  }

  console.log('Seed complete.')
}

seed().catch(err => { console.error(err); process.exit(1) })
