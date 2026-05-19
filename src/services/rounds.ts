import { supabase } from './supabase'

export async function startRound(courseId: string, userId: string): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('rounds')
    .insert({ course_id: courseId, status: 'active', holes_played: 0, created_by: userId })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as { id: string }
}

export async function getRounds(userId: string): Promise<{ id: string; course_id: string; started_at: string; finished_at: string | null; status: string; holes_played: number }[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('id, course_id, started_at, finished_at, status, holes_played')
    .eq('created_by', userId)
    .order('started_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as any[]
}

export async function getActiveRound(userId: string): Promise<{ id: string; course_id: string; started_at: string; holes_played: number } | null> {
  const { data } = await supabase
    .from('rounds')
    .select('id, course_id, started_at, holes_played')
    .eq('created_by', userId)
    .eq('status', 'active')
    .single()
  return (data as any) ?? null
}

export async function finishRound(roundId: string): Promise<void> {
  const { error } = await supabase
    .from('rounds')
    .update({ status: 'finished', finished_at: new Date().toISOString() })
    .eq('id', roundId)
  if (error) throw new Error(error.message)
}

export async function abandonRound(roundId: string): Promise<void> {
  const { error } = await supabase
    .from('rounds')
    .update({ status: 'abandoned' })
    .eq('id', roundId)
  if (error) throw new Error(error.message)
}
