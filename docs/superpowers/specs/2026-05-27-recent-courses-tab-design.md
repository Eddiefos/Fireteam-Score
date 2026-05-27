# Design: Recent Courses Tab
**Date:** 2026-05-27

## Problem

The "Recent" tab in `CoursesScreen` is a stub that shows `courses.slice(0, 5)` — the first five courses in the library with no relation to play history. It should show the courses the current user has most recently played, ordered by last play date, with a human-readable timestamp.

---

## Solution

Derive recent courses client-side from existing round history data. No new DB queries or migrations needed.

---

## Architecture

### New hook: `src/hooks/useRecentCourses.ts`

```ts
useRecentCourses(userId: string): {
  recentCourses: RecentCourse[]
  loading: boolean
  error: string | null
}
```

- Calls the existing `getPlayerRoundsWithData(userId)` (finished rounds with course joins, newest-first, limit 100)
- Deduplicates by `course_id` — first occurrence = most recent play per course
- Returns up to 5 entries, sorted newest-first
- Same `{ data, loading, error }` shape as other hooks in the codebase

### New type: `RecentCourse`

```ts
interface RecentCourse {
  course: CourseWithHoles   // existing type
  lastPlayedAt: string      // ISO timestamp of most recent finished round
}
```

Add to `src/types/index.ts`.

### New utility: `formatLastPlayed(isoDate: string): string`

Lives in `src/lib/formatDate.ts` (new file).

| Age | Output |
|---|---|
| Same calendar day | `"Today"` |
| Previous calendar day | `"Yesterday"` |
| 2–6 days ago | `"3 days ago"` |
| 7+ days | `"20 May"` (day + abbreviated month, no year) |

Pure function, no dependencies.

---

## CoursesScreen changes (`src/screens/CoursesScreen.jsx`)

- Import `useRecentCourses` and call it with `userId` (already available via auth context in the screen)
- Replace `const recentCourses = courses.slice(0, 5)` with data from the hook
- Each Recent card gets a secondary line below the location/par text showing the timestamp, styled with `FT.dim`, `13px`
- **Loading state:** same spinner/skeleton pattern used in the Official and My Courses tabs
- **Empty state:** short message — "No rounds played yet" — with a sub-line nudging the user to start a round

No changes to any other screen, service, or migration.

---

## Data flow

```
CoursesScreen
  └─ useRecentCourses(userId)
       └─ getPlayerRoundsWithData(userId)   [existing, rounds.ts]
            └─ Supabase: finished rounds JOIN courses
       → dedupe by course_id (client-side)
       → top 5 by started_at DESC
       → return RecentCourse[]

CoursesScreen renders each RecentCourse
  └─ formatLastPlayed(lastPlayedAt) → "Today" / "3 days ago" / "20 May"
```

---

## Files changed

| File | Change |
|---|---|
| `src/hooks/useRecentCourses.ts` | New |
| `src/lib/formatDate.ts` | New |
| `src/types/index.ts` | Add `RecentCourse` interface |
| `src/screens/CoursesScreen.jsx` | Use hook, show timestamp, loading + empty states |

---

## Out of scope

- No new Supabase query or RPC
- No changes to round services
- No "recently viewed" (only rounds that were finished count)
- No pagination — 5 entries is sufficient
