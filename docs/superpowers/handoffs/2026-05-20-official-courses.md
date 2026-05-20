# Handoff: Official Courses Feature
**Date:** 2026-05-20  
**Branch:** `predefined-courses` → merged to `main` (PR #5)  
**Tests:** 92/92 passing · TypeScript: clean

---

## What was built

Added predefined official Norwegian disc golf courses with search, course detail pages, community submission flow, and admin approval screen.

---

## Key changes

### Database
- `supabase/migrations/20260520000003_official_courses.sql`
  - `is_admin boolean` on `profiles`
  - `source` check constraint: `'official' | 'user'` (replaces old `'pdga'`)
  - Tightened RLS: only user-created courses are writable by users; official courses are read-only
  - `course_submissions` table with RLS (submit, view own, admin view/approve all)

### Types (`src/types/index.ts`)
- `Course.source: 'official' | 'user'` + `course_holes?: CourseHole[]`
- `Profile.is_admin: boolean`
- `WeatherData`, `CourseSubmission` interfaces

### Services (`src/services/courses.ts`)
- `getOfficialCourses()` — join query with `course_holes`
- `submitCourse(userId, input)` — inserts to `course_submissions`
- `approveSubmission(adminId, sub)` — creates course + holes, marks submission approved, busts IndexedDB cache
- `rejectSubmission(adminId, submissionId)`
- `getPendingSubmissions()`

### Hook (`src/hooks/useOfficialCourses.ts`)
- 24h IndexedDB cache via `idb-keyval` (key: `'official-courses'`)
- Client-side `search(query)` filters by name/location
- Cache is busted by `approveSubmission`

### Edge Function (`supabase/functions/weather-proxy/`)
- Deno proxy for Met.no API — required because browsers can't set `User-Agent`
- Returns `{ temperature, windSpeed, windDirection, symbolCode, fetchedAt }`
- `Cache-Control: public, max-age=1800`

### Weather service (`src/services/weather.ts`)
- `fetchWeather(lat, lon)` — calls weather-proxy Edge Function
- `weatherEmoji(symbolCode)` — maps Met.no symbol codes to emoji
- `windCompass(degrees)` — converts bearing to N/NE/E etc.

### Screens (new)
| File | Route | Description |
|---|---|---|
| `src/screens/OfficialCoursesScreen.jsx` | `officialCourses` | Search + list of official courses |
| `src/screens/CourseDetailScreen.jsx` | `courseDetail` | Map (Kartverket topo) + weather + "Choose this course" CTA |
| `src/screens/CourseSubmissionScreen.jsx` | `submitCourse` | Form to suggest a missing course |
| `src/screens/AdminScreen.jsx` | `admin` | Review + approve/reject pending submissions |

### Screens (modified)
| File | Change |
|---|---|
| `src/screens/StartRoundScreen.jsx` | Added `mode` state: `'pick' → 'mine' / go('officialCourses') → 'ready'`. Accepts `params.courseId` to pre-select a course. |
| `src/screens/CoursesScreen.jsx` | Renamed to "Course Library". Filter chips: Recent \| Official \| My Courses. |
| `src/screens/HomeScreen.jsx` | "Courses" tile label → "Course Library" |
| `src/screens/AuthScreens.jsx` | Admin button (gated by `profile.is_admin`) → `go('admin')` |
| `src/App.jsx` | Wired 4 new routes + imported new screens |

### Seed data
- `scripts/predefined-courses.json` — 5 courses (Bølgane, Ekeberg, Frogner, Lade, Stavanger)
- `scripts/seed-official-courses.ts` — upserts by `pdga_id`, sets `source: 'official'`
- **Already run** — all 5 courses are live in Supabase

### Design system additions (`src/constants/colors.ts`)
New FT tokens added for alpha variants used throughout:
`barkAlpha06/07/08/10/15/25/30/35/50`, `creamAlpha00/06/08`, `forestAlpha04/10`, `orangeAlpha12/35`, `inkAlpha45`, `shadowDark`, `error`

---

## Navigation flow

```
Home
 └─ "Course Library" → CoursesScreen (filter chips: Recent | Official | My Courses)
                                            └─ "Official" chip → OfficialCoursesScreen
                                                                   └─ tap course → CourseDetailScreen
                                                                                   └─ "Choose this course" → StartRoundScreen (ready mode)
                                                                   └─ "Missing a course?" → CourseSubmissionScreen

StartRoundScreen (pick mode)
 ├─ "Official Courses" tile → OfficialCoursesScreen (same flow as above)
 └─ "My Courses" tile → personal course list (existing)

AccountScreen (admin only)
 └─ "Course Submissions" → AdminScreen
```

---

## What's NOT done / follow-up

- **"Recent" tab is MVP**: shows the user's first 5 personal courses, not actual round history. A proper implementation would join `rounds` to `courses` ordered by `started_at`. Ticket: improve `recentCourses` derivation in `CoursesScreen`.
- **Map in CourseDetailScreen**: uses `interactive={false}` — no zoom/pan. Could be enabled for a better detail experience.
- **Weather cache**: currently fetched fresh on every CourseDetailScreen mount (Edge Function caches for 30 min server-side). Could add client-side TTL.
- **More official courses**: only 5 seeded. PDGA API has 179+ Norwegian courses. Adding more means updating `scripts/predefined-courses.json` and re-running the seed script.
- **`is_admin`**: no UI to grant admin — set manually in Supabase dashboard: `UPDATE profiles SET is_admin = true WHERE id = '<your-user-id>'`.

---

## How to add more official courses

1. Add entries to `scripts/predefined-courses.json` (use PDGA course page to find `pdga_id`, hole count, par)
2. Run:
   ```bash
   SUPABASE_URL=https://jobviwuibspnqrfrptyi.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
   npx tsx scripts/seed-official-courses.ts
   ```
   The script is idempotent — safe to re-run.
