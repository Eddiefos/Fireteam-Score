import { supabase } from './supabase'
import type { Profile } from '../types'

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw new Error(error.message)
  return data as Profile
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'display_name' | 'initials' | 'avatar_color' | 'username'>>,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function ensureProfile(userId: string, email: string): Promise<Profile> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (data) return data as Profile

  const username = email.split('@')[0]
  const { data: created, error } = await supabase
    .from('profiles')
    .insert({ id: userId, username, display_name: username, initials: username.slice(0, 2).toUpperCase() })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return created as Profile
}
