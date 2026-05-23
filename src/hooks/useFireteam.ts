import { useState, useEffect, useCallback } from 'react'
import type { Fireteam, FireteamInvite, Profile, Round } from '../types'
import {
  createFireteam as createFireteamService,
  getMyFireteam,
  getFireteamMembers,
  inviteToFireteam,
  getPendingInvites,
  acceptInvite as acceptInviteService,
  declineInvite as declineInviteService,
  getFireteamRoundsWithData,
  renameFireteam as renameFireteamService,
  kickMember as kickMemberService,
  leaveFireteam as leaveFireteamService,
  deleteFireteam as deleteFireteamService,
} from '../services/fireteams'

export function useFireteam(userId: string | undefined) {
  const [fireteam, setFireteam] = useState<Fireteam | null>(null)
  const [members, setMembers] = useState<Profile[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [pendingInvites, setPendingInvites] = useState<FireteamInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) return
    const [ft, invites] = await Promise.all([
      getMyFireteam(userId),
      getPendingInvites(userId),
    ])
    setFireteam(ft)
    setPendingInvites(invites)
    if (ft) {
      const [mems, ftRounds] = await Promise.all([
        getFireteamMembers(ft.id),
        getFireteamRoundsWithData(ft.id, userId),
      ])
      setMembers(mems)
      setRounds(ftRounds)
    } else {
      setMembers([])
      setRounds([])
    }
  }, [userId])

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    let ignore = false
    refresh()
      .catch((e) => { if (!ignore) setError(e.message) })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [userId, refresh])

  const createFireteam = useCallback(async (name: string) => {
    if (!userId) return
    const ft = await createFireteamService(name, userId)
    setFireteam(ft)
    setMembers([])
    setRounds([])
  }, [userId])

  const inviteMember = useCallback(async (inviteeId: string) => {
    if (!userId || !fireteam) return
    await inviteToFireteam(fireteam.id, userId, inviteeId)
  }, [userId, fireteam])

  const acceptInvite = useCallback(async (invite: FireteamInvite) => {
    if (!userId) return
    await acceptInviteService(invite.id, invite.fireteam_id, userId)
    await refresh()
  }, [userId, refresh])

  const declineInvite = useCallback(async (inviteId: string) => {
    await declineInviteService(inviteId)
    setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId))
  }, [])

  const renameFireteam = useCallback(async (fireteamId: string, name: string) => {
    await renameFireteamService(fireteamId, name)
    setFireteam((prev) => prev ? { ...prev, name } : prev)
  }, [])

  const kickMember = useCallback(async (fireteamId: string, memberId: string) => {
    await kickMemberService(fireteamId, memberId)
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
  }, [])

  const leaveFireteam = useCallback(async (fireteamId: string, uid: string) => {
    if (members.length <= 1) {
      await deleteFireteamService(fireteamId)
    } else {
      await leaveFireteamService(fireteamId, uid)
    }
    setFireteam(null)
    setMembers([])
    setRounds([])
  }, [members])

  return {
    fireteam,
    members,
    rounds,
    pendingInvites,
    loading,
    error,
    createFireteam,
    inviteMember,
    acceptInvite,
    declineInvite,
    renameFireteam,
    kickMember,
    leaveFireteam,
    refresh,
  }
}
