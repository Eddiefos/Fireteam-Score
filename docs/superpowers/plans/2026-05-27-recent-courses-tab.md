# Recent Courses Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Recent tab stub in CoursesScreen with real data — the 5 courses the user has most recently played, ordered by last play date, each showing a human-readable "last played" timestamp.

**Architecture:** A new `useRecentCourses` hook wraps the existing `usePlayerRounds` hook and deduplicates rounds by `course_id`, keeping the most recent `started_at` per course. A pure `formatLastPlayed` utility converts ISO timestamps to human labels. CoursesScreen imports both and replaces the `courses.slice(0, 5)` stub.

**Tech Stack:** React (hooks), TypeScript, Vitest + @testing-library/react

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/lib/formatDate.ts` | Create | `formatLastPlayed(isoDate, now?)` pure utility |
| `src/lib/__tests__/formatDate.test.ts` | Create | Unit tests for formatLastPlayed |
| `src/types/index.ts` | Modify | Add `RecentCourse` type |
| `src/hooks/useRecentCourses.ts` | Create | Hook: deduplicates round history → `RecentCourse[]` |
| `src/hooks/__tests__/useRecentCourses.test.ts` | Create | Hook tests |
| `src/screens/CoursesScreen.jsx` | Modify | Wire hook, update card, loading + empty states |

---

## Task 1: `formatLastPlayed` utility

**Files:**
- Create: `src/lib/formatDate.ts`
- Create: `src/lib/__tests__/formatDate.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/formatDate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatLastPlayed } from '../formatDate'

// Fixed reference point: May 27, 2026 at noon (local)
const NOW = new Date(2026, 4, 27, 12, 0, 0)

describe('formatLastPlayed', () => {
  it('returns "Today" for a timestamp from the same calendar day', () => {
    const date = new Date(2026, 4, 27, 8, 30, 0)
    expect(formatLastPlayed(date.toISOString(), NOW)).toBe('Today')
  })

  it('returns "Yesterday" for a timestamp from the previous day', () => {
    const date = new Date(2026, 4, 26, 15, 0, 0)
    expect(formatLastPlayed(date.toISOString(), NOW)).toBe('Yesterday')
  })

  it('returns "X days ago" for 2 days', () => {
    const date = new Date(2026, 4, 25, 10, 0, 0)
    expect(formatLastPlayed(date.toISOString(), NOW)).toBe('2 days ago')
  })

  it('returns "X days ago" for 6 days', () => {
    const date = new Date(2026, 4, 21, 10, 0, 0)
    expect(formatLastPlayed(date.toISOString(), NOW)).toBe('6 days ago')
  })

  it('returns "D Mon" for 7 days', () => {
    const date = new Date(2026, 4, 20, 10, 0, 0)
    expect(formatLastPlayed(date.toISOString(), NOW)).toBe('20 May')
  })

  it('returns "D Mon" for dates in a different month', () => {
    const date = new Date(2026, 2, 15, 10, 0, 0)
    expect(formatLastPlayed(date.toISOString(), NOW)).toBe('15 Mar')
  })

  it('uses current time as default when now is omitted', () => {
    // Just verifies it runs without error — the result depends on real clock
    expect(() => formatLastPlayed(new Date().toISOString())).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- src/lib/__tests__/formatDate.test.ts
```

Expected: FAIL — "Cannot find module '../formatDate'"

- [ ] **Step 3: Implement `formatLastPlayed`**

Create `src/lib/formatDate.ts`:

```ts
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatLastPlayed(isoDate: string, now: Date = new Date()): string {
  const date = new Date(isoDate)

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dateStart  = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  const diffDays = Math.round(
    (todayStart.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)  return `${diffDays} days ago`

  return `${date.getDate()} ${MONTHS[date.getMonth()]}`
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- src/lib/__tests__/formatDate.test.ts
```

Expected: 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/formatDate.ts src/lib/__tests__/formatDate.test.ts
git commit -m "feat: add formatLastPlayed date utility"
```

---

## Task 2: `RecentCourse` type

**Files:**
- Modify: `src/types/index.ts` (append to end of file)

- [ ] **Step 1: Add the type**

Append to `src/types/index.ts`:

```ts
export type RecentCourse = {
  courseId: string
  courseName: string
  pars: number[]
  lastPlayedAt: string  // ISO timestamp of most recent finished round
}
```

- [ ] **Step 2: Confirm TypeScript is clean**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add RecentCourse type"
```

---

## Task 3: `useRecentCourses` hook

**Files:**
- Create: `src/hooks/useRecentCourses.ts`
- Create: `src/hooks/__tests__/useRecentCourses.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/__tests__/useRecentCourses.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../services/rounds', () => ({
  getPlayerRoundsWithData: vi.fn().mockResolvedValue([]),
}))

import * as roundsService from '../../services/rounds'
import { useRecentCourses } from '../useRecentCourses'
import type { Round } from '../../types'

function makeRound(overrides: Partial<Round> = {}): Round {
  return {
    id: 'r1',
    course_id: 'c1',
    course_name: 'Test Course',
    pars: [3, 3, 3],
    status: 'finished',
    holes_played: 3,
    created_by: 'u1',
    started_at: '2026-05-20T10:00:00Z',
    finished_at: '2026-05-20T11:00:00Z',
    players: [],
    scores: {},
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('useRecentCourses', () => {
  it('returns empty array and loading=false when userId is undefined', async () => {
    const { result } = renderHook(() => useRecentCourses(undefined))
    await act(async () => {})
    expect(result.current.recentCourses).toHaveLength(0)
    expect(result.current.loading).toBe(false)
    expect(roundsService.getPlayerRoundsWithData).not.toHaveBeenCalled()
  })

  it('returns a RecentCourse for each unique course_id played', async () => {
    vi.mocked(roundsService.getPlayerRoundsWithData).mockResolvedValue([
      makeRound({ id: 'r1', course_id: 'c1', course_name: 'Alpha', started_at: '2026-05-25T10:00:00Z' }),
      makeRound({ id: 'r2', course_id: 'c2', course_name: 'Beta',  started_at: '2026-05-22T10:00:00Z' }),
    ])

    const { result } = renderHook(() => useRecentCourses('u1'))
    await act(async () => {})

    expect(result.current.recentCourses).toHaveLength(2)
    expect(result.current.recentCourses[0]).toEqual({
      courseId: 'c1',
      courseName: 'Alpha',
      pars: [3, 3, 3],
      lastPlayedAt: '2026-05-25T10:00:00Z',
    })
  })

  it('deduplicates: keeps the most recent play when a course appears multiple times', async () => {
    vi.mocked(roundsService.getPlayerRoundsWithData).mockResolvedValue([
      // rounds are newest-first (service guarantees this)
      makeRound({ id: 'r3', course_id: 'c1', started_at: '2026-05-25T10:00:00Z' }),
      makeRound({ id: 'r1', course_id: 'c1', started_at: '2026-05-10T10:00:00Z' }),
      makeRound({ id: 'r2', course_id: 'c2', course_name: 'Beta', started_at: '2026-05-20T10:00:00Z' }),
    ])

    const { result } = renderHook(() => useRecentCourses('u1'))
    await act(async () => {})

    expect(result.current.recentCourses).toHaveLength(2)
    // c1 appears with the most recent play date
    expect(result.current.recentCourses[0].courseId).toBe('c1')
    expect(result.current.recentCourses[0].lastPlayedAt).toBe('2026-05-25T10:00:00Z')
  })

  it('caps results at 5 courses', async () => {
    vi.mocked(roundsService.getPlayerRoundsWithData).mockResolvedValue(
      ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map((cid, i) =>
        makeRound({ id: `r${i}`, course_id: cid, course_name: `Course ${cid}` })
      )
    )

    const { result } = renderHook(() => useRecentCourses('u1'))
    await act(async () => {})

    expect(result.current.recentCourses).toHaveLength(5)
  })

  it('passes the userId to getPlayerRoundsWithData', async () => {
    const { result } = renderHook(() => useRecentCourses('user-abc'))
    await act(async () => {})
    expect(roundsService.getPlayerRoundsWithData).toHaveBeenCalledWith('user-abc')
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- src/hooks/__tests__/useRecentCourses.test.ts
```

Expected: FAIL — "Cannot find module '../useRecentCourses'"

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useRecentCourses.ts`:

```ts
import { useMemo } from 'react'
import { usePlayerRounds } from './usePlayerRounds'
import type { RecentCourse } from '../types'

export function useRecentCourses(userId: string | undefined) {
  const { rounds, loading } = usePlayerRounds(userId)

  const recentCourses = useMemo<RecentCourse[]>(() => {
    const seen = new Set<string>()
    const result: RecentCourse[] = []
    // rounds are already sorted newest-first by the service
    for (const round of rounds) {
      if (!seen.has(round.course_id)) {
        seen.add(round.course_id)
        result.push({
          courseId: round.course_id,
          courseName: round.course_name,
          pars: round.pars,
          lastPlayedAt: round.started_at,
        })
      }
      if (result.length === 5) break
    }
    return result
  }, [rounds])

  return { recentCourses, loading }
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- src/hooks/__tests__/useRecentCourses.test.ts
```

Expected: 5 tests passing.

- [ ] **Step 5: Confirm TypeScript is clean**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useRecentCourses.ts src/hooks/__tests__/useRecentCourses.test.ts
git commit -m "feat: add useRecentCourses hook"
```

---

## Task 4: Wire up CoursesScreen

**Files:**
- Modify: `src/screens/CoursesScreen.jsx`

- [ ] **Step 1: Add imports**

At the top of `src/screens/CoursesScreen.jsx`, add two imports after the existing import block:

```js
import { useRecentCourses } from '../hooks/useRecentCourses'
import { formatLastPlayed } from '../lib/formatDate'
```

- [ ] **Step 2: Replace the stub and add hook call**

Inside `CoursesScreen`, replace:

```js
const recentCourses = courses.slice(0, 5)
```

with:

```js
const { recentCourses, loading: recentLoading } = useRecentCourses(userId)
```

- [ ] **Step 3: Replace the Recent tab render**

Find the `{filter === 'recent' && ( ... )}` block (lines 131–156 in the current file) and replace it entirely with:

```jsx
{filter === 'recent' && (
  <div style={{ padding: '0 10px' }}>
    {recentLoading ? (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: FT.orange, opacity: 0.8 }} />
      </div>
    ) : recentCourses.length === 0 ? (
      <EmptyState
        icon={<IconBadge bg={FT.forest}><IconMapPin color={FT.cream} size={18} /></IconBadge>}
        title="No rounds played yet"
        body="Finish a round and your recent courses will appear here."
      />
    ) : (
      recentCourses.map(rc => (
        <div key={rc.courseId} style={{
          background: FT.paper, border: `1px solid ${FT.hair}`,
          borderRadius: 20, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6,
        }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12, background: FT.forest,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600, color: FT.cream, flexShrink: 0, fontFamily: MONO,
          }}>
            {rc.pars.length}H
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 16, color: FT.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {rc.courseName}
            </div>
            <div style={{ fontSize: 13, color: FT.dim, marginTop: 2 }}>
              Par {totalPar(rc.pars)} · {formatLastPlayed(rc.lastPlayedAt)}
            </div>
          </div>
        </div>
      ))
    )}
  </div>
)}
```

- [ ] **Step 4: Run the full test suite**

```bash
npm test
```

Expected: 91/92 pass (the 1 pre-existing failure in `useOfficialCourses.test.ts` is unrelated and should remain the only failure). No new failures.

- [ ] **Step 5: Confirm TypeScript is clean**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/screens/CoursesScreen.jsx
git commit -m "feat: implement Recent tab with useRecentCourses and last-played timestamps"
```
