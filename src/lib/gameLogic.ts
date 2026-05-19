import type { Round, RoundPlayer } from '../types'

export const initialsOf = (name: string): string => {
  if (!name) return '··'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const totalPar = (pars: number[]): number =>
  pars.reduce((a, b) => a + (b || 0), 0)

export const playerTotal = (
  round: Round,
  playerId: string,
  throughHole: number | null = null,
): number => {
  const arr = (round.scores && round.scores[playerId]) || []
  const upTo = throughHole == null ? arr.length : throughHole
  let sum = 0
  for (let i = 0; i < upTo; i++) {
    const v = arr[i]
    if (typeof v === 'number') sum += v
  }
  return sum
}

export const playerVsPar = (
  round: Round,
  playerId: string,
  throughHole: number | null = null,
): number => {
  const arr = (round.scores && round.scores[playerId]) || []
  const upTo = throughHole == null ? arr.length : throughHole
  let v = 0
  for (let i = 0; i < upTo; i++) {
    const s = arr[i]
    if (typeof s === 'number') v += s - (round.pars[i] || 0)
  }
  return v
}

export const holesCompleted = (round: Round | null): number => {
  if (!round || !round.scores) return 0
  const playerIds = round.players.map((p) => p.id)
  let n = round.pars.length
  for (let i = 0; i < round.pars.length; i++) {
    if (!playerIds.every((pid) => typeof (round.scores[pid] || [])[i] === 'number')) {
      n = i
      break
    }
  }
  return n
}

export const isRoundComplete = (round: Round | null): boolean =>
  !!round && holesCompleted(round) === round.pars.length

export const winnerOf = (round: Round): RoundPlayer | null => {
  if (!round || !round.players.length) return null
  let best = round.players[0]
  let bestScore = playerTotal(round, best.id)
  for (let i = 1; i < round.players.length; i++) {
    const p = round.players[i]
    const s = playerTotal(round, p.id)
    if (s < bestScore) {
      best = p
      bestScore = s
    }
  }
  return best
}

export const formatDate = (ts: number): string => {
  const d = new Date(ts)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[d.getDay()]} · ${months[d.getMonth()]} ${d.getDate()}`
}

export const formatShortDate = (ts: number): string => {
  const d = new Date(ts)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

export const formatDuration = (ms: number | null): string => {
  if (!ms || ms < 0) return '—'
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export const liveTimer = (startedAt: number): string => {
  const ms = Math.max(0, Date.now() - startedAt)
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export type PlayerStats = {
  totalRounds: number
  avgVs: number
  birdies: number
  wins: number
  winPct: number
  perCourse: Array<{
    courseName: string
    rounds: number
    sumVs: number
    best: number | null
    avgVs: number
  }>
  h2h: Array<{
    name: string
    w: number
    l: number
    t: number
    last: string
  }>
}

export function computePlayerStats(rounds: Round[], playerName: string): PlayerStats {
  const completed = rounds.filter((r) => r.finished_at)
  const mine = completed.filter((r) => r.players.some((p) => p.name === playerName))
  let totalVs = 0
  let totalRounds = 0
  let birdies = 0
  let wins = 0
  const perCourse: Record<
    string,
    { courseName: string; rounds: number; sumVs: number; best: number | null }
  > = {}
  const h2h: Record<string, { w: number; l: number; t: number; last: string }> = {}

  for (const r of mine) {
    const me = r.players.find((p) => p.name === playerName)
    if (!me) continue
    const myScore = playerTotal(r, me.id)
    const myVs = playerVsPar(r, me.id)
    totalVs += myVs
    totalRounds += 1

    const myArr = r.scores[me.id] || []
    for (let i = 0; i < myArr.length; i++) {
      if (typeof myArr[i] === 'number' && (myArr[i] as number) - r.pars[i] <= -1) birdies += 1
    }

    let strictlyBest = true
    for (const p of r.players) {
      if (p.id === me.id) continue
      if (playerTotal(r, p.id) <= myScore) strictlyBest = false
    }
    if (strictlyBest) wins += 1

    const ck = r.course_id
    if (!perCourse[ck])
      perCourse[ck] = { courseName: r.course_name, rounds: 0, sumVs: 0, best: null }
    perCourse[ck].rounds += 1
    perCourse[ck].sumVs += myVs
    if (perCourse[ck].best == null || myScore < perCourse[ck].best!) perCourse[ck].best = myScore

    for (const p of r.players) {
      if (p.id === me.id) continue
      const opp = h2h[p.name] || { w: 0, l: 0, t: 0, last: '–' }
      const oppScore = playerTotal(r, p.id)
      if (myScore < oppScore) {
        opp.w += 1
        opp.last = 'W'
      } else if (myScore > oppScore) {
        opp.l += 1
        opp.last = 'L'
      } else {
        opp.t += 1
        opp.last = 'T'
      }
      h2h[p.name] = opp
    }
  }

  return {
    totalRounds,
    avgVs: totalRounds ? totalVs / totalRounds : 0,
    birdies,
    wins,
    winPct: totalRounds ? Math.round((wins / totalRounds) * 100) : 0,
    perCourse: Object.values(perCourse).map((c) => ({ ...c, avgVs: c.sumVs / c.rounds })),
    h2h: Object.entries(h2h).map(([name, v]) => ({ name, ...v })),
  }
}
