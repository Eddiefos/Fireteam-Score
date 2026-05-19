# Supabase DB Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Fireteam Score from localStorage to Supabase as the source of truth, with offline score queuing, a typed service/hook layer, and `App.jsx` split into focused files.

**Architecture:** Build typed services over Supabase, replace `useStore()` with focused hooks, extract all screen components and atoms from `App.jsx` into separate files, and wire the Supabase auth session (already working) into the main app router. Score submission queues to IndexedDB when offline and flushes on reconnect.

**Tech Stack:** Supabase JS v2, Vitest, @testing-library/react, idb-keyval, vite-plugin-pwa

---

## File Map

### New files to create
| File | Responsibility |
|---|---|
| `src/types/index.ts` | Shared types: Profile, Course, Round, Score |
| `src/constants/colors.ts` | FT palette + PLAYER_COLORS (moved from App.jsx) |
| `src/lib/uid.ts` | `uid()` helper |
| `src/lib/gameLogic.ts` | Pure game functions: playerTotal, playerVsPar, holesCompleted, winnerOf, computePlayerStats, format helpers |
| `src/lib/offline.ts` | IndexedDB score queue: queueScore, flushScoreQueue |
| `src/services/profiles.ts` | getProfile, updateProfile, ensureProfile |
| `src/services/courses.ts` | getCourses, createCourse, updateCourse, deleteCourse |
| `src/services/rounds.ts` | startRound, getRounds, getActiveRound, finishRound, abandonRound |
| `src/services/scores.ts` | submitScore, getScores |
| `src/hooks/useAuth.ts` | Session state, onAuthStateChange |
| `src/hooks/useProfile.ts` | Profile fetch + update |
| `src/hooks/useCourses.ts` | Courses CRUD with optimistic updates |
| `src/hooks/useRounds.ts` | Rounds list + active round |
| `src/hooks/useScores.ts` | Scores fetch + submit (online/offline) |
| `src/components/atoms/index.jsx` | All atom components extracted from App.jsx |
| `src/components/layout/ScreenShell.jsx` | ScreenShell extracted from App.jsx |
| `src/screens/HomeScreen.jsx` | HomeScreen (updated to use hooks) |
| `src/screens/StartRoundScreen.jsx` | StartRoundScreen (updated to use hooks) |
| `src/screens/LiveScorecardScreen.jsx` | LiveScorecardScreen (updated to use hooks) |
| `src/screens/RoundDetailScreen.jsx` | RoundDetailScreen (updated to use hooks) |
| `src/screens/StatsScreen.jsx` | StatsScreen (updated to use hooks) |
| `src/screens/CoursesScreen.jsx` | CoursesScreen + NewCourseScreen (updated to use hooks) |
| `src/screens/AuthScreens.jsx` | LandingScreen, CreateAccountScreen, LoginScreen, AccountScreen, SettingsScreen |
| `src/test/setup.ts` | Vitest setup file |
| `src/test/supabaseMock.ts` | Reusable Supabase client mock factory |

### Files to modify
| File | Changes |
|---|---|
| `src/App.jsx` | Remove store/screens/atoms/lib — keep only router, auth gate, tab bar |
| `vite.config.js` | Add Vitest config + vite-plugin-pwa |
| `package.json` | Add vitest, @testing-library/react, idb-keyval, vite-plugin-pwa |
| `tsconfig.json` | Create if missing — enable strict mode |

---

## Task 1: Install dependencies + configure Vitest

**Files:**
- Modify: `package.json`
- Create: `vite.config.js` (update)
- Create: `src/test/setup.ts`

- [ ] **Step 1: Install packages**

```bash
npm install idb-keyval
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom vite-plugin-pwa
```

- [ ] **Step 2: Update vite.config.js with Vitest config**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
```

- [ ] **Step 3: Add test script to package.json**

In `package.json`, update the `"scripts"` block:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: Create test setup file**

Create `src/test/setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Verify Vitest works**

```bash
npm test
```
Expected: "No test files found" or passes with 0 tests. No errors.

- [ ] **Step 6: Commit**

```bash
git add vite.config.js package.json package-lock.json src/test/setup.ts
git commit -m "feat: add Vitest + idb-keyval + vite-plugin-pwa"
```

---

## Task 2: Types and constants

**Files:**
- Create: `src/types/index.ts`
- Create: `src/constants/colors.ts`

- [ ] **Step 1: Create types**

Create `src/types/index.ts`:
```ts
export type Profile = {
  id: string
  username: string
  display_name: string
  initials: string
  avatar_color: string
  created_at: string
}

export type CourseHole = {
  hole_number: number
  par: number
  distance_m: number | null
}

export type Course = {
  id: string
  name: string
  location: string | null
  holes: number
  par_total: number | null
  pars: number[]
  source: 'pdga' | 'user'
  is_public: boolean
  created_by: string | null
  created_at: string
}

export type Round = {
  id: string
  course_id: string
  course_name: string
  pars: number[]
  status: 'active' | 'finished' | 'abandoned'
  holes_played: number
  created_by: string
  started_at: string
  finished_at: string | null
  players: RoundPlayer[]
  scores: Record<string, (number | null)[]>
}

export type RoundPlayer = {
  id: string
  name: string
  color: string
}

export type Score = {
  id: string
  round_id: string
  user_id: string
  hole_number: number
  strokes: number
  created_at: string
}

export type PendingScore = {
  round_id: string
  user_id: string
  hole_number: number
  strokes: number
  timestamp: number
}
```

- [ ] **Step 2: Create colors constants**

Create `src/constants/colors.ts`:
```ts
export const FT = {
  forest: '#1F3D2B',
  moss:   '#3A5A40',
  fern:   '#588157',
  cream:  '#F4EFE4',
  paper:  '#FAF6EC',
  bark:   '#2A1F17',
  ink:    '#15110D',
  orange: '#FF6B1F',
  amber:  '#FFB627',
  sky:    '#4A7CB6',
  rose:   '#E5556A',
  dim:    'rgba(42,31,23,0.55)',
  hair:   'rgba(42,31,23,0.12)',
} as const

export const PLAYER_COLORS = [
  FT.orange, FT.fern, FT.amber, FT.sky, FT.rose, FT.bark,
] as const

export const SF   = '-apple-system, "SF Pro Display", "SF Pro Text", system-ui, sans-serif'
export const SFR  = '-apple-system, "SF Pro Rounded", "SF Pro Display", system-ui, sans-serif'
export const MONO = '"SF Mono", ui-monospace, Menlo, monospace'
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/constants/colors.ts
git commit -m "feat: add shared types and color constants"
```

---

## Task 3: lib/uid.ts

**Files:**
- Create: `src/lib/uid.ts`
- Create: `src/lib/__tests__/uid.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/uid.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { uid, hashCode } from '../uid'

describe('uid', () => {
  it('returns a string', () => {
    expect(typeof uid()).toBe('string')
  })
  it('is at least 8 characters', () => {
    expect(uid().length).toBeGreaterThanOrEqual(8)
  })
  it('produces unique values', () => {
    expect(uid()).not.toBe(uid())
  })
})

describe('hashCode', () => {
  it('returns a number', () => {
    expect(typeof hashCode('hello')).toBe('number')
  })
  it('returns the same value for the same input', () => {
    expect(hashCode('abc')).toBe(hashCode('abc'))
  })
  it('returns different values for different inputs', () => {
    expect(hashCode('abc')).not.toBe(hashCode('xyz'))
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```
Expected: FAIL — "Cannot find module '../uid'"

- [ ] **Step 3: Implement**

Create `src/lib/uid.ts`:
```ts
export const uid = (): string =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export const hashCode = (s: string): number => {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return h
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```
Expected: PASS — 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/uid.ts src/lib/__tests__/uid.test.ts
git commit -m "feat: add uid and hashCode helpers"
```

---

## Task 4: lib/gameLogic.ts

**Files:**
- Create: `src/lib/gameLogic.ts`
- Create: `src/lib/__tests__/gameLogic.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/gameLogic.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  playerTotal, playerVsPar, holesCompleted, isRoundComplete,
  winnerOf, initialsOf, totalPar, formatDate, formatDuration, liveTimer,
} from '../gameLogic'
import type { Round } from '../../types'

const makeRound = (overrides: Partial<Round> = {}): Round => ({
  id: 'r1',
  course_id: 'c1',
  course_name: 'Test Course',
  pars: [3, 3, 4],
  status: 'active',
  holes_played: 0,
  created_by: 'u1',
  started_at: new Date().toISOString(),
  finished_at: null,
  players: [{ id: 'u1', name: 'Alice', color: '#FF6B1F' }],
  scores: { u1: [3, 2, null] },
  ...overrides,
})

describe('playerTotal', () => {
  it('sums strokes for scored holes', () => {
    expect(playerTotal(makeRound(), 'u1')).toBe(5)
  })
  it('stops at throughHole', () => {
    expect(playerTotal(makeRound(), 'u1', 1)).toBe(3)
  })
  it('returns 0 for unknown player', () => {
    expect(playerTotal(makeRound(), 'unknown')).toBe(0)
  })
})

describe('playerVsPar', () => {
  it('calculates score relative to par', () => {
    // hole1: 3 strokes, par 3 = E; hole2: 2 strokes, par 3 = -1
    expect(playerVsPar(makeRound(), 'u1')).toBe(-1)
  })
})

describe('holesCompleted', () => {
  it('counts holes where all players have a score', () => {
    expect(holesCompleted(makeRound())).toBe(2)
  })
  it('returns 0 for null round', () => {
    expect(holesCompleted(null as any)).toBe(0)
  })
})

describe('isRoundComplete', () => {
  it('returns false when some holes are null', () => {
    expect(isRoundComplete(makeRound())).toBe(false)
  })
  it('returns true when all holes are scored', () => {
    const r = makeRound({ scores: { u1: [3, 3, 4] } })
    expect(isRoundComplete(r)).toBe(true)
  })
})

describe('winnerOf', () => {
  it('returns the player with the lowest total', () => {
    const r = makeRound({
      players: [
        { id: 'u1', name: 'Alice', color: '#FF6B1F' },
        { id: 'u2', name: 'Bob', color: '#3A5A40' },
      ],
      scores: { u1: [3, 3, 4], u2: [4, 4, 5] },
    })
    expect(winnerOf(r)?.name).toBe('Alice')
  })
})

describe('initialsOf', () => {
  it('returns two initials for a full name', () => {
    expect(initialsOf('Alice Borg')).toBe('AB')
  })
  it('returns first two chars for single name', () => {
    expect(initialsOf('Alice')).toBe('AL')
  })
  it('returns placeholder for empty string', () => {
    expect(initialsOf('')).toBe('··')
  })
})

describe('totalPar', () => {
  it('sums par values', () => {
    expect(totalPar([3, 3, 4, 3])).toBe(13)
  })
})

describe('formatDuration', () => {
  it('formats hours and minutes', () => {
    expect(formatDuration(3600000 + 1800000)).toBe('1h 30m')
  })
  it('formats minutes only', () => {
    expect(formatDuration(600000)).toBe('10m')
  })
  it('returns dash for null', () => {
    expect(formatDuration(null as any)).toBe('—')
  })
})

describe('liveTimer', () => {
  it('returns mm:ss format', () => {
    const start = Date.now() - 65000
    expect(liveTimer(start)).toMatch(/^\d+:\d{2}$/)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```
Expected: FAIL — "Cannot find module '../gameLogic'"

- [ ] **Step 3: Implement**

Create `src/lib/gameLogic.ts`. Copy these functions verbatim from `src/App.jsx` (lines 91–237), adding TypeScript types:

```ts
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
      n = i; break
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
    if (s < bestScore) { best = p; bestScore = s }
  }
  return best
}

export const formatDate = (ts: number): string => {
  const d = new Date(ts)
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${days[d.getDay()]} · ${months[d.getMonth()]} ${d.getDate()}`
}

export const formatShortDate = (ts: number): string => {
  const d = new Date(ts)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
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

export function computePlayerStats(rounds: Round[], playerName: string) {
  const completed = rounds.filter((r) => r.finished_at)
  const mine = completed.filter((r) => r.players.some((p) => p.name === playerName))
  let totalVs = 0, totalRounds = 0, birdies = 0, wins = 0
  const perCourse: Record<string, { courseName: string; rounds: number; sumVs: number; best: number | null }> = {}
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
    if (!perCourse[ck]) perCourse[ck] = { courseName: r.course_name, rounds: 0, sumVs: 0, best: null }
    perCourse[ck].rounds += 1
    perCourse[ck].sumVs += myVs
    if (perCourse[ck].best == null || myScore < perCourse[ck].best!) perCourse[ck].best = myScore

    for (const p of r.players) {
      if (p.id === me.id) continue
      const opp = h2h[p.name] || { w: 0, l: 0, t: 0, last: '–' }
      const oppScore = playerTotal(r, p.id)
      if (myScore < oppScore) { opp.w += 1; opp.last = 'W' }
      else if (myScore > oppScore) { opp.l += 1; opp.last = 'L' }
      else { opp.t += 1; opp.last = 'T' }
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```
Expected: PASS — all gameLogic tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/gameLogic.ts src/lib/__tests__/gameLogic.test.ts
git commit -m "feat: extract game logic to typed lib"
```

---

## Task 5: lib/offline.ts

**Files:**
- Create: `src/lib/offline.ts`
- Create: `src/lib/__tests__/offline.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/offline.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('idb-keyval', () => ({
  set: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
  keys: vi.fn().mockResolvedValue([]),
}))

import * as idbKeyval from 'idb-keyval'
import { queueScore, flushScoreQueue } from '../offline'

beforeEach(() => vi.clearAllMocks())

describe('queueScore', () => {
  it('writes to idb-keyval with the correct key', async () => {
    await queueScore('round1', 'user1', 3, 4)
    expect(idbKeyval.set).toHaveBeenCalledWith(
      'pending-score:round1:user1:3',
      expect.objectContaining({ round_id: 'round1', user_id: 'user1', hole_number: 3, strokes: 4 }),
    )
  })
})

describe('flushScoreQueue', () => {
  it('calls onSubmit for each pending score and deletes the key', async () => {
    vi.mocked(idbKeyval.keys).mockResolvedValue(['pending-score:r1:u1:1' as any])
    vi.mocked(idbKeyval.get).mockResolvedValue({ round_id: 'r1', user_id: 'u1', hole_number: 1, strokes: 3, timestamp: 1 })

    const onSubmit = vi.fn().mockResolvedValue(undefined)
    await flushScoreQueue(onSubmit)

    expect(onSubmit).toHaveBeenCalledWith('r1', 'u1', 1, 3)
    expect(idbKeyval.del).toHaveBeenCalledWith('pending-score:r1:u1:1')
  })

  it('does not delete key if onSubmit throws', async () => {
    vi.mocked(idbKeyval.keys).mockResolvedValue(['pending-score:r1:u1:2' as any])
    vi.mocked(idbKeyval.get).mockResolvedValue({ round_id: 'r1', user_id: 'u1', hole_number: 2, strokes: 5, timestamp: 1 })

    const onSubmit = vi.fn().mockRejectedValue(new Error('network'))
    await flushScoreQueue(onSubmit)

    expect(idbKeyval.del).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```
Expected: FAIL — "Cannot find module '../offline'"

- [ ] **Step 3: Implement**

Create `src/lib/offline.ts`:
```ts
import { set, get, del, keys } from 'idb-keyval'
import type { PendingScore } from '../types'

const SCORE_PREFIX = 'pending-score:'

export async function queueScore(
  round_id: string,
  user_id: string,
  hole_number: number,
  strokes: number,
): Promise<void> {
  const key = `${SCORE_PREFIX}${round_id}:${user_id}:${hole_number}`
  const entry: PendingScore = { round_id, user_id, hole_number, strokes, timestamp: Date.now() }
  await set(key, entry)
}

export async function flushScoreQueue(
  onSubmit: (round_id: string, user_id: string, hole_number: number, strokes: number) => Promise<void>,
): Promise<void> {
  const allKeys = await keys()
  const scoreKeys = (allKeys as string[])
    .filter((k) => k.startsWith(SCORE_PREFIX))

  const entries = await Promise.all(
    scoreKeys.map(async (k) => ({ key: k, entry: await get<PendingScore>(k) }))
  )

  const sorted = entries
    .filter((e) => e.entry != null)
    .sort((a, b) => (a.entry!.timestamp - b.entry!.timestamp))

  for (const { key, entry } of sorted) {
    try {
      await onSubmit(entry!.round_id, entry!.user_id, entry!.hole_number, entry!.strokes)
      await del(key)
    } catch {
      // Leave in queue — will retry next flush
    }
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline.ts src/lib/__tests__/offline.test.ts
git commit -m "feat: add offline score queue with idb-keyval"
```

---

## Task 6: Supabase mock + services setup

**Files:**
- Create: `src/test/supabaseMock.ts`

- [ ] **Step 1: Create reusable Supabase mock factory**

Create `src/test/supabaseMock.ts`:
```ts
import { vi } from 'vitest'

export type MockResult = { data: unknown; error: unknown }

export function makeSupabaseMock(result: MockResult = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  const terminal = vi.fn().mockResolvedValue(result)

  const methods = ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'is', 'order', 'limit', 'match']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain['single'] = terminal
  // Make the chain itself thenable (for queries that don't call .single())
  chain['then'] = (resolve: (v: MockResult) => void) => Promise.resolve(result).then(resolve)

  const from = vi.fn().mockReturnValue(chain)
  return { from, chain, terminal }
}

export function mockSupabaseModule(result: MockResult = { data: null, error: null }) {
  const mock = makeSupabaseMock(result)
  vi.mock('../services/supabase', () => ({ supabase: { from: mock.from, auth: { getUser: vi.fn() } } }))
  return mock
}
```

- [ ] **Step 2: Commit**

```bash
git add src/test/supabaseMock.ts
git commit -m "feat: add Supabase mock factory for tests"
```

---

## Task 7: services/profiles.ts

**Files:**
- Create: `src/services/profiles.ts`
- Create: `src/services/__tests__/profiles.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/services/__tests__/profiles.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockProfile = {
  id: 'u1', username: 'alice', display_name: 'Alice',
  initials: 'AL', avatar_color: '#FF6B1F', created_at: '2026-01-01',
}

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}))

import { supabase } from '../supabase'
import { getProfile, updateProfile } from '../profiles'

beforeEach(() => vi.clearAllMocks())

describe('getProfile', () => {
  it('fetches profile by userId', async () => {
    const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await getProfile('u1')
    expect(supabase.from).toHaveBeenCalledWith('profiles')
    expect(chain.eq).toHaveBeenCalledWith('id', 'u1')
    expect(result).toEqual(mockProfile)
  })

  it('throws if Supabase returns an error', async () => {
    const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await expect(getProfile('bad-id')).rejects.toThrow('not found')
  })
})

describe('updateProfile', () => {
  it('updates profile fields', async () => {
    const chain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await updateProfile('u1', { display_name: 'Alice B', initials: 'AB' })
    expect(chain.update).toHaveBeenCalledWith({ display_name: 'Alice B', initials: 'AB' })
    expect(chain.eq).toHaveBeenCalledWith('id', 'u1')
  })
})
```

- [ ] **Step 2: Run to confirm they fail**

```bash
npm test
```
Expected: FAIL — "Cannot find module '../profiles'"

- [ ] **Step 3: Implement**

Create `src/services/profiles.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/profiles.ts src/services/__tests__/profiles.test.ts
git commit -m "feat: add profiles service"
```

---

## Task 8: services/courses.ts

**Files:**
- Create: `src/services/courses.ts`
- Create: `src/services/__tests__/courses.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/services/__tests__/courses.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn(), auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) } },
}))

import { supabase } from '../supabase'
import { getCourses, createCourse, deleteCourse } from '../courses'

beforeEach(() => vi.clearAllMocks())

const mockCourse = { id: 'c1', name: 'Bear Creek', location: null, holes: 9, par_total: 27, source: 'user', is_public: true, created_by: 'u1', created_at: '2026-01-01' }
const mockHoles = [{ hole_number: 1, par: 3, distance_m: null }, { hole_number: 2, par: 3, distance_m: null }]

describe('getCourses', () => {
  it('fetches courses and their holes', async () => {
    const courseChain = { select: vi.fn().mockResolvedValue({ data: [mockCourse], error: null }) }
    const holeChain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: mockHoles, error: null }) }
    vi.mocked(supabase.from)
      .mockReturnValueOnce(courseChain as any)
      .mockReturnValueOnce(holeChain as any)

    const result = await getCourses()
    expect(result[0].pars).toEqual([3, 3])
  })
})

describe('deleteCourse', () => {
  it('calls delete with correct id', async () => {
    const chain = { delete: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await deleteCourse('c1')
    expect(chain.eq).toHaveBeenCalledWith('id', 'c1')
  })
})
```

- [ ] **Step 2: Run to confirm they fail**

```bash
npm test
```
Expected: FAIL

- [ ] **Step 3: Implement**

Create `src/services/courses.ts`:
```ts
import { supabase } from './supabase'
import type { Course } from '../types'

export async function getCourses(): Promise<Course[]> {
  const { data: courses, error } = await supabase
    .from('courses')
    .select('*')
  if (error) throw new Error(error.message)

  const withPars = await Promise.all(
    (courses as any[]).map(async (c) => {
      const { data: holes } = await supabase
        .from('course_holes')
        .select('hole_number, par, distance_m')
        .eq('course_id', c.id)
        .order('hole_number')
      const pars = holes ? (holes as any[]).map((h) => h.par) : Array(c.holes).fill(3)
      return { ...c, pars } as Course
    })
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

  const holes = data.pars.map((par, i) => ({
    course_id: (course as any).id,
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
    const holes = data.pars.map((par, i) => ({ course_id: id, hole_number: i + 1, par }))
    const { error } = await supabase.from('course_holes').insert(holes)
    if (error) throw new Error(error.message)
  }
}

export async function deleteCourse(id: string): Promise<void> {
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/courses.ts src/services/__tests__/courses.test.ts
git commit -m "feat: add courses service"
```

---

## Task 9: services/rounds.ts + services/scores.ts

**Files:**
- Create: `src/services/rounds.ts`
- Create: `src/services/scores.ts`
- Create: `src/services/__tests__/rounds.test.ts`
- Create: `src/services/__tests__/scores.test.ts`

- [ ] **Step 1: Write failing tests for rounds**

Create `src/services/__tests__/rounds.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../supabase'
import { startRound, finishRound, abandonRound } from '../rounds'

beforeEach(() => vi.clearAllMocks())

describe('startRound', () => {
  it('inserts a round and returns it', async () => {
    const mockRound = { id: 'r1', course_id: 'c1', status: 'active', started_at: '2026-01-01', finished_at: null, holes_played: 0, created_by: 'u1' }
    const chain = { insert: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: mockRound, error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await startRound('c1', 'u1')
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ course_id: 'c1', created_by: 'u1', status: 'active' }))
    expect(result.id).toBe('r1')
  })
})

describe('finishRound', () => {
  it('sets status to finished', async () => {
    const chain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await finishRound('r1')
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'finished' }))
  })
})

describe('abandonRound', () => {
  it('sets status to abandoned', async () => {
    const chain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await abandonRound('r1')
    expect(chain.update).toHaveBeenCalledWith({ status: 'abandoned' })
  })
})
```

- [ ] **Step 2: Write failing tests for scores**

Create `src/services/__tests__/scores.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../supabase'
import { submitScore, getScores } from '../scores'

beforeEach(() => vi.clearAllMocks())

describe('submitScore', () => {
  it('upserts the score', async () => {
    const chain = { upsert: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await submitScore('r1', 'u1', 3, 4)
    expect(chain.upsert).toHaveBeenCalledWith(
      { round_id: 'r1', user_id: 'u1', hole_number: 3, strokes: 4 },
      { onConflict: 'round_id,user_id,hole_number' },
    )
  })
})

describe('getScores', () => {
  it('fetches scores for a round', async () => {
    const scores = [{ id: 's1', round_id: 'r1', user_id: 'u1', hole_number: 1, strokes: 3 }]
    const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: scores, error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await getScores('r1')
    expect(result).toEqual(scores)
  })
})
```

- [ ] **Step 3: Run to confirm they fail**

```bash
npm test
```
Expected: FAIL

- [ ] **Step 4: Implement rounds service**

Create `src/services/rounds.ts`:
```ts
import { supabase } from './supabase'
import type { Round, Score } from '../types'

export async function startRound(courseId: string, userId: string): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('rounds')
    .insert({ course_id: courseId, status: 'active', holes_played: 0, created_by: userId })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as { id: string }
}

export async function getRounds(userId: string): Promise<{ id: string; course_id: string; started_at: string; finished_at: string | null; status: string }[]> {
  const { data, error } = await supabase
    .from('rounds')
    .select('id, course_id, started_at, finished_at, status, holes_played')
    .eq('created_by', userId)
    .order('started_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as any[]
}

export async function getActiveRound(userId: string): Promise<{ id: string; course_id: string; started_at: string } | null> {
  const { data } = await supabase
    .from('rounds')
    .select('id, course_id, started_at, holes_played')
    .eq('created_by', userId)
    .eq('status', 'active')
    .single()
  return data ?? null
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
```

- [ ] **Step 5: Implement scores service**

Create `src/services/scores.ts`:
```ts
import { supabase } from './supabase'
import type { Score } from '../types'

export async function submitScore(
  roundId: string,
  userId: string,
  holeNumber: number,
  strokes: number,
): Promise<void> {
  const { error } = await supabase
    .from('scores')
    .upsert(
      { round_id: roundId, user_id: userId, hole_number: holeNumber, strokes },
      { onConflict: 'round_id,user_id,hole_number' },
    )
  if (error) throw new Error(error.message)
}

export async function getScores(roundId: string): Promise<Score[]> {
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('round_id', roundId)
  if (error) throw new Error(error.message)
  return (data ?? []) as Score[]
}
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npm test
```
Expected: PASS — all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/services/rounds.ts src/services/scores.ts src/services/__tests__/rounds.test.ts src/services/__tests__/scores.test.ts
git commit -m "feat: add rounds and scores services"
```

---

## Task 10: Hooks — useAuth, useProfile, useCourses, useRounds, useScores

**Files:**
- Create: `src/hooks/useAuth.ts`
- Create: `src/hooks/useProfile.ts`
- Create: `src/hooks/useCourses.ts`
- Create: `src/hooks/useRounds.ts`
- Create: `src/hooks/useScores.ts`

These hooks are integration-tested end-to-end by the running app. Unit tests for hooks require `@testing-library/react` renderHook setup — covered in a later task if needed. For now, implement and verify via the app.

- [ ] **Step 1: Create useAuth.ts**

Create `src/hooks/useAuth.ts`:
```ts
import { useState, useEffect } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  return {
    session,
    user: session?.user ?? null,
    loading: session === undefined,
  }
}
```

- [ ] **Step 2: Create useProfile.ts**

Create `src/hooks/useProfile.ts`:
```ts
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
```

- [ ] **Step 3: Create useCourses.ts**

Create `src/hooks/useCourses.ts`:
```ts
import { useState, useEffect, useCallback } from 'react'
import type { Course } from '../types'
import { getCourses, createCourse as createCourseService, updateCourse as updateCourseService, deleteCourse as deleteCourseService } from '../services/courses'

export function useCourses(userId: string | undefined) {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    getCourses()
      .then(setCourses)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [userId])

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
```

- [ ] **Step 4: Create useRounds.ts**

Create `src/hooks/useRounds.ts`:
```ts
import { useState, useEffect, useCallback } from 'react'
import { getRounds, getActiveRound, startRound as startRoundService, finishRound as finishRoundService, abandonRound as abandonRoundService } from '../services/rounds'

export function useRounds(userId: string | undefined) {
  const [rounds, setRounds] = useState<any[]>([])
  const [activeRound, setActiveRound] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) return
    const [allRounds, active] = await Promise.all([
      getRounds(userId),
      getActiveRound(userId),
    ])
    setRounds(allRounds)
    setActiveRound(active)
  }, [userId])

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    refresh().catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [userId, refresh])

  const startRound = useCallback(async (courseId: string) => {
    if (!userId) return null
    const round = await startRoundService(courseId, userId)
    setActiveRound(round)
    return round
  }, [userId])

  const finishRound = useCallback(async (roundId: string) => {
    await finishRoundService(roundId)
    setActiveRound(null)
    await refresh()
  }, [refresh])

  const abandonRound = useCallback(async (roundId: string) => {
    await abandonRoundService(roundId)
    setActiveRound(null)
  }, [])

  return { rounds, activeRound, loading, error, startRound, finishRound, abandonRound, refresh }
}
```

- [ ] **Step 5: Create useScores.ts**

Create `src/hooks/useScores.ts`:
```ts
import { useState, useEffect, useCallback } from 'react'
import type { Score } from '../types'
import { submitScore as submitScoreService, getScores } from '../services/scores'
import { queueScore, flushScoreQueue } from '../lib/offline'

export function useScores(roundId: string | undefined) {
  const [scores, setScores] = useState<Score[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!roundId) { setLoading(false); return }
    getScores(roundId)
      .then(setScores)
      .finally(() => setLoading(false))
  }, [roundId])

  useEffect(() => {
    const handleOnline = () => {
      flushScoreQueue((rid, uid, hole, strokes) => submitScoreService(rid, uid, hole, strokes))
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  const submitScore = useCallback(async (userId: string, holeNumber: number, strokes: number) => {
    if (!roundId) return

    // Optimistic update
    setScores((prev) => {
      const existing = prev.findIndex((s) => s.round_id === roundId && s.user_id === userId && s.hole_number === holeNumber)
      const next = { id: 'optimistic', round_id: roundId, user_id: userId, hole_number: holeNumber, strokes, created_at: new Date().toISOString() } as Score
      if (existing >= 0) {
        const updated = [...prev]; updated[existing] = next; return updated
      }
      return [...prev, next]
    })

    if (navigator.onLine) {
      await submitScoreService(roundId, userId, holeNumber, strokes)
    } else {
      await queueScore(roundId, userId, holeNumber, strokes)
    }
  }, [roundId])

  return { scores, loading, submitScore }
}
```

- [ ] **Step 6: Run existing tests to make sure nothing broke**

```bash
npm test
```
Expected: PASS — all previous tests still pass

- [ ] **Step 7: Commit**

```bash
git add src/hooks/
git commit -m "feat: add useAuth, useProfile, useCourses, useRounds, useScores hooks"
```

---

## Task 11: Extract atoms + layout from App.jsx

**Files:**
- Create: `src/components/atoms/index.jsx`
- Create: `src/components/layout/ScreenShell.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create atoms file**

Create `src/components/atoms/index.jsx`. Cut the following functions verbatim from `src/App.jsx` (lines 244–396) and paste them into the new file. Add these imports at the top:

```jsx
import { useState, useCallback } from 'react'
import { FT, SF, SFR, MONO } from '../../constants/colors'
import { initialsOf } from '../../lib/gameLogic'
```

Functions to move: `StatusBar`, `HomeIndicator`, `TopoBg`, `ParChip`, `Avatar`, `IconChevronLeft`, `IconChevronRight`, `IconArrow`, `IconClose`, `IconPlus`, `IconCheck`, `IconTrash`, `IconHamburger`, `Pill`, `EmptyState`, `useToast`

Add at bottom of file:
```jsx
export {
  StatusBar, HomeIndicator, TopoBg, ParChip, Avatar,
  IconChevronLeft, IconChevronRight, IconArrow, IconClose,
  IconPlus, IconCheck, IconTrash, IconHamburger,
  Pill, EmptyState, useToast,
}
```

- [ ] **Step 2: Create ScreenShell**

Create `src/components/layout/ScreenShell.jsx`:
```jsx
import { FT } from '../../constants/colors'

export function ScreenShell({ children, bg = FT.cream, dark = false, label }) {
  return (
    <div data-screen={label} style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: bg, color: dark ? FT.cream : FT.ink,
      position: 'relative', overflow: 'hidden',
    }}>{children}</div>
  )
}
```

- [ ] **Step 3: Add imports to App.jsx + remove extracted code**

At the top of `src/App.jsx`, add:
```jsx
import { FT, PLAYER_COLORS, SF, SFR, MONO } from './constants/colors'
import {
  StatusBar, HomeIndicator, TopoBg, ParChip, Avatar,
  IconChevronLeft, IconChevronRight, IconArrow, IconClose,
  IconPlus, IconCheck, IconTrash, IconHamburger,
  Pill, EmptyState, useToast,
} from './components/atoms'
import { ScreenShell } from './components/layout/ScreenShell'
```

Remove the corresponding function definitions from `App.jsx` (lines 244–396 approximately).

- [ ] **Step 4: Verify app runs**

```bash
npm run dev
```
Open the app in a browser. Confirm screens render without errors. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ src/App.jsx
git commit -m "refactor: extract atoms and ScreenShell from App.jsx"
```

---

## Task 12: Extract AuthScreens from App.jsx

**Files:**
- Create: `src/screens/AuthScreens.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create AuthScreens.jsx**

Create `src/screens/AuthScreens.jsx`. Add these imports at the top:

```jsx
import { useState } from 'react'
import { supabase } from '../services/supabase'
import { FT, SFR, MONO, SF } from '../constants/colors'
import { ScreenShell, } from '../components/layout/ScreenShell'
import { StatusBar, TopoBg, Avatar } from '../components/atoms'
```

Cut from `src/App.jsx` and paste: `LandingScreen`, `CreateAccountScreen`, `LoginScreen`, `AccountScreen`, `SettingsScreen`, `SquadScreen`

Add at bottom:
```jsx
export { LandingScreen, CreateAccountScreen, LoginScreen, AccountScreen, SettingsScreen, SquadScreen }
```

- [ ] **Step 2: Import in App.jsx + remove originals**

In `src/App.jsx` add:
```jsx
import { LandingScreen, CreateAccountScreen, LoginScreen, AccountScreen, SettingsScreen, SquadScreen } from './screens/AuthScreens'
```

Remove the cut functions from App.jsx.

- [ ] **Step 3: Verify app runs**

```bash
npm run dev
```
Confirm login/signup screens work. Sign out and sign in again to test the full auth flow.

- [ ] **Step 4: Commit**

```bash
git add src/screens/AuthScreens.jsx src/App.jsx
git commit -m "refactor: extract auth screens from App.jsx"
```

---

## Task 13: Extract CoursesScreen from App.jsx

**Files:**
- Create: `src/screens/CoursesScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create CoursesScreen.jsx**

Create `src/screens/CoursesScreen.jsx`. Add imports:

```jsx
import { useState, useEffect } from 'react'
import { FT, SFR, SF, MONO, PLAYER_COLORS } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import { StatusBar, ParChip, Avatar, IconChevronLeft, IconTrash, IconCheck, IconPlus, EmptyState } from '../components/atoms'
import { useCourses } from '../hooks/useCourses'
import { totalPar } from '../lib/gameLogic'
```

Cut from App.jsx: `CoursesScreen`, `NewCourseScreen`

Update both components to replace `useStore()` with:
```jsx
// In CoursesScreen:
const { courses, loading, createCourse, updateCourse, deleteCourse } = useCourses(userId)
// Pass userId as a prop: function CoursesScreen({ go, userId })

// In NewCourseScreen:
const { createCourse, updateCourse } = useCourses(userId)
// Pass userId as a prop: function NewCourseScreen({ go, params, userId })
```

Add at bottom:
```jsx
export { CoursesScreen, NewCourseScreen }
```

- [ ] **Step 2: Import in App.jsx + remove originals + pass userId prop**

In `src/App.jsx` add:
```jsx
import { CoursesScreen, NewCourseScreen } from './screens/CoursesScreen'
```

In the screen switch block, update:
```jsx
case 'courses':   body = <CoursesScreen go={go} userId={user?.id} />; break;
case 'newCourse': body = <NewCourseScreen go={go} params={params} userId={user?.id} />; break;
```

Remove the cut functions from App.jsx.

- [ ] **Step 3: Verify**

```bash
npm run dev
```
Navigate to Courses screen. Create, edit and delete a course — confirm they appear/disappear correctly and data now comes from Supabase (check Supabase dashboard Table Editor).

- [ ] **Step 4: Commit**

```bash
git add src/screens/CoursesScreen.jsx src/App.jsx
git commit -m "feat: CoursesScreen wired to Supabase via useCourses"
```

---

## Task 14: Extract StatsScreen from App.jsx

**Files:**
- Create: `src/screens/StatsScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create StatsScreen.jsx**

Create `src/screens/StatsScreen.jsx`. Add imports:

```jsx
import { useMemo } from 'react'
import { FT, SFR, SF, MONO, PLAYER_COLORS } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import { StatusBar, ParChip, Avatar, TopoBg } from '../components/atoms'
import { useProfile } from '../hooks/useProfile'
import { useRounds } from '../hooks/useRounds'
import { useScores } from '../hooks/useScores'
import { computePlayerStats, formatShortDate } from '../lib/gameLogic'
```

Cut from App.jsx: `StatsScreen`

Replace `useStore()` usage:
```jsx
// function StatsScreen({ go, userId })
const { profile } = useProfile(userId)
const { rounds } = useRounds(userId)
// Replace: const { rounds, user } = useStore()
// Replace: computePlayerStats(rounds, user) → computePlayerStats(rounds, profile?.display_name ?? '')
// Replace: r.completedAt → r.finished_at
// Replace: r.courseId → r.course_id, r.courseName → r.course_name
```

Add at bottom:
```jsx
export { StatsScreen }
```

- [ ] **Step 2: Import in App.jsx**

```jsx
import { StatsScreen } from './screens/StatsScreen'
```

Update switch:
```jsx
case 'stats': body = <StatsScreen go={go} userId={user?.id} />; break;
```

Remove the cut function from App.jsx.

- [ ] **Step 3: Verify**

```bash
npm run dev
```
Navigate to Stats screen. Confirm it renders without errors (will be empty until rounds are saved to Supabase, which is fine).

- [ ] **Step 4: Commit**

```bash
git add src/screens/StatsScreen.jsx src/App.jsx
git commit -m "feat: StatsScreen wired to Supabase via useRounds + useProfile"
```

---

## Task 15: Extract HomeScreen from App.jsx

**Files:**
- Create: `src/screens/HomeScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create HomeScreen.jsx**

Create `src/screens/HomeScreen.jsx`. Add imports:

```jsx
import { useMemo } from 'react'
import { FT, SFR, SF, MONO, PLAYER_COLORS } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import { StatusBar, TopoBg, ParChip, Avatar, IconArrow } from '../components/atoms'
import { useProfile } from '../hooks/useProfile'
import { useRounds } from '../hooks/useRounds'
import { holesCompleted, isRoundComplete, winnerOf, playerVsPar, formatDate } from '../lib/gameLogic'
```

Cut from App.jsx: `HomeScreen`

Replace `useStore()`:
```jsx
// function HomeScreen({ go, userId })
const { profile } = useProfile(userId)
const { rounds, activeRound } = useRounds(userId)
// Replace: const { courses, rounds, current, user } = useStore()
// Replace: user → profile?.display_name
// Replace: current → activeRound
// Replace: r.completedAt → r.finished_at ? new Date(r.finished_at).getTime() : null
// Replace: r.courseId → r.course_id, r.courseName → r.course_name
// fireteam avatar bar is temporarily simplified to just show current user until Fireteams spec
```

Add at bottom:
```jsx
export { HomeScreen }
```

- [ ] **Step 2: Import in App.jsx**

```jsx
import { HomeScreen } from './screens/HomeScreen'
```

Update switch:
```jsx
case 'home': body = <HomeScreen go={go} userId={user?.id} />; break;
default:     body = <HomeScreen go={go} userId={user?.id} />;
```

Remove the cut function from App.jsx.

- [ ] **Step 3: Verify**

```bash
npm run dev
```
Home screen renders. User name shows from profile. Active round resume card shows if one exists.

- [ ] **Step 4: Commit**

```bash
git add src/screens/HomeScreen.jsx src/App.jsx
git commit -m "feat: HomeScreen wired to Supabase via useProfile + useRounds"
```

---

## Task 16: Extract StartRoundScreen from App.jsx

**Files:**
- Create: `src/screens/StartRoundScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create StartRoundScreen.jsx**

Create `src/screens/StartRoundScreen.jsx`. Add imports:

```jsx
import { useState, useMemo } from 'react'
import { FT, SFR, SF, MONO, PLAYER_COLORS } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import { StatusBar, ParChip, Avatar, IconChevronLeft, IconCheck } from '../components/atoms'
import { useCourses } from '../hooks/useCourses'
import { useRounds } from '../hooks/useRounds'
import { totalPar } from '../lib/gameLogic'
```

Cut from App.jsx: `StartRoundScreen`

Replace `useStore()`:
```jsx
// function StartRoundScreen({ go, userId, profile })
const { courses } = useCourses(userId)
const { startRound } = useRounds(userId)
// Remove the players section (multi-player is deferred to Fireteams spec)
// On "Tee it up": call startRound(selectedCourseId) then go('live')
// The players array passed to the round is just [{ id: userId, name: profile.display_name, color: profile.avatar_color }]
```

Add at bottom:
```jsx
export { StartRoundScreen }
```

- [ ] **Step 2: Import in App.jsx**

```jsx
import { StartRoundScreen } from './screens/StartRoundScreen'
```

Update switch:
```jsx
case 'start': body = <StartRoundScreen go={go} userId={user?.id} profile={profile} />; break;
```

(Note: `profile` comes from `useProfile(user?.id)` — add this hook call in App.jsx if not already there)

Remove the cut function from App.jsx.

- [ ] **Step 3: Verify**

```bash
npm run dev
```
Navigate to Start Round. Courses list loads from Supabase. Selecting a course and tapping "Tee it up" creates a round in Supabase and navigates to Live.

- [ ] **Step 4: Commit**

```bash
git add src/screens/StartRoundScreen.jsx src/App.jsx
git commit -m "feat: StartRoundScreen wired to Supabase — creates rounds via startRound()"
```

---

## Task 17: Extract LiveScorecardScreen from App.jsx

**Files:**
- Create: `src/screens/LiveScorecardScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create LiveScorecardScreen.jsx**

Create `src/screens/LiveScorecardScreen.jsx`. Add imports:

```jsx
import { useState, useEffect, useRef } from 'react'
import { FT, SFR, SF, MONO, PLAYER_COLORS } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import { StatusBar, ParChip, Avatar, IconChevronLeft, IconChevronRight, IconClose, TopoBg } from '../components/atoms'
import { useRounds } from '../hooks/useRounds'
import { useScores } from '../hooks/useScores'
import { useProfile } from '../hooks/useProfile'
import { useCourses } from '../hooks/useCourses'
import { holesCompleted, isRoundComplete, playerTotal, playerVsPar, liveTimer } from '../lib/gameLogic'
```

Cut from App.jsx: `LiveScorecardScreen`, `LiveScorecardImpl`

Replace `useStore()`:
```jsx
// function LiveScorecardScreen({ go, userId })
// function LiveScorecardImpl({ go, round, userId })
const { activeRound, finishRound, abandonRound } = useRounds(userId)
const { scores, submitScore } = useScores(activeRound?.id)
const { profile } = useProfile(userId)
const { courses } = useCourses(userId)

// Build the round object the existing rendering logic expects:
// - pars: from the course's course_holes (look up from courses by activeRound.course_id)
// - scores: transform Score[] → Record<userId, (number|null)[]>
// - players: [{ id: userId, name: profile.display_name, color: profile.avatar_color }]
// The score transformation:
const scoreMap = scores.reduce((acc, s) => {
  if (!acc[s.user_id]) acc[s.user_id] = Array(pars.length).fill(null)
  acc[s.user_id][s.hole_number - 1] = s.strokes
  return acc
}, {} as Record<string, (number | null)[]>)
```

On score submit, call `submitScore(userId, holeNumber, strokes)` (already handles online/offline).
On finish, call `finishRound(activeRound.id)` then `go('round', { roundId: activeRound.id, justFinished: true })`.
On abandon, call `abandonRound(activeRound.id)` then `go('home')`.

Add at bottom:
```jsx
export { LiveScorecardScreen }
```

- [ ] **Step 2: Import in App.jsx**

```jsx
import { LiveScorecardScreen } from './screens/LiveScorecardScreen'
```

Update switch:
```jsx
case 'live': body = <LiveScorecardScreen go={go} userId={user?.id} />; break;
```

Remove the cut functions from App.jsx.

- [ ] **Step 3: Verify**

```bash
npm run dev
```
Start a round, play through a few holes. Confirm scores appear in Supabase dashboard (`scores` table). Finish the round — confirm `rounds` table shows `status = 'finished'`.

- [ ] **Step 4: Commit**

```bash
git add src/screens/LiveScorecardScreen.jsx src/App.jsx
git commit -m "feat: LiveScorecardScreen wired to Supabase with offline queue support"
```

---

## Task 18: Extract RoundDetailScreen from App.jsx

**Files:**
- Create: `src/screens/RoundDetailScreen.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create RoundDetailScreen.jsx**

Create `src/screens/RoundDetailScreen.jsx`. Add imports:

```jsx
import { useState, useEffect } from 'react'
import { FT, SFR, SF, MONO, PLAYER_COLORS } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import { StatusBar, ParChip, Avatar, IconChevronLeft, TopoBg } from '../components/atoms'
import { useRounds } from '../hooks/useRounds'
import { useScores } from '../hooks/useScores'
import { useProfile } from '../hooks/useProfile'
import { useCourses } from '../hooks/useCourses'
import { playerTotal, playerVsPar, winnerOf, formatDate, formatDuration } from '../lib/gameLogic'
```

Cut from App.jsx: `RoundDetailScreen`, `RoundDetailImpl`

Replace `useStore()`: load the specific round by `params.roundId` from `useRounds(userId).rounds`. Load scores via `useScores(params.roundId)`. Build the same in-memory Round object used in LiveScorecardScreen (same score transform, same players array).

On delete: call `abandonRound(roundId)` (reuses the service, sets status=abandoned), then `go('home')`.

Add at bottom:
```jsx
export { RoundDetailScreen }
```

- [ ] **Step 2: Import in App.jsx**

```jsx
import { RoundDetailScreen } from './screens/RoundDetailScreen'
```

Update switch:
```jsx
case 'round': body = <RoundDetailScreen go={go} params={params} userId={user?.id} />; break;
```

Remove the cut functions from App.jsx.

- [ ] **Step 3: Verify**

```bash
npm run dev
```
Complete a round and confirm the end-of-round detail screen shows correct scores, total, and winner.

- [ ] **Step 4: Commit**

```bash
git add src/screens/RoundDetailScreen.jsx src/App.jsx
git commit -m "feat: RoundDetailScreen wired to Supabase"
```

---

## Task 19: Clean up App.jsx + remove localStorage store

**Files:**
- Modify: `src/App.jsx`

At this point all screen components are extracted. `App.jsx` should contain only: imports, the router state (`screen`, `params`, `history`), `useAuth`, `useProfile`, `go`, `goTab`, browser back button handler, loading/auth gate, screen switch, and `BottomTabBar`.

- [ ] **Step 1: Remove store and useStore from App.jsx**

Find and delete the following blocks in `src/App.jsx`:
- The `KEY` constant (lines ~32–37)
- The `storage` object (lines ~41–59)
- The `makeStore` function and `const store = makeStore()` (lines ~62–80)
- The `useStore` function (lines ~82–86)
- The inline `uid` function (line ~39) — now in `src/lib/uid.ts`
- The `FT`, `PLAYER_COLORS`, `SF`, `SFR`, `MONO` constants (lines ~8–27) — now imported from `src/constants/colors.ts`
- All domain helper functions (`initialsOf`, `totalPar`, `playerTotal`, etc., lines ~91–237) — now in `src/lib/gameLogic.ts`

- [ ] **Step 2: Add missing imports at top of App.jsx**

```jsx
import { useCallback, useState, useEffect } from 'react'
import { supabase } from './services/supabase'
import { FT, PLAYER_COLORS } from './constants/colors'
import { useAuth } from './hooks/useAuth'
import { useProfile } from './hooks/useProfile'
import { useToast } from './components/atoms'
```

- [ ] **Step 3: Wire useAuth + useProfile into App.jsx**

Replace the existing session management in `App.jsx` (the `useEffect` with `getSession` + `onAuthStateChange`) with:

```jsx
const { user, loading: authLoading } = useAuth()
const { profile } = useProfile(user?.id)
```

Update the loading check:
```jsx
if (authLoading) {
  return (
    <div className="ft-stage">
      <div className="ft-phone" style={{ background: FT.forest, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: FT.orange, opacity: 0.8 }} />
      </div>
    </div>
  )
}
```

Replace `if (!session)` with `if (!user)`.

- [ ] **Step 4: Verify App.jsx is clean**

```bash
wc -l src/App.jsx
```
Expected: under 200 lines.

```bash
npm run dev
```
Full app works: login → home → start round → live scorecard → finish → stats.

- [ ] **Step 5: Run all tests**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "refactor: App.jsx slimmed to router only — localStorage store removed"
```

---

## Task 20: Configure vite-plugin-pwa + Workbox

**Files:**
- Modify: `vite.config.js`
- Modify: `public/manifest.json`

- [ ] **Step 1: Update vite.config.js with PWA plugin**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // We have our own manifest.json in public/
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
```

- [ ] **Step 2: Verify PWA builds correctly**

```bash
npm run build && npm run preview
```
Open the preview URL in Chrome. Open DevTools → Application → Service Workers. Confirm service worker is registered. Open Application → Cache Storage — confirm app shell files are cached.

- [ ] **Step 3: Commit**

```bash
git add vite.config.js
git commit -m "feat: add vite-plugin-pwa with Workbox caching"
```

---

## Done

At this point:
- All data is persisted to Supabase (courses, rounds, scores)
- Auth session drives routing
- App.jsx is ~150 lines — a clean router
- All screens are in focused files using typed hooks
- Scores queue to IndexedDB when offline and flush on reconnect
- PWA app shell is cached for offline load
- All lib/service unit tests pass

**Next spec:** Fireteams — creation, invite codes, member management, and multi-player scoring.
