# Handoff: Recent Courses, Start Round Chips, Active Round Fix
**Date:** 2026-05-27  
**Branch:** `main` (committed directly)  
**Tests:** 95/106 passing · 11 pre-existing failures (unrelated baseline)

---

## What was built

Added real round history to the "Recent" tab in CoursesScreen, surfaced recently played courses as quick-pick chips on the Start Round screen, fixed a bug that allowed duplicate active rounds per user, and renamed the HomeScreen "History" tile to "Stats".

---

## Key changes

### Types (`src/types/index.ts`)
- `RecentCourse` — `{ courseId, courseName, pars, lastPlayedAt }`

### Utilities (`src/lib/formatDate.ts`)
- `formatLastPlayed(isoDate, now?)` — converts ISO timestamps to human labels: "Today", "Yesterday", "3 days ago", "20 May". Guards against clock-skew (future dates → "Today").

### Hook (`src/hooks/useRecentCourses.ts`)
- Derives unique recently-played courses from `usePlayerRounds`, deduped by `course_id`, sorted newest-first via `finished_at ?? started_at`. No cap — display limit handled in UI.

### Services (`src/services/rounds.ts`)
- `getActiveRound` was ignoring its `userId` param entirely — now filters by `created_by = userId`.
- `startRound` auto-abandons any existing active round before creating a new one.

### Screens (modified)
| File | Change |
|---|---|
| `src/screens/CoursesScreen.jsx` | "Recent" tab now shows real data from `useRecentCourses`. Top 5 shown by default with a "Show X more / Show less" toggle. |
| `src/screens/StartRoundScreen.jsx` | Horizontal scroll row of "Name · timestamp" chips in pick mode. Tapping a chip sets `selectedCourseId` and jumps to ready state. `selectedCourse` lookup expanded to cover both user and official courses. |
| `src/screens/HomeScreen.jsx` | Quick-nav tile renamed "History" → "Stats" to match the bottom tab. |

### Tests
- `src/lib/__tests__/formatDate.test.ts` — 8 tests for `formatLastPlayed`
- `src/hooks/__tests__/useRecentCourses.test.ts` — 5 tests (dedup, no cap, userId forwarding)
- `src/services/__tests__/rounds.test.ts` — updated to use `resetAllMocks()` (prevents `mockReturnValueOnce` queue leakage between tests); added `getActiveRoundChain` helper and auto-abandon test. 6/6 passing.

---

## What's NOT done / follow-up

- **History vs Stats split**: StatsScreen currently handles both aggregate metrics (win %, avg vs par, birdies) and a chronological round list. These could eventually be split into a dedicated "History" screen (round log, fireteam-wide, filterable) and a "Stats" screen (numbers only). Deferred until fireteam features make a separate history view clearly worthwhile.
- **One-time DB cleanup**: Users with rounds created before the active-round fix may have stale `active` rows in the DB. A one-time migration (`UPDATE rounds SET status = 'abandoned' WHERE status = 'active' AND finished_at IS NULL AND started_at < <fix date>`) would clean this up. Low priority.
- **Test baseline**: 11 pre-existing failures in `gameLogic.test.ts`, `courses.test.ts`, `useOfficialCourses.test.ts`. The 2026-05-23 handoff doc stated 1 failure — that was inaccurate.
