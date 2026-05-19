import { useState, useEffect, useCallback } from 'react'
import type { Profile } from '../types'
import { getProfile, updateProfile as updateProfileService } from '../services/profiles'

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    setLoading(true)
    getProfile(userId)
      .then(setProfile)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [userId])

  const updateProfile = useCallback(async (updates: Partial<Pick<Profile, 'display_name' | 'initials' | 'avatar_color'>>) => {
    if (!userId) return
    await updateProfileService(userId, updates)
    setProfile((p) => p ? { ...p, ...updates } : p)
  }, [userId])

  return { profile, loading, error, updateProfile }
}
