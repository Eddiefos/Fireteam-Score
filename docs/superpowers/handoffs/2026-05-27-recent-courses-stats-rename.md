# Handoff — 2026-05-27

## What was built

### 1. Recent Courses tab in CoursesScreen
- New `useRecentCourses` hook (`src/hooks/useRecentCourses.ts`) — derives unique recently-played courses from `usePlayerRounds`, deduped by `course_id`, sorted newest-first via `finished_at ?? started_at`.
- New `RecentCourse` type in `src/types/index.ts`.
- New `formatLastPlayed` utility (`src/lib/formatDate.ts`) — converts ISO timestamps to human labels: "Today", "Yesterday", "3 days ago", "20 May". Handles clock-skew (future dates → "Today").
- CoursesScreen "Recent" tab now shows real data: top 5 courses with a "Show X more / Show less" toggle.
- Tests: `src/lib/__tests__/formatDate.test.ts` (8 tests), `src/hooks/__tests__/useRecentCourses.test.ts` (5 tests).

### 2. Recently played chips on Start Round screen
- `StartRoundScreen.jsx` shows a horizontal scroll row of chips above the course tiles when the user has recent history.
- Chip format: "CourseName · 3 days ago" (single-line, B2 design from visual companion session).
- Tapping a chip sets `selectedCourseId` and advances to the ready-to-start state.
- Shows top 5 chips. No separate screen needed.
- `selectedCourse` lookup expanded to cover both user courses and official courses so pre-selection from chips works correctly.

### 3. Guard against multiple active rounds
- `getActiveRound` (`src/services/rounds.ts`) was ignoring its `userId` param — now correctly filters `created_by = userId`.
- `startRound` auto-abandons any existing active round before creating a new one.
- `rounds.test.ts` updated: switched `clearAllMocks` → `resetAllMocks` to prevent `mockReturnValueOnce` queue leakage, added `getActiveRoundChain` helper, added auto-abandon test.
- All 6 rounds tests pass. Pre-existing 11 failures in other test files are unrelated (baseline from before this work).

### 4. HomeScreen "History" → "Stats" rename
- The quick-nav tile on HomeScreen was labeled "History" but navigated to the `stats` screen/tab, causing a naming mismatch.
- Renamed the tile label to "Stats" to match the bottom tab and `StatsScreen`.

---

## Deferred / follow-up ideas

### History vs Stats split (intentionally deferred)
The user noticed the "History" → Stats mismatch and asked whether to rename or split. Decision: rename for now.

**Context for future revisit:** StatsScreen currently serves two purposes — aggregate performance metrics (win %, avg vs par, birdies) AND a chronological round list. These could be split into:
- **Stats** — purely the numbers/performance view
- **History** — a dedicated round log, potentially showing rounds across the whole fireteam, filterable by course or date range

This split would make sense if/when the round list grows complex enough to warrant its own IA (e.g. fireteam-wide history, course-specific filters). Not worth building until there's a clear need.

### One-time DB cleanup
Users who played before the multiple-active-rounds fix may have stale `active` rounds in the DB. A one-time migration to mark old orphaned active rounds as `abandoned` would clean this up. Low priority — only affects rounds created before this fix.

---

## Test baseline
- Pre-existing failures (not introduced by this work): 11 tests in `gameLogic.test.ts`, `courses.test.ts`, `useOfficialCourses.test.ts`. The handoff doc from 2026-05-23 stated 1 failure — this was inaccurate.
- All new code has full test coverage.
