# Supabase DB Persistence — Design Spec
_2026-05-19_

## Overview

Migrate Fireteam Score from a localStorage-only data layer to Supabase as the source of truth, with full offline support for score submission. Auth session is wired into app routing. `App.jsx` is split into focused files as part of the work.

**Constraints:**
- All Supabase tables already exist in the project's Supabase instance
- Existing localStorage data is abandoned — users start fresh on first login
- Full offline support (free — browser APIs only)
- No dual code paths — localStorage is removed, not kept as fallback

---

## 1. Auth Routing

App boot sequence:

```
supabase.auth.getSession()
  ├─ no session  → router enters auth tree: 'landing' | 'login' | 'signup'
  └─ session     → load profile → router enters app tree: 'home' | 'start' | 'live' | ...
```

`onAuthStateChange` listener lives in `App.jsx`. On `SIGNED_IN` → load profile and navigate to `'home'`. On `SIGNED_OUT` → clear all state and navigate to `'landing'`.

The existing landing/login/signup/account screens are kept as-is. Only the routing logic around them changes.

---

## 2. Service Layer

All Supabase calls are isolated in `src/services/`. No component or hook calls `supabase` directly.

### `src/services/profiles.ts`
```
getProfile(userId)         → Profile row
updateProfile(userId, data) → void
ensureProfile(user)        → Profile row (safety net if trigger didn't fire)
```

### `src/services/courses.ts`
```
getCourses()               → Course[] (public + user's own)
createCourse(data)         → Course (inserts courses + course_holes)
updateCourse(id, data)     → void
deleteCourse(id)           → void (cascades to course_holes)
```

### `src/services/rounds.ts`
```
startRound(courseId, playerIds) → Round
getRounds(userId)               → Round[] (completed, user participated in)
getActiveRound(userId)          → Round | null (status = 'active')
finishRound(roundId)            → void (status = 'finished', finished_at = now())
abandonRound(roundId)           → void (status = 'abandoned')
```

### `src/services/scores.ts`
```
submitScore(roundId, userId, hole, strokes) → void (upsert)
getScores(roundId)                          → Score[]
```

---

## 3. Hooks

Replace the single `useStore()` with focused hooks in `src/hooks/`.

### `useAuth.ts`
- Calls `getSession()` on mount, subscribes to `onAuthStateChange`
- Returns `{ session, user, loading }`
- Consumed by `App.jsx` to drive the auth gate

### `useProfile.ts`
- Args: `userId`
- Calls `getProfile()` on mount
- Returns `{ profile, loading, updateProfile }`

### `useCourses.ts`
- Calls `getCourses()` on mount
- Returns `{ courses, loading, createCourse, updateCourse, deleteCourse }`
- Mutations update local state optimistically before the Supabase call resolves

### `useRounds.ts`
- Args: `userId`
- Calls `getRounds()` + `getActiveRound()` on mount
- Returns `{ rounds, activeRound, loading, startRound, finishRound, abandonRound }`

### `useScores.ts`
- Args: `roundId`
- Calls `getScores()` on mount
- Returns `{ scores, submitScore }`
- `submitScore` checks `navigator.onLine`: if online → call service directly; if offline → write to IndexedDB queue
- Subscribes to `window` `'online'` event to flush the queue when connection returns

---

## 4. Offline Support

### Workbox (vite-plugin-pwa)

| Resource | Cache strategy |
|---|---|
| App shell (HTML/JS/CSS) | Cache First |
| Course data | Stale While Revalidate |
| Profile images | Cache First |

### Score queue (`src/lib/offline.ts`)

Uses `idb-keyval`. Key structure:
```
pending-score:{roundId}:{userId}:{hole} → { strokes, timestamp }
active-round:{roundId}                  → full round snapshot
```

**`queueScore(roundId, userId, hole, strokes)`** — writes to IndexedDB

**`flushScoreQueue()`** — reads all `pending-score:*` keys, calls `submitScore()` for each in timestamp order, deletes keys on success. Upsert semantics handle any duplicates.

`useScores` calls `flushScoreQueue()` when the `'online'` event fires. No Service Worker background sync — flush happens on app foreground with connection, which covers the main use case (score offline on course, sync in car park).

---

## 5. File Split

`App.jsx` (~2600 lines) is broken up as part of this work. Target: ~100–150 lines in `App.jsx`.

### New files

| File | Contents |
|---|---|
| `src/constants/colors.ts` | `FT`, `PLAYER_COLORS` |
| `src/lib/uid.ts` | `uid()`, `hashCode()` |
| `src/lib/gameLogic.ts` | `playerTotal`, `playerVsPar`, `holesCompleted`, `isRoundComplete`, `winnerOf`, `computePlayerStats`, all `format*` helpers |
| `src/lib/offline.ts` | `queueScore()`, `flushScoreQueue()` |
| `src/components/atoms/index.jsx` | `ParChip`, `Avatar`, `Modal`, `Toast`, `StatusBar`, `HomeIndicator`, `TopoBg`, `Disc`, all icon components |
| `src/components/layout/ScreenShell.jsx` | `ScreenShell` |
| `src/screens/HomeScreen.jsx` | `HomeScreen` |
| `src/screens/StartRoundScreen.jsx` | `StartRoundScreen` |
| `src/screens/LiveScorecardScreen.jsx` | `LiveScorecardScreen` |
| `src/screens/RoundDetailScreen.jsx` | `RoundDetailScreen` |
| `src/screens/StatsScreen.jsx` | `StatsScreen` |
| `src/screens/CoursesScreen.jsx` | `CoursesScreen`, `NewCourseScreen` |
| `src/screens/AuthScreens.jsx` | `LandingScreen`, `LoginScreen`, `SignUpScreen`, `AccountScreen`, `SettingsScreen` |

### What stays in `App.jsx`
- `useAuth()` call + auth gate (session check → route to auth tree or app tree)
- `go(screen, params)` navigation function
- Top-level screen switcher (`switch(screen) { ... }`)

---

## 6. Error Handling

- Each service function catches Supabase errors and re-throws with a plain message
- Each hook exposes an `error` field alongside `loading`
- A simple `Toast` is shown on error (already built — used for offline queue flush failures too)
- No error boundaries needed for this work — existing ones stay as-is

---

## 7. TypeScript

All new files (`services/`, `hooks/`, `lib/`) are `.ts` / `.tsx`. Existing screen files stay `.jsx` for now — converting them is out of scope for this spec.

Types live in `src/types/index.ts`:
```ts
export type Profile = { id: string; username: string; display_name: string; initials: string; avatar_color: string; }
export type Course  = { id: string; name: string; holes: number; pars: number[]; /* ... */ }
export type Round   = { id: string; course_id: string; status: string; started_at: string; /* ... */ }
export type Score   = { id: string; round_id: string; user_id: string; hole_number: number; strokes: number; }
```

---

## 8. Multi-player Constraint (Pre-Fireteams)

The `scores` table requires a real `user_id` — ad-hoc name-only players cannot have scores persisted. For this phase:

- A round in Supabase is created with `fireteam_id = null` and only the authenticated user as a player
- The "add players" UI on the Start Round screen is **hidden** until Fireteams are implemented
- Only the logged-in user's scores are tracked in Supabase
- The Live Scorecard shows only the current user (single-player view for now)

Multi-player scoring is fully restored in the Fireteams spec.

---

## 9. Out of Scope

- Fireteams (next spec)
- Supabase Realtime (depends on Fireteams)
- PDGA course import
- Geolocation
- Converting existing `.jsx` screen files to `.tsx`
- Migrating existing localStorage data
