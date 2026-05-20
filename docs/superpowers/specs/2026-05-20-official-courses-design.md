# Official Norwegian Courses Design

> **For agentic workers:** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this spec task-by-task.

**Goal:** Introduce a library of predefined, read-only Norwegian disc golf courses that every user can discover and play — while keeping user-created courses as a separate, personal track.

**Architecture:** Two course types coexist in the existing `courses` table, distinguished by `source = 'official'` vs `source = 'user'`. A new `course_submissions` table holds community-submitted candidates pending admin approval. All official course data is fetched once, cached client-side in IndexedDB, and searched in memory — no per-keystroke network calls. Weather for each course is served via a Supabase Edge Function proxy to Met.no.

**Tech stack:** React + Vite PWA, Supabase (Postgres + RLS + Edge Functions), MapLibre GL JS + react-map-gl, Kartverket topo tiles, Met.no weather API, idb-keyval (IndexedDB).

---

## 1. Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Data source for official courses | Hand-curated JSON seed file | No API has complete per-hole par data + licence to store centrally. Only OSM is legally usable for bulk import but hole data is sparse. Start curated, grow via community submissions. |
| Minimum course quality gate | Full per-hole par required | Incomplete courses can't generate a scorecard. Only show predefined courses that have every hole's par value. |
| Map library | MapLibre GL JS + react-map-gl | WebGL rendering, 60 fps on mobile, open-source (BSD-3), no API key for renderer. |
| Map tiles | Kartverket topo tiles (CC BY 4.0) | Best terrain detail for Norwegian forests. Free, no key. Attribution: "© Kartverket". |
| Map detail | Single location pin (MVP) | Per-hole coordinates don't exist for most courses. Deferred to a future pass. |
| Weather API | Met.no via Supabase Edge Function proxy | Norwegian national weather service — best accuracy. Free, no key, CC BY 4.0. Proxy needed to set `User-Agent` header (browsers block this). Icons bundled locally for offline use. |
| Client search | Fetch-once + in-memory filter + IndexedDB | Instant autocomplete, works offline, scales to ~1000 courses without network cost. |
| Community submissions | Minimal form → pending table → admin approves | Low friction for users, quality gate via admin review before going live. |
| Admin gating | `is_admin` flag on `profiles` table | Simple, extensible. Set manually in Supabase dashboard. |
| Round flow | Predefined course ID used directly as `rounds.course_id` | No copying, no extra FK. Consistent with user-created course flow. |
| Choosing a predefined course | Goes directly to Start Round | No implicit saving to personal list. User searches again next time. |

---

## 2. Database Changes

### 2.1 `profiles` table

```sql
alter table profiles
  add column is_admin boolean not null default false;
```

Set `is_admin = true` on your row directly in the Supabase dashboard.

### 2.2 `courses` table

No schema changes. The `source` field value changes from `'pdga'` to `'official'` for predefined courses. Official courses have:
- `created_by = null`
- `is_public = true`
- `source = 'official'`

**Updated RLS policy** — prevent any user from modifying official courses:

```sql
drop policy if exists "Users can create courses" on courses;
create policy "Users can create courses" on courses
  for insert with check (auth.uid() = created_by and source = 'user');

drop policy if exists "Creators can update their own courses" on courses;
create policy "Creators can update their own courses" on courses
  for update using (auth.uid() = created_by and source = 'user');

drop policy if exists "Creators can delete their own courses" on courses;
create policy "Creators can delete their own courses" on courses
  for delete using (auth.uid() = created_by and source = 'user');
```

Official courses are readable by all via the existing `is_public = true` policy.

### 2.3 New `course_submissions` table

```sql
create table course_submissions (
  id           uuid primary key default gen_random_uuid(),
  submitted_by uuid references profiles(id) on delete set null,
  name         text not null,
  location     text,
  lat          numeric(9,6),
  lng          numeric(9,6),
  holes        int not null,
  pars         jsonb not null,  -- e.g. [3,3,4,3,3,4,3,3,3]
  notes        text,
  status       text not null default 'pending',  -- 'pending' | 'approved' | 'rejected'
  reviewed_by  uuid references profiles(id) on delete set null,
  created_at   timestamptz default now()
);

alter table course_submissions enable row level security;

create policy "Users can submit courses"
  on course_submissions for insert
  with check (auth.uid() = submitted_by);

create policy "Users can view their own submissions"
  on course_submissions for select
  using (auth.uid() = submitted_by);

create policy "Admins can view all submissions"
  on course_submissions for select
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create policy "Admins can update submissions"
  on course_submissions for update
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );
```

---

## 3. Seed Data

### 3.1 File structure

```
scripts/
  predefined-courses.json       -- curated official courses
  seed-official-courses.ts      -- upsert script
```

### 3.2 JSON format

```json
[
  {
    "name": "Bølgane Frisbeegolfpark",
    "location": "Kristiansand",
    "lat": 58.1414,
    "lng": 7.9965,
    "holes": 18,
    "pars": [3, 3, 4, 3, 3, 3, 4, 3, 3, 3, 3, 4, 3, 3, 3, 3, 4, 3]
  }
]
```

Rules for the JSON:
- `pars` array length must equal `holes`
- All par values must be integers in range 2–7
- `lat` / `lng` max 4 decimal places (Met.no requirement)

### 3.3 Seed script behaviour

`scripts/seed-official-courses.ts`:
- Reads `predefined-courses.json`
- Validates each entry (holes count, par range)
- Upserts into `courses` (match on `name + location`, set `source = 'official'`, `created_by = null`, `is_public = true`)
- Deletes and re-inserts all `course_holes` rows for each upserted course
- Logs a summary: N inserted, N updated, N skipped (validation failures)
- Safe to re-run — idempotent

Run: `npx tsx scripts/seed-official-courses.ts`

---

## 4. Weather Integration

### 4.1 Supabase Edge Function: `weather-proxy`

**File:** `supabase/functions/weather-proxy/index.ts`

- Accepts: `GET ?lat=58.1414&lon=7.9965`
- Validates lat/lon are present and numeric, max 4 decimal places
- Forwards to: `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=...&lon=...`
- Sets `User-Agent: FireteamScore/1.0 contact@fireteam.no`
- Reads `Expires` header from Met.no response; sets `Cache-Control: public, max-age=<seconds>` on the response
- Returns the raw Met.no JSON to the client
- Returns `{ error: 'unavailable' }` with 200 status on fetch failure (graceful degradation)

### 4.2 Client service: `src/services/weather.ts`

```typescript
export type WeatherData = {
  temperature: number      // °C
  symbolCode: string       // e.g. 'clearsky_day', 'lightrain'
  windSpeed: number        // m/s
  windDirection: number    // degrees (0–360)
  precipitation: number    // mm/hour
  feelsLike?: number       // °C (derived: temp - wind chill factor)
}

export async function getWeather(lat: number, lng: number): Promise<WeatherData | null>
```

Calls the Edge Function. Returns `null` on any error — the UI renders a graceful "Weather unavailable" state.

### 4.3 Weather icons

- Source: `metno/weathericons` GitHub repo (MIT licence)
- Location in project: `src/assets/weather/*.svg`
- Only ship the ~50 most common day/night variants (not all 200+)
- Usage: `import clearIcon from '../assets/weather/clearsky_day.svg'` — or a dynamic import map keyed on `symbolCode`
- Service worker caches all icons on install — works fully offline

### 4.4 Wind alert

Show an orange contextual banner on the course detail page when `windSpeed >= 8` (m/s). Text: "Windy conditions — disc selection matters today." Dismissible per session (not persisted).

### 4.5 Attribution

Display "Weather: MET Norway" as a small link at the bottom of the weather widget. Required by CC BY 4.0.

---

## 5. Client-Side Search

### 5.1 Hook: `useOfficialCourses()`

**File:** `src/hooks/useOfficialCourses.ts`

```typescript
type UseOfficialCoursesResult = {
  courses: Course[]
  loading: boolean
  search: (query: string) => Course[]
}
```

Behaviour:
1. On mount, check IndexedDB (`idb-keyval` key: `'official-courses'`) for a cached payload with a `cachedAt` timestamp
2. If cache is younger than 24 hours, use it immediately (no network call)
3. Otherwise call `getOfficialCourses()` (see §5.2)
4. Store result in IndexedDB with `cachedAt = Date.now()`
5. `search(query)` filters in memory: match courses where `name` or `location` starts with or contains the query (case-insensitive, Norwegian character-aware)

### 5.2 Service function: `getOfficialCourses()`

**File:** `src/services/courses.ts` (new export)

```typescript
export async function getOfficialCourses(): Promise<Course[]>
```

Fetches all courses where `source = 'official'`, joining `course_holes` for pars. No `userId` required — official courses are public.

---

## 6. Screens

### 6.1 `StartRoundScreen` (modified)

Becomes a type-picker. Two tiles:

- **Official Courses** tile — forest green, topo background, dominant. Routes to `officialCourses`.
- **My Courses** tile — paper background, secondary. Routes to existing personal course list (inlined as a sub-view or extracted to `myCoursePicker`).

The existing course list UI is preserved unchanged for the My Courses path. The heading changes from "Pick your course." to contextual headings per sub-screen.

### 6.2 `OfficialCoursesScreen` (new)

**File:** `src/screens/OfficialCoursesScreen.jsx`

- Search bar — filters `useOfficialCourses().search(query)` on every keystroke (no debounce needed, client-side)
- Results list — same course card style as StartRoundScreen, with orange "Official" chip
- Tapping a card selects it (radio circle); a "View details →" link appears below the selected card
- "View details →" navigates to `courseDetail` with the selected course ID
- CTA "Start Round →" is active when a course is selected — does not require viewing the detail page first
- If search returns no results: "No official courses match — Missing one? Submit it →" with a link to `submitCourse`

### 6.3 `CourseDetailScreen` (new)

**File:** `src/screens/CourseDetailScreen.jsx`

Props: `courseId` (from navigation params), `onChoose` callback (or navigates to `start` directly).

Layout (scrollable):
1. **Map** — MapLibre GL JS, Kartverket topo tiles, single location pin at `course.lat / course.lng`. Fixed height 140px. "© Kartverket" attribution bottom-right.
2. **Course title + location** — name (600 weight, 20px), location string (dim colour)
3. **Stats row** — two chips: Holes count, Total par
4. **Weather widget** — forest-green card. Left: Met.no icon + temperature + condition label. Divider. Right: wind speed + direction, precipitation, feels-like. Below widget: wind alert banner (conditional, ≥ 8 m/s).
5. **Hole list** — section label "HOLES", one row per hole: hole number badge, "Hole N" label, par chip (colour-coded: Par 3 = green tint, Par 4 = orange tint, Par 5 = neutral).
6. **CTA area** — "Choose this course →" button (forest green). Tapping navigates back to `StartRoundScreen` with `courseId` pre-selected — the user still selects players before starting the round. Below the button: "Official · Read-only · maintained by Fireteam" in dim text.

If `course.lat` / `course.lng` are null: map section is hidden, a "Location not available" placeholder is shown instead.

If weather fetch fails: widget shows "Weather unavailable" in dim text — no spinner, no retry, rest of page is unaffected.

### 6.4 `CoursesScreen` → Course Library (modified)

**File:** `src/screens/CoursesScreen.jsx` — rename exports, update title.

Screen title: "Course Library." (heading), `COURSE LIBRARY` (mono label).

**Filter chips** — three pill chips at the top: `Recent`, `Official`, `My Courses`. One active at a time. Active chip: forest-green background, cream text. Inactive: light border, dim text.

**Search bar** — below chips, always visible. Placeholder text changes per active chip: "Search recent…" / "Search official courses…" / "Search my courses…".

**List content** per chip:
- **Recent** — derives course list from `useRounds()`: take last N unique `course_id` values (max 10), look up each in `useOfficialCourses` + `useCourses` caches. Shows recency label ("2d ago"). Tapping opens `courseDetail` (for official) or existing edit view (for personal). Empty state: "No rounds yet — start a round to see recent courses here."
- **Official** — same search + card list as `OfficialCoursesScreen`. Action button is "→" (view detail, read-only). At the bottom: "Missing a course? Submit it →".
- **My Courses** — existing personal courses list, unchanged. Action button is "✎" (edit). "Create new course" dashed button at bottom.

Home screen quick-nav tile label changes from "Courses" to "Course Library".

### 6.5 `CourseSubmissionScreen` (new)

**File:** `src/screens/CourseSubmissionScreen.jsx`

Minimal form, reuses existing `NewCourseScreen` layout patterns:
- Course name (text input, required)
- Location / city (text input, optional)
- Number of holes (same segmented control as NewCourseScreen: 9 / 12 / 18 / 24 / custom)
- Par per hole (same stepper grid as NewCourseScreen)
- Notes (textarea, optional) — "Source, link, or anything helpful for review"
- Submit button → inserts into `course_submissions`
- On success: toast "Submitted! We'll review it shortly." + navigate back

### 6.6 `AdminScreen` (new)

**File:** `src/screens/AdminScreen.jsx`

Only accessible when `profile.is_admin === true`. Navigation entry: a small "Admin" row in `AccountScreen`, hidden unless `is_admin`.

Lists pending `course_submissions` ordered by `created_at`. Each row shows:
- Course name, location, holes, total par (computed from pars array)
- Submitted by (username), submitted date
- Expand to see full pars array and notes
- **Approve** button (forest green) — promotes submission to official course:
  1. Inserts row into `courses` (`source = 'official'`, `created_by = null`, `is_public = true`)
  2. Inserts rows into `course_holes`
  3. Updates `course_submissions.status = 'approved'`, `reviewed_by = auth.uid()`
  4. Invalidates the `official-courses` IndexedDB cache so all clients re-fetch
- **Reject** button (muted) — sets `status = 'rejected'`, `reviewed_by = auth.uid()`

Empty state: "No pending submissions."

---

## 7. Navigation

New routes added to `App.jsx`:

| Key | Screen | Params |
|---|---|---|
| `officialCourses` | `OfficialCoursesScreen` | — |
| `courseDetail` | `CourseDetailScreen` | `courseId: string` |
| `submitCourse` | `CourseSubmissionScreen` | — |
| `admin` | `AdminScreen` | — |

Updated routes:
- `courses` now renders the Course Library (chip-based) instead of the old flat list
- Home screen quick-nav tile for "Courses" → "Course Library"

`StartRoundScreen` routing:
- Tapping the "Official Courses" tile: `go('officialCourses')`
- Tapping "Choose this course" in `CourseDetailScreen`: `go('start', { courseId })` — `StartRoundScreen` reads `params.courseId` on mount and pre-selects that course, then the user proceeds to player selection as normal
- Tapping "My Courses" tile: existing personal course sub-view (can remain inline in `StartRoundScreen` or be extracted)

---

## 8. Map Integration

**Packages:**
```bash
npm install react-map-gl maplibre-gl
```

**Tile source:** Kartverket WMTS (raster):
```
https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png
```

**MapLibre style JSON** (inline object, no external style URL needed):
```javascript
const MAP_STYLE = {
  version: 8,
  sources: {
    kartverket: {
      type: 'raster',
      tiles: ['https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png'],
      tileSize: 256,
      attribution: '© Kartverket',
    },
  },
  layers: [{ id: 'kartverket', type: 'raster', source: 'kartverket' }],
}
```

**Component:**
```jsx
import Map, { Marker } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

<Map
  mapStyle={MAP_STYLE}
  initialViewState={{ longitude: course.lng, latitude: course.lat, zoom: 14 }}
  style={{ width: '100%', height: 140 }}
  interactive={false}
>
  <Marker longitude={course.lng} latitude={course.lat}>
    {/* custom orange pin SVG */}
  </Marker>
</Map>
```

`interactive={false}` — map is decorative on the detail page, no panning/zooming needed.

**Bundle size:** ~215 KB gzipped. Code-split: map component is lazy-loaded only when `CourseDetailScreen` is rendered. First load pays the cost; PWA service worker caches it permanently.

---

## 9. Testing Priorities

1. **Search correctness** — `useOfficialCourses().search()` correctly matches Norwegian names including `ø`, `æ`, `å`. Test: `search('Fø')` returns all courses with "Fø" in name. Test: `search('bo')` matches "Bølgane" (case-insensitive, diacritic-tolerant).
2. **Seed script validation** — script rejects entries with wrong `pars.length`, par out of 2–7 range, missing required fields.
3. **RLS enforcement** — a regular user cannot insert/update/delete a course where `source = 'official'`. A user can only insert `source = 'user'` courses.
4. **Course submissions RLS** — a user can only read their own submissions; an admin can read all.
5. **Weather graceful degradation** — `getWeather()` returns `null` on network failure; `CourseDetailScreen` renders without the widget rather than crashing.
6. **IndexedDB cache** — `useOfficialCourses` serves from cache when younger than 24h; re-fetches when stale.
7. **Admin approval flow** — approving a submission creates correct `courses` + `course_holes` rows and invalidates the cache.

---

## 10. Known Constraints & Future Work

- **Per-hole coordinates** (hole pin map): deferred. Requires manual data entry or a future import pipeline. Currently: single course-location pin.
- **PDGA developer program re-opening** (targeted 2026): when available, can be used for real-time course lookups (display only — their ToS forbids central storage). Complement to the existing curated dataset, not a replacement.
- **OSM bulk import**: technically possible under ODbL. Useful for locations/coordinates when curating courses manually. Many OSM entries lack par data — would still require manual completion before seeding.
- **MapLibre bundle size**: ~215 KB gzipped. Code-split on `CourseDetailScreen` mount. Acceptable for a PWA where the cost is paid once and cached.
- **Met.no proxy caching**: the Edge Function respects the `Expires` header from Met.no (~1 hour TTL). For very high traffic, add a KV store (Supabase KV or Deno KV) to cache per lat/lon key server-side.
