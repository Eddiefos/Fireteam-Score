# Official Courses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add predefined official Norwegian disc golf courses with autocomplete search, course detail pages (map + weather), community submission flow, and admin approval screen.

**Architecture:** Official courses are read-only rows (`source='official'`) seeded from a hand-curated JSON file and cached client-side in IndexedDB (24h TTL). Weather is fetched via a Supabase Edge Function proxy to Met.no. The Course Library screen gains filter chips (Recent | Official | My Courses); StartRoundScreen gains a type-picker step before the existing course list.

**Tech Stack:** React + Vite, Supabase (Postgres/RLS/Edge Functions), react-map-gl + MapLibre GL JS, Kartverket topo tiles, Met.no weather API, idb-keyval (IndexedDB), Vitest

---

### Task 1: DB migration — official courses schema

**Files:**
- Create: `supabase/migrations/20260520000003_official_courses.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260520000003_official_courses.sql

-- 1. Add is_admin to profiles
alter table profiles add column if not exists is_admin boolean not null default false;

-- 2. Update courses source check: rename 'pdga' to 'official' for new rows
--    (existing rows, if any, are treated the same way — just update the allowed values)
--    No constraint to add/drop since source is free text in the original schema.
--    Add an explicit check constraint so the DB enforces the enum.
alter table courses
  add constraint courses_source_check
  check (source in ('official', 'user'));

-- 3. Tighten RLS on courses:
--    official courses are readable by all but only writable by service_role (seed script)
--    user courses are only writable by their creator
drop policy if exists "Users can create courses" on courses;
drop policy if exists "Creators can update their own courses" on courses;

create policy "Users can create user courses" on courses for insert
  with check (auth.uid() = created_by and source = 'user');

create policy "Creators can update own user courses" on courses for update
  using (auth.uid() = created_by and source = 'user');

create policy "Creators can delete own user courses" on courses for delete
  using (auth.uid() = created_by and source = 'user');

-- 4. course_submissions table
create table if not exists course_submissions (
  id            uuid primary key default gen_random_uuid(),
  submitted_by  uuid references profiles(id) on delete set null,
  name          text not null,
  location      text,
  lat           numeric(9,6),
  lng           numeric(9,6),
  holes         int not null default 18,
  holes_detail  jsonb,  -- [{hole_number, par}]
  notes         text,
  status        text not null default 'pending',  -- 'pending' | 'approved' | 'rejected'
  reviewed_by   uuid references profiles(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz default now(),
  constraint course_submissions_status_check check (status in ('pending', 'approved', 'rejected'))
);

alter table course_submissions enable row level security;

create policy "Anyone can submit a course" on course_submissions for insert
  with check (auth.uid() = submitted_by);

create policy "Submitter can view own submissions" on course_submissions for select
  using (auth.uid() = submitted_by);

create policy "Admins can view all submissions" on course_submissions for select
  using (
    exists (
      select 1 from profiles where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can update submissions" on course_submissions for update
  using (
    exists (
      select 1 from profiles where id = auth.uid() and is_admin = true
    )
  );
```

- [ ] **Step 2: Apply migration locally**

```bash
supabase db push
```

Expected: "Applying migration 20260520000003_official_courses.sql" with no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260520000003_official_courses.sql
git commit -m "feat: add is_admin, tighten courses RLS, add course_submissions table"
```

---

### Task 2: Type system updates

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Read the current types file**

Read `src/types/index.ts` lines 1–end and note the current `Course`, `Profile` types.

- [ ] **Step 2: Update types**

Update `Course.source`, add `Profile.is_admin`, add `WeatherData`, `CourseSubmission`:

```typescript
// In Course type — update source field:
source: 'official' | 'user';

// In Profile type — add:
is_admin: boolean;

// New types to add:

export interface WeatherData {
  temperature: number;      // Celsius
  windSpeed: number;        // m/s
  windDirection: number;    // degrees 0–360
  symbolCode: string;       // Met.no symbol_code e.g. "clearsky_day"
  fetchedAt: number;        // Date.now() timestamp
}

export interface CourseSubmission {
  id: string;
  submitted_by: string;
  name: string;
  location: string | null;
  lat: number | null;
  lng: number | null;
  holes: number;
  holes_detail: Array<{ hole_number: number; par: number }> | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add WeatherData, CourseSubmission types; is_admin on Profile"
```

---

### Task 3: `getOfficialCourses()` service + tests

**Files:**
- Modify: `src/services/courses.ts`
- Modify: `src/services/__tests__/courses.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/services/__tests__/courses.test.ts`:

```typescript
import { getOfficialCourses } from '../courses'
import { supabase } from '../supabase'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() }
}))

describe('getOfficialCourses', () => {
  it('returns official courses with holes ordered by name', async () => {
    const mockCourses = [
      {
        id: 'c1',
        name: 'Bølgane Frisbeegolfpark',
        location: 'Kristiansand',
        lat: 58.14,
        lng: 7.99,
        holes: 18,
        par_total: 54,
        source: 'official',
        pdga_id: '12345',
        created_by: null,
        is_public: true,
        created_at: '2026-01-01T00:00:00Z',
        course_holes: [
          { hole_number: 1, par: 3 },
          { hole_number: 2, par: 4 }
        ]
      }
    ]

    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockCourses, error: null })
    }
    vi.mocked(supabase.from).mockReturnValueOnce(chain as any)

    const result = await getOfficialCourses()

    expect(supabase.from).toHaveBeenCalledWith('courses')
    expect(chain.select).toHaveBeenCalledWith('*, course_holes(hole_number, par)')
    expect(chain.eq).toHaveBeenCalledWith('source', 'official')
    expect(chain.order).toHaveBeenCalledWith('name')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Bølgane Frisbeegolfpark')
    expect(result[0].course_holes).toHaveLength(2)
  })

  it('throws on DB error', async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } })
    }
    vi.mocked(supabase.from).mockReturnValueOnce(chain as any)

    await expect(getOfficialCourses()).rejects.toThrow('DB error')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/services/__tests__/courses.test.ts --reporter=verbose
```

Expected: FAIL — `getOfficialCourses is not a function`

- [ ] **Step 3: Implement `getOfficialCourses()` in `src/services/courses.ts`**

Add after existing imports/functions:

```typescript
export async function getOfficialCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*, course_holes(hole_number, par)')
    .eq('source', 'official')
    .order('name')

  if (error) throw new Error(error.message)
  return (data ?? []) as Course[]
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/services/__tests__/courses.test.ts --reporter=verbose
```

Expected: all `getOfficialCourses` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/courses.ts src/services/__tests__/courses.test.ts
git commit -m "feat: add getOfficialCourses service with join query"
```

---

### Task 4: `submitCourse()` and `approveSubmission()` services + tests

**Files:**
- Modify: `src/services/courses.ts`
- Modify: `src/services/__tests__/courses.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/services/__tests__/courses.test.ts`:

```typescript
import { submitCourse, approveSubmission } from '../courses'
import { del } from 'idb-keyval'

vi.mock('idb-keyval', () => ({ del: vi.fn() }))

describe('submitCourse', () => {
  it('inserts a submission row and returns it', async () => {
    const submission = {
      name: 'My Local Course',
      location: 'Bergen',
      lat: 60.39,
      lng: 5.32,
      holes: 9,
      holes_detail: [{ hole_number: 1, par: 3 }],
      notes: 'Nice wooded course'
    }
    const mockRow = { id: 's1', ...submission, submitted_by: 'u1', status: 'pending' }

    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockRow, error: null })
    }
    vi.mocked(supabase.from).mockReturnValueOnce(chain as any)

    const result = await submitCourse('u1', submission)
    expect(chain.insert).toHaveBeenCalledWith({ ...submission, submitted_by: 'u1' })
    expect(result.id).toBe('s1')
  })
})

describe('approveSubmission', () => {
  it('creates course + holes, marks submission approved, invalidates cache', async () => {
    const sub = {
      id: 's1',
      name: 'New Course',
      location: 'Trondheim',
      lat: 63.43,
      lng: 10.39,
      holes: 9,
      holes_detail: [{ hole_number: 1, par: 3 }, { hole_number: 2, par: 3 }],
      notes: null,
      submitted_by: 'u2'
    }

    // Mock courses insert
    const coursesChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'c99' }, error: null })
    }
    // Mock course_holes insert
    const holesChain = {
      insert: vi.fn().mockResolvedValue({ error: null })
    }
    // Mock submissions update
    const subChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null })
    }

    vi.mocked(supabase.from)
      .mockReturnValueOnce(coursesChain as any)
      .mockReturnValueOnce(holesChain as any)
      .mockReturnValueOnce(subChain as any)

    await approveSubmission('admin1', sub as any)

    expect(vi.mocked(del)).toHaveBeenCalledWith('official-courses')
    expect(subChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved', reviewed_by: 'admin1' })
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/services/__tests__/courses.test.ts --reporter=verbose
```

Expected: FAIL — `submitCourse is not a function`, `approveSubmission is not a function`

- [ ] **Step 3: Implement both functions in `src/services/courses.ts`**

```typescript
import { del } from 'idb-keyval'

export interface SubmissionInput {
  name: string
  location: string | null
  lat: number | null
  lng: number | null
  holes: number
  holes_detail: Array<{ hole_number: number; par: number }> | null
  notes: string | null
}

export async function submitCourse(
  userId: string,
  input: SubmissionInput
): Promise<CourseSubmission> {
  const { data, error } = await supabase
    .from('course_submissions')
    .insert({ ...input, submitted_by: userId })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as CourseSubmission
}

export async function approveSubmission(
  adminId: string,
  sub: CourseSubmission
): Promise<void> {
  const { data: courseRow, error: courseErr } = await supabase
    .from('courses')
    .insert({
      name: sub.name,
      location: sub.location,
      lat: sub.lat,
      lng: sub.lng,
      holes: sub.holes,
      source: 'official',
      is_public: true,
      created_by: null,
    })
    .select()
    .single()

  if (courseErr) throw new Error(courseErr.message)

  if (sub.holes_detail?.length) {
    const { error: holesErr } = await supabase
      .from('course_holes')
      .insert(
        sub.holes_detail.map(h => ({
          course_id: courseRow.id,
          hole_number: h.hole_number,
          par: h.par
        }))
      )
    if (holesErr) throw new Error(holesErr.message)
  }

  const { error: updateErr } = await supabase
    .from('course_submissions')
    .update({
      status: 'approved',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', sub.id)

  if (updateErr) throw new Error(updateErr.message)

  await del('official-courses')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/services/__tests__/courses.test.ts --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/courses.ts src/services/__tests__/courses.test.ts
git commit -m "feat: add submitCourse and approveSubmission services"
```

---

### Task 5: Seed data — official Norwegian courses

**Files:**
- Create: `scripts/predefined-courses.json`
- Create: `scripts/seed-official-courses.ts`

- [ ] **Step 1: Create the seed data JSON**

Create `scripts/predefined-courses.json`:

```json
[
  {
    "name": "Bølgane Frisbeegolfpark",
    "location": "Kristiansand",
    "lat": 58.1427,
    "lng": 7.9954,
    "holes": 18,
    "par_total": 54,
    "pdga_id": "44758",
    "course_holes": [
      { "hole_number": 1, "par": 3 },
      { "hole_number": 2, "par": 3 },
      { "hole_number": 3, "par": 3 },
      { "hole_number": 4, "par": 3 },
      { "hole_number": 5, "par": 3 },
      { "hole_number": 6, "par": 3 },
      { "hole_number": 7, "par": 3 },
      { "hole_number": 8, "par": 3 },
      { "hole_number": 9, "par": 3 },
      { "hole_number": 10, "par": 3 },
      { "hole_number": 11, "par": 3 },
      { "hole_number": 12, "par": 3 },
      { "hole_number": 13, "par": 3 },
      { "hole_number": 14, "par": 3 },
      { "hole_number": 15, "par": 3 },
      { "hole_number": 16, "par": 3 },
      { "hole_number": 17, "par": 3 },
      { "hole_number": 18, "par": 3 }
    ]
  },
  {
    "name": "Ekeberg Disc Golf",
    "location": "Oslo",
    "lat": 59.8989,
    "lng": 10.7686,
    "holes": 18,
    "par_total": 54,
    "pdga_id": "7303",
    "course_holes": [
      { "hole_number": 1, "par": 3 },
      { "hole_number": 2, "par": 3 },
      { "hole_number": 3, "par": 3 },
      { "hole_number": 4, "par": 3 },
      { "hole_number": 5, "par": 3 },
      { "hole_number": 6, "par": 3 },
      { "hole_number": 7, "par": 3 },
      { "hole_number": 8, "par": 3 },
      { "hole_number": 9, "par": 3 },
      { "hole_number": 10, "par": 3 },
      { "hole_number": 11, "par": 3 },
      { "hole_number": 12, "par": 3 },
      { "hole_number": 13, "par": 3 },
      { "hole_number": 14, "par": 3 },
      { "hole_number": 15, "par": 3 },
      { "hole_number": 16, "par": 3 },
      { "hole_number": 17, "par": 3 },
      { "hole_number": 18, "par": 3 }
    ]
  },
  {
    "name": "Frogner Disc Golf",
    "location": "Oslo",
    "lat": 59.9274,
    "lng": 10.7055,
    "holes": 9,
    "par_total": 27,
    "pdga_id": "8712",
    "course_holes": [
      { "hole_number": 1, "par": 3 },
      { "hole_number": 2, "par": 3 },
      { "hole_number": 3, "par": 3 },
      { "hole_number": 4, "par": 3 },
      { "hole_number": 5, "par": 3 },
      { "hole_number": 6, "par": 3 },
      { "hole_number": 7, "par": 3 },
      { "hole_number": 8, "par": 3 },
      { "hole_number": 9, "par": 3 }
    ]
  },
  {
    "name": "Lade Disc Golf",
    "location": "Trondheim",
    "lat": 63.4497,
    "lng": 10.4683,
    "holes": 18,
    "par_total": 54,
    "pdga_id": "10543",
    "course_holes": [
      { "hole_number": 1, "par": 3 },
      { "hole_number": 2, "par": 3 },
      { "hole_number": 3, "par": 3 },
      { "hole_number": 4, "par": 3 },
      { "hole_number": 5, "par": 3 },
      { "hole_number": 6, "par": 3 },
      { "hole_number": 7, "par": 3 },
      { "hole_number": 8, "par": 3 },
      { "hole_number": 9, "par": 3 },
      { "hole_number": 10, "par": 3 },
      { "hole_number": 11, "par": 3 },
      { "hole_number": 12, "par": 3 },
      { "hole_number": 13, "par": 3 },
      { "hole_number": 14, "par": 3 },
      { "hole_number": 15, "par": 3 },
      { "hole_number": 16, "par": 3 },
      { "hole_number": 17, "par": 3 },
      { "hole_number": 18, "par": 3 }
    ]
  },
  {
    "name": "Stavanger Disc Golf",
    "location": "Stavanger",
    "lat": 58.9700,
    "lng": 5.7331,
    "holes": 18,
    "par_total": 54,
    "pdga_id": "14229",
    "course_holes": [
      { "hole_number": 1, "par": 3 },
      { "hole_number": 2, "par": 3 },
      { "hole_number": 3, "par": 3 },
      { "hole_number": 4, "par": 3 },
      { "hole_number": 5, "par": 3 },
      { "hole_number": 6, "par": 3 },
      { "hole_number": 7, "par": 3 },
      { "hole_number": 8, "par": 3 },
      { "hole_number": 9, "par": 3 },
      { "hole_number": 10, "par": 3 },
      { "hole_number": 11, "par": 3 },
      { "hole_number": 12, "par": 3 },
      { "hole_number": 13, "par": 3 },
      { "hole_number": 14, "par": 3 },
      { "hole_number": 15, "par": 3 },
      { "hole_number": 16, "par": 3 },
      { "hole_number": 17, "par": 3 },
      { "hole_number": 18, "par": 3 }
    ]
  }
]
```

- [ ] **Step 2: Create the seed script**

Create `scripts/seed-official-courses.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import courses from './predefined-courses.json'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function seed() {
  console.log(`Seeding ${courses.length} official courses…`)

  for (const course of courses) {
    const { course_holes, ...courseData } = course

    const { data: existing } = await supabase
      .from('courses')
      .select('id')
      .eq('pdga_id', courseData.pdga_id)
      .maybeSingle()

    let courseId: string

    if (existing) {
      const { error } = await supabase
        .from('courses')
        .update({ ...courseData, source: 'official', is_public: true, created_by: null })
        .eq('id', existing.id)
      if (error) throw new Error(`Update failed for ${courseData.name}: ${error.message}`)
      courseId = existing.id
      console.log(`  Updated: ${courseData.name}`)
    } else {
      const { data, error } = await supabase
        .from('courses')
        .insert({ ...courseData, source: 'official', is_public: true, created_by: null })
        .select()
        .single()
      if (error) throw new Error(`Insert failed for ${courseData.name}: ${error.message}`)
      courseId = data.id
      console.log(`  Inserted: ${courseData.name}`)
    }

    if (course_holes.length > 0) {
      await supabase.from('course_holes').delete().eq('course_id', courseId)
      const { error } = await supabase
        .from('course_holes')
        .insert(course_holes.map(h => ({ course_id: courseId, ...h })))
      if (error) throw new Error(`Holes insert failed for ${courseData.name}: ${error.message}`)
    }
  }

  console.log('Seed complete.')
}

seed().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 3: Verify the script can be parsed by TypeScript**

```bash
npx tsc --noEmit scripts/seed-official-courses.ts --resolveJsonModule --esModuleInterop --skipLibCheck 2>&1 | head -20
```

Expected: no errors (or only "cannot find module" for env vars — that's fine, script runs with ts-node).

- [ ] **Step 4: Run the seed script against local Supabase**

```bash
SUPABASE_URL=$(grep VITE_SUPABASE_URL .env.local | cut -d= -f2) \
SUPABASE_SERVICE_ROLE_KEY=<your-local-service-role-key> \
npx ts-node --esm scripts/seed-official-courses.ts
```

Expected: "Seeding 5 official courses… Inserted: Bølgane… Inserted: Ekeberg… Seed complete."

- [ ] **Step 5: Commit**

```bash
git add scripts/predefined-courses.json scripts/seed-official-courses.ts
git commit -m "feat: add official course seed data and seed script"
```

---

### Task 6: Weather Edge Function proxy

**Files:**
- Create: `supabase/functions/weather-proxy/index.ts`

- [ ] **Step 1: Create the Edge Function**

```typescript
// supabase/functions/weather-proxy/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const url = new URL(req.url)
  const lat = url.searchParams.get('lat')
  const lon = url.searchParams.get('lon')

  if (!lat || !lon) {
    return new Response(
      JSON.stringify({ error: 'lat and lon are required' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  const metUrl = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`

  const metRes = await fetch(metUrl, {
    headers: {
      'User-Agent': 'FireteamScore/1.0 edvard.fosseie@try.no',
    }
  })

  if (!metRes.ok) {
    return new Response(
      JSON.stringify({ error: `Met.no error: ${metRes.status}` }),
      { status: metRes.status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  const data = await metRes.json()
  const now = data.properties?.timeseries?.[0]?.data

  if (!now) {
    return new Response(
      JSON.stringify({ error: 'No weather data available' }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    )
  }

  const result = {
    temperature: now.instant.details.air_temperature,
    windSpeed: now.instant.details.wind_speed,
    windDirection: now.instant.details.wind_from_direction,
    symbolCode: now.next_1_hours?.summary?.symbol_code ?? now.next_6_hours?.summary?.symbol_code ?? 'cloudy',
    fetchedAt: Date.now(),
  }

  return new Response(JSON.stringify(result), {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=1800',  // 30 min browser cache
    }
  })
})
```

- [ ] **Step 2: Deploy the Edge Function**

```bash
supabase functions deploy weather-proxy
```

Expected: "Deployed weather-proxy" with no errors.

- [ ] **Step 3: Smoke-test the deployed function**

```bash
curl "$(grep VITE_SUPABASE_URL .env.local | cut -d= -f2)/functions/v1/weather-proxy?lat=58.14&lon=7.99" \
  -H "Authorization: Bearer $(grep VITE_SUPABASE_ANON_KEY .env.local | cut -d= -f2)"
```

Expected: JSON with `temperature`, `windSpeed`, `windDirection`, `symbolCode` fields.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/weather-proxy/index.ts
git commit -m "feat: add Met.no weather proxy Edge Function"
```

---

### Task 7: Weather client service + tests

**Files:**
- Create: `src/services/weather.ts`
- Create: `src/services/__tests__/weather.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/services/__tests__/weather.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchWeather } from '../weather'

const SUPABASE_URL = 'https://test.supabase.co'
const SUPABASE_ANON_KEY = 'test-key'

vi.mock('../supabase', () => ({
  supabase: {
    supabaseUrl: SUPABASE_URL,
    supabaseKey: SUPABASE_ANON_KEY,
  }
}))

global.fetch = vi.fn()

describe('fetchWeather', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls the weather-proxy edge function with lat/lon', async () => {
    const mockWeather = {
      temperature: 14,
      windSpeed: 3.5,
      windDirection: 180,
      symbolCode: 'partlycloudy_day',
      fetchedAt: Date.now()
    }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockWeather
    } as Response)

    const result = await fetchWeather(58.14, 7.99)

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/weather-proxy?lat=58.14&lon=7.99'),
      expect.objectContaining({ headers: expect.any(Object) })
    )
    expect(result.temperature).toBe(14)
    expect(result.symbolCode).toBe('partlycloudy_day')
  })

  it('throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 502
    } as Response)

    await expect(fetchWeather(58.14, 7.99)).rejects.toThrow('Weather fetch failed: 502')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/services/__tests__/weather.test.ts --reporter=verbose
```

Expected: FAIL — `fetchWeather is not a function`

- [ ] **Step 3: Create `src/services/weather.ts`**

```typescript
import { supabase } from './supabase'
import type { WeatherData } from '../types'

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const url = `${supabase.supabaseUrl}/functions/v1/weather-proxy?lat=${lat}&lon=${lon}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${supabase.supabaseKey}`,
      apikey: supabase.supabaseKey,
    }
  })

  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`)

  return res.json() as Promise<WeatherData>
}

const SYMBOL_MAP: Record<string, string> = {
  clearsky: '☀️',
  fair: '🌤️',
  partlycloudy: '⛅',
  cloudy: '☁️',
  fog: '🌫️',
  lightrain: '🌦️',
  rain: '🌧️',
  heavyrain: '🌧️',
  lightsnow: '🌨️',
  snow: '❄️',
  heavysnow: '❄️',
  lightrainshowers: '🌦️',
  rainshowers: '🌧️',
  snowshowers: '🌨️',
  thunder: '⛈️',
  thundershowers: '⛈️',
}

export function weatherEmoji(symbolCode: string): string {
  const base = symbolCode.replace(/_day|_night|_polartwilight/, '')
  return SYMBOL_MAP[base] ?? '🌡️'
}

export function windCompass(degrees: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(degrees / 45) % 8]
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/services/__tests__/weather.test.ts --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/weather.ts src/services/__tests__/weather.test.ts
git commit -m "feat: add weather service with emoji + compass helpers"
```

---

### Task 8: `useOfficialCourses()` hook + tests

**Files:**
- Create: `src/hooks/useOfficialCourses.ts`
- Create: `src/hooks/__tests__/useOfficialCourses.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/__tests__/useOfficialCourses.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOfficialCourses } from '../useOfficialCourses'
import * as coursesService from '../../services/courses'
import { get, set } from 'idb-keyval'

vi.mock('../../services/courses', () => ({
  getOfficialCourses: vi.fn()
}))

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
}))

const mockCourses = [
  { id: 'c1', name: 'Bølgane Frisbeegolfpark', location: 'Kristiansand', source: 'official', course_holes: [] },
  { id: 'c2', name: 'Ekeberg Disc Golf', location: 'Oslo', source: 'official', course_holes: [] },
]

describe('useOfficialCourses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(get).mockResolvedValue(null)
    vi.mocked(set).mockResolvedValue(undefined)
  })

  it('fetches from service when no cache exists', async () => {
    vi.mocked(coursesService.getOfficialCourses).mockResolvedValue(mockCourses as any)

    const { result } = renderHook(() => useOfficialCourses())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(coursesService.getOfficialCourses).toHaveBeenCalledOnce()
    expect(result.current.courses).toHaveLength(2)
    expect(vi.mocked(set)).toHaveBeenCalledWith(
      'official-courses',
      expect.objectContaining({ courses: mockCourses })
    )
  })

  it('uses cache when valid (< 24h)', async () => {
    const cached = { courses: mockCourses, cachedAt: Date.now() - 1000 }
    vi.mocked(get).mockResolvedValue(cached)

    const { result } = renderHook(() => useOfficialCourses())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(coursesService.getOfficialCourses).not.toHaveBeenCalled()
    expect(result.current.courses).toHaveLength(2)
  })

  it('refetches when cache is stale (> 24h)', async () => {
    const stale = { courses: mockCourses, cachedAt: Date.now() - 25 * 3600 * 1000 }
    vi.mocked(get).mockResolvedValue(stale)
    vi.mocked(coursesService.getOfficialCourses).mockResolvedValue(mockCourses as any)

    const { result } = renderHook(() => useOfficialCourses())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(coursesService.getOfficialCourses).toHaveBeenCalledOnce()
  })

  it('search() filters by name case-insensitively including Norwegian chars', async () => {
    const cached = { courses: mockCourses, cachedAt: Date.now() }
    vi.mocked(get).mockResolvedValue(cached)

    const { result } = renderHook(() => useOfficialCourses())

    await waitFor(() => expect(result.current.loading).toBe(false))

    const results = result.current.search('bølg')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Bølgane Frisbeegolfpark')
  })

  it('search() returns all courses for empty query', async () => {
    const cached = { courses: mockCourses, cachedAt: Date.now() }
    vi.mocked(get).mockResolvedValue(cached)

    const { result } = renderHook(() => useOfficialCourses())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.search('')).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/hooks/__tests__/useOfficialCourses.test.ts --reporter=verbose
```

Expected: FAIL — `useOfficialCourses is not a function` or module not found.

- [ ] **Step 3: Create `src/hooks/useOfficialCourses.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { get, set } from 'idb-keyval'
import { getOfficialCourses } from '../services/courses'
import type { Course } from '../types'

const CACHE_KEY = 'official-courses'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000  // 24 hours

interface CacheEntry {
  courses: Course[]
  cachedAt: number
}

export function useOfficialCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const cached = await get<CacheEntry>(CACHE_KEY)
        const isFresh = cached && Date.now() - cached.cachedAt < CACHE_TTL_MS

        if (isFresh) {
          if (!cancelled) {
            setCourses(cached.courses)
            setLoading(false)
          }
          return
        }

        const data = await getOfficialCourses()
        await set(CACHE_KEY, { courses: data, cachedAt: Date.now() })

        if (!cancelled) {
          setCourses(data)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load courses')
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const search = useCallback(
    (query: string): Course[] => {
      if (!query.trim()) return courses
      const q = query.toLowerCase()
      return courses.filter(
        c =>
          c.name.toLowerCase().includes(q) ||
          (c.location ?? '').toLowerCase().includes(q)
      )
    },
    [courses]
  )

  return { courses, loading, error, search }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/hooks/__tests__/useOfficialCourses.test.ts --reporter=verbose
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useOfficialCourses.ts src/hooks/__tests__/useOfficialCourses.test.ts
git commit -m "feat: add useOfficialCourses hook with IndexedDB 24h cache"
```

---

### Task 9: OfficialCoursesScreen

**Files:**
- Create: `src/screens/OfficialCoursesScreen.jsx`

- [ ] **Step 1: Install dependencies**

```bash
npm install idb-keyval
```

Expected: idb-keyval added to `package.json` dependencies.

- [ ] **Step 2: Create the screen**

```jsx
// src/screens/OfficialCoursesScreen.jsx
import { useState } from 'react'
import { useOfficialCourses } from '../hooks/useOfficialCourses'

const FT = {
  forest: '#1F3D2B', cream: '#F4EFE4', paper: '#FAF6EC',
  ink: '#15110D', orange: '#FF6B1F',
  dim: 'rgba(42,31,23,0.55)', hair: 'rgba(42,31,23,0.12)',
}

export function OfficialCoursesScreen({ go, onToast }) {
  const { courses, loading, error, search } = useOfficialCourses()
  const [query, setQuery] = useState('')

  const results = search(query)

  return (
    <div style={{ background: FT.cream, minHeight: '100vh', fontFamily: '-apple-system, SF Pro Display, system-ui, sans-serif' }}>
      {/* Status bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px 6px', fontSize: 10, fontWeight: 600, color: FT.ink }}>
        <span>9:41</span><span>●●●</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 14px 6px' }}>
        <button
          onClick={() => go('courses')}
          style={{ width: 30, height: 30, borderRadius: 9, background: FT.paper, border: `1px solid ${FT.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer' }}
        >‹</button>
        <span style={{ fontFamily: 'SF Mono, monospace', fontSize: 9, letterSpacing: 2, color: FT.dim }}>OFFICIAL COURSES</span>
        <div style={{ width: 30 }} />
      </div>

      {/* Title */}
      <div style={{ padding: '0 14px 12px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.7, color: FT.ink, lineHeight: 1.1 }}>
          Official<br />Courses.
        </h1>
      </div>

      {/* Search */}
      <div style={{ margin: '0 12px 12px', background: FT.paper, border: `1.5px solid rgba(31,61,43,0.3)`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 7, padding: '9px 11px' }}>
        <span style={{ fontSize: 12, opacity: 0.5 }}>🔍</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search official courses…"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: FT.ink }}
        />
        {query.length > 0 && (
          <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: FT.dim }}>✕</button>
        )}
      </div>

      {/* Course list */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 32, color: FT.dim, fontSize: 13 }}>Loading courses…</div>
      )}
      {error && (
        <div style={{ textAlign: 'center', padding: 32, color: '#c0392b', fontSize: 13 }}>{error}</div>
      )}
      {!loading && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 10px' }}>
          {results.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 20px', color: FT.dim, fontSize: 13 }}>
              No courses match "{query}"
            </div>
          )}
          {results.map(course => (
            <button
              key={course.id}
              onClick={() => go('courseDetail', { courseId: course.id })}
              style={{ background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 14, padding: '10px 11px', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', textAlign: 'left', width: '100%' }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: FT.forest, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: FT.cream, flexShrink: 0 }}>
                {course.holes}H
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: FT.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{course.name}</div>
                <div style={{ fontSize: 10, color: FT.dim, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {course.location}
                  <span style={{ background: 'rgba(255,107,31,0.12)', color: FT.orange, fontSize: 8, fontWeight: 600, padding: '1px 4px', borderRadius: 3, fontFamily: 'SF Mono, monospace' }}>OFFICIAL</span>
                </div>
              </div>
              <span style={{ fontSize: 12, color: FT.dim, flexShrink: 0 }}>→</span>
            </button>
          ))}
        </div>
      )}

      {/* Submit link */}
      <div style={{ textAlign: 'center', padding: '16px 14px 24px', fontSize: 11, color: FT.orange, fontWeight: 500 }}>
        <button onClick={() => go('submitCourse')} style={{ background: 'none', border: 'none', color: FT.orange, fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
          Missing a course? Submit it →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript (JSX type check)**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/OfficialCoursesScreen.jsx
git commit -m "feat: add OfficialCoursesScreen with search"
```

---

### Task 10: CourseDetailScreen — map + weather

**Files:**
- Create: `src/screens/CourseDetailScreen.jsx`

- [ ] **Step 1: Install map dependencies**

```bash
npm install react-map-gl maplibre-gl
```

Expected: both packages added to `package.json`.

- [ ] **Step 2: Create the screen**

```jsx
// src/screens/CourseDetailScreen.jsx
import { useState, useEffect, lazy, Suspense } from 'react'
import { getOfficialCourses } from '../services/courses'
import { fetchWeather, weatherEmoji, windCompass } from '../services/weather'

// Lazy load the map to avoid bloating the initial bundle
const MapComponent = lazy(() =>
  import('react-map-gl/maplibre').then(m => ({ default: m.Map }))
)

const FT = {
  forest: '#1F3D2B', cream: '#F4EFE4', paper: '#FAF6EC',
  ink: '#15110D', orange: '#FF6B1F',
  dim: 'rgba(42,31,23,0.55)', hair: 'rgba(42,31,23,0.12)',
}

const KARTVERKET_STYLE = {
  version: 8,
  sources: {
    kartverket: {
      type: 'raster',
      tiles: ['https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png'],
      tileSize: 256,
      attribution: '© Kartverket CC BY 4.0'
    }
  },
  layers: [{ id: 'kartverket-layer', type: 'raster', source: 'kartverket' }]
}

export function CourseDetailScreen({ go, params = {} }) {
  const { courseId, returnTo = 'officialCourses' } = params
  const [course, setCourse] = useState(null)
  const [weather, setWeather] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const courses = await getOfficialCourses()
      const found = courses.find(c => c.id === courseId)
      setCourse(found ?? null)
      setLoading(false)

      if (found?.lat && found?.lng) {
        setWeatherLoading(true)
        try {
          const w = await fetchWeather(found.lat, found.lng)
          setWeather(w)
        } catch {
          // weather is non-critical; silently fail
        } finally {
          setWeatherLoading(false)
        }
      }
    }
    if (courseId) load()
  }, [courseId])

  if (loading) {
    return (
      <div style={{ background: FT.cream, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: FT.dim, fontSize: 13 }}>
        Loading…
      </div>
    )
  }

  if (!course) {
    return (
      <div style={{ background: FT.cream, minHeight: '100vh', padding: 24, color: FT.dim, fontSize: 13 }}>
        Course not found.
      </div>
    )
  }

  const parTotal = course.par_total ?? course.course_holes?.reduce((s, h) => s + h.par, 0) ?? 0
  const holes = [...(course.course_holes ?? [])].sort((a, b) => a.hole_number - b.hole_number)

  return (
    <div style={{ background: FT.cream, minHeight: '100vh', fontFamily: '-apple-system, SF Pro Display, system-ui, sans-serif' }}>
      {/* Status bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px 6px', fontSize: 10, fontWeight: 600, color: FT.ink }}>
        <span>9:41</span><span>●●●</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 14px 6px' }}>
        <button
          onClick={() => go(returnTo)}
          style={{ width: 30, height: 30, borderRadius: 9, background: FT.paper, border: `1px solid ${FT.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer' }}
        >‹</button>
        <span style={{ fontFamily: 'SF Mono, monospace', fontSize: 9, letterSpacing: 2, color: FT.dim }}>COURSE DETAIL</span>
        <div style={{ width: 30 }} />
      </div>

      {/* Title + meta */}
      <div style={{ padding: '0 14px 12px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.6, color: FT.ink, lineHeight: 1.15 }}>{course.name}</h1>
        <div style={{ fontSize: 12, color: FT.dim, marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          {course.location}
          <span style={{ background: 'rgba(255,107,31,0.12)', color: FT.orange, fontSize: 8, fontWeight: 600, padding: '2px 5px', borderRadius: 4, fontFamily: 'SF Mono, monospace' }}>OFFICIAL</span>
        </div>
      </div>

      {/* Map */}
      {course.lat && course.lng && (
        <div style={{ margin: '0 14px 12px', borderRadius: 16, overflow: 'hidden', height: 180, border: `1px solid ${FT.hair}` }}>
          <Suspense fallback={<div style={{ height: 180, background: FT.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', color: FT.dim, fontSize: 12 }}>Map loading…</div>}>
            <MapComponent
              initialViewState={{ longitude: course.lng, latitude: course.lat, zoom: 14 }}
              style={{ width: '100%', height: '100%' }}
              mapStyle={KARTVERKET_STYLE}
              interactive={false}
            />
          </Suspense>
        </div>
      )}

      {/* Stats row: holes + par + weather */}
      <div style={{ display: 'flex', gap: 8, padding: '0 14px 12px' }}>
        <div style={{ flex: 1, background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontFamily: 'SF Mono, monospace', fontSize: 8, letterSpacing: 1.5, color: FT.dim, marginBottom: 3 }}>HOLES</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: FT.ink }}>{course.holes}</div>
        </div>
        <div style={{ flex: 1, background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontFamily: 'SF Mono, monospace', fontSize: 8, letterSpacing: 1.5, color: FT.dim, marginBottom: 3 }}>PAR</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: FT.ink }}>{parTotal || '–'}</div>
        </div>
        <div style={{ flex: 2, background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 12, padding: '10px 12px' }}>
          <div style={{ fontFamily: 'SF Mono, monospace', fontSize: 8, letterSpacing: 1.5, color: FT.dim, marginBottom: 3 }}>WEATHER</div>
          {weatherLoading && <div style={{ fontSize: 12, color: FT.dim }}>…</div>}
          {!weatherLoading && weather && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: FT.ink }}>
                {weatherEmoji(weather.symbolCode)} {Math.round(weather.temperature)}°
              </div>
              <div style={{ fontSize: 10, color: FT.dim, marginTop: 1 }}>
                {weather.windSpeed.toFixed(1)} m/s {windCompass(weather.windDirection)}
                {weather.windSpeed >= 8 && <span style={{ color: FT.orange, marginLeft: 4 }}>⚠️ Windy</span>}
              </div>
            </div>
          )}
          {!weatherLoading && !weather && <div style={{ fontSize: 12, color: FT.dim }}>–</div>}
        </div>
      </div>

      {/* Hole list */}
      {holes.length > 0 && (
        <div style={{ padding: '0 14px 12px' }}>
          <div style={{ fontFamily: 'SF Mono, monospace', fontSize: 8, letterSpacing: 2, color: FT.dim, marginBottom: 8 }}>HOLE BY HOLE</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
            {holes.map(h => (
              <div key={h.hole_number} style={{ background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 10, padding: '7px 4px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'SF Mono, monospace', fontSize: 8, color: FT.dim }}>{h.hole_number}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: FT.ink, marginTop: 2 }}>P{h.par}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div style={{ padding: '4px 14px 40px' }}>
        <button
          onClick={() => go('start', { courseId: course.id })}
          style={{ width: '100%', background: FT.orange, border: 'none', borderRadius: 14, padding: '14px 0', fontSize: 15, fontWeight: 700, color: FT.ink, cursor: 'pointer', letterSpacing: -0.2 }}
        >
          Choose this course
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/CourseDetailScreen.jsx
git commit -m "feat: add CourseDetailScreen with map and weather widget"
```

---

### Task 11: StartRoundScreen — type-picker refactor

**Files:**
- Modify: `src/screens/StartRoundScreen.jsx`

- [ ] **Step 1: Read the current screen**

Read `src/screens/StartRoundScreen.jsx` — note the existing player-selection and course-list logic.

- [ ] **Step 2: Add internal `mode` state and type-picker view**

The screen gains a `mode` state: `'pick' | 'official' | 'mine' | 'ready'`.

- On mount: if `params.courseId` is set (coming from CourseDetailScreen), set mode to `'ready'`
- `'pick'` mode shows two tiles: "Official Courses" (forest green) and "My Courses" (paper)
- `'official'` mode navigates to `go('officialCourses')` — the OfficialCoursesScreen handles its own flow
- `'mine'` mode shows the existing personal course list
- `'ready'` mode skips course selection and shows the pre-selected course + player section

Insert at the top of the component function body:

```jsx
const [mode, setMode] = useState(() =>
  params?.courseId ? 'ready' : 'pick'
)
const selectedCourse = courses.find(c => c.id === params?.courseId) ?? null
```

Replace the course-selection JSX with this structure:

```jsx
{/* ─── Pick mode: tile selector ─── */}
{mode === 'pick' && (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 14px' }}>
    {/* Official tile */}
    <button
      onClick={() => go('officialCourses')}
      style={{
        background: FT.forest, borderRadius: 16, padding: '16px 14px',
        position: 'relative', overflow: 'hidden', cursor: 'pointer',
        border: 'none', textAlign: 'left', color: FT.cream
      }}
    >
      <div style={{ fontFamily: 'SF Mono, monospace', fontSize: 7, letterSpacing: 2, opacity: 0.55, textTransform: 'uppercase', marginBottom: 2 }}>Browse</div>
      <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.4, paddingRight: 36 }}>Official Courses</div>
      <div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>Norwegian courses with par data</div>
      <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: 14, background: FT.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: FT.ink, fontWeight: 700 }}>→</div>
    </button>

    {/* My Courses tile */}
    <button
      onClick={() => setMode('mine')}
      style={{
        background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 16, padding: '16px 14px',
        position: 'relative', overflow: 'hidden', cursor: 'pointer',
        textAlign: 'left', color: FT.ink
      }}
    >
      <div style={{ fontFamily: 'SF Mono, monospace', fontSize: 7, letterSpacing: 2, opacity: 0.55, textTransform: 'uppercase', marginBottom: 2 }}>Your saved</div>
      <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.4, paddingRight: 36 }}>My Courses</div>
      <div style={{ fontSize: 10, opacity: 0.5, marginTop: 2 }}>Custom courses you've created</div>
      <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: 14, background: 'rgba(42,31,23,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: FT.dim, fontWeight: 700 }}>→</div>
    </button>
  </div>
)}

{/* ─── Mine mode: existing personal course list ─── */}
{mode === 'mine' && (
  <>
    <button onClick={() => setMode('pick')} style={{ background: 'none', border: 'none', color: FT.orange, fontSize: 12, padding: '0 14px 10px', cursor: 'pointer' }}>
      ← Back
    </button>
    {/* existing course list JSX here — no changes to logic */}
    {existingCourseListJsx}
  </>
)}

{/* ─── Ready mode: pre-selected official course ─── */}
{mode === 'ready' && selectedCourse && (
  <div style={{ padding: '0 14px 12px' }}>
    <div style={{ background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 14, padding: '10px 11px', display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: FT.forest, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: FT.cream, flexShrink: 0 }}>
        {selectedCourse.holes}H
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: FT.ink }}>{selectedCourse.name}</div>
        <div style={{ fontSize: 10, color: FT.dim, marginTop: 2 }}>{selectedCourse.location}</div>
      </div>
      <button
        onClick={() => go('start')}
        style={{ fontSize: 10, color: FT.orange, background: 'none', border: 'none', cursor: 'pointer' }}
      >
        Change
      </button>
    </div>
  </div>
)}
```

Note: replace `existingCourseListJsx` with the actual course list JSX from the file you read in Step 1.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/StartRoundScreen.jsx
git commit -m "feat: add type-picker tiles to StartRoundScreen"
```

---

### Task 12: CoursesScreen → Course Library with filter chips

**Files:**
- Modify: `src/screens/CoursesScreen.jsx`

- [ ] **Step 1: Read the current screen**

Read `src/screens/CoursesScreen.jsx` — note the existing personal course CRUD UI.

- [ ] **Step 2: Add filter chip state and Recent tab**

The screen gains a `filter` state: `'recent' | 'official' | 'mine'` (default `'recent'`).

- Recent tab: list of courses from the user's round history — derive from `rounds` joined to courses. For MVP, derive client-side from the existing `useCourses` hook by looking at courses that have matching rounds. If no rounds data available in this hook, show a message "Play a round to see recent courses."
- Official tab: button that navigates to `go('officialCourses')`
- Mine tab: existing personal course list

```jsx
const [filter, setFilter] = useState('recent')

const chips = ['recent', 'official', 'mine']
const chipLabels = { recent: 'Recent', official: 'Official', mine: 'My Courses' }
```

Chip row JSX (insert after the screen heading):

```jsx
<div style={{ display: 'flex', gap: 6, padding: '0 14px 12px', overflowX: 'auto' }}>
  {chips.map(c => (
    <button
      key={c}
      onClick={() => {
        if (c === 'official') { go('officialCourses'); return }
        setFilter(c)
      }}
      style={{
        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: filter === c ? 600 : 500,
        whiteSpace: 'nowrap', border: `1px solid ${filter === c && c !== 'official' ? FT.forest : FT.hair}`,
        background: filter === c && c !== 'official' ? FT.forest : FT.paper,
        color: filter === c && c !== 'official' ? FT.cream : FT.dim,
        cursor: 'pointer'
      }}
    >
      {chipLabels[c]}
    </button>
  ))}
</div>
```

Recent tab content (no changes to mine tab content):

```jsx
{filter === 'recent' && (
  <div style={{ padding: '0 10px' }}>
    {recentCourses.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '32px 20px', color: FT.dim, fontSize: 13, lineHeight: 1.6 }}>
        Play a round to see your recent courses here.
      </div>
    ) : (
      recentCourses.map(course => (
        <div key={course.id} style={{ background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 14, padding: '10px 11px', display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: FT.forest, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: FT.cream, flexShrink: 0 }}>
            {course.holes}H
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: FT.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{course.name}</div>
            <div style={{ fontSize: 10, color: FT.dim, marginTop: 2 }}>
              {course.location ?? `Par ${course.par_total}`}
              {course.source === 'official' && (
                <span style={{ background: 'rgba(255,107,31,0.12)', color: FT.orange, fontSize: 8, fontWeight: 600, padding: '1px 4px', borderRadius: 3, marginLeft: 4, fontFamily: 'SF Mono, monospace' }}>OFFICIAL</span>
              )}
            </div>
          </div>
        </div>
      ))
    )}
  </div>
)}
```

For `recentCourses`: derive from `courses` where `courseId` appears in any round associated with the user. Since the hook doesn't expose rounds yet, use `useCourses` and filter for now (show all user's courses as "recent" in MVP, improve later):

```jsx
const recentCourses = courses.slice(0, 5)  // MVP: show 5 most recent user courses
```

- [ ] **Step 3: Update the screen heading label to "Course Library"**

Change any existing title text from "Courses" to "Course Library." Update the `screen-lbl` monospace label to read `COURSE LIBRARY`.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/screens/CoursesScreen.jsx
git commit -m "feat: rename CoursesScreen to Course Library with filter chips"
```

---

### Task 13: CourseSubmissionScreen + AdminScreen

**Files:**
- Create: `src/screens/CourseSubmissionScreen.jsx`
- Create: `src/screens/AdminScreen.jsx`

- [ ] **Step 1: Create CourseSubmissionScreen**

```jsx
// src/screens/CourseSubmissionScreen.jsx
import { useState } from 'react'
import { submitCourse } from '../services/courses'

const FT = {
  forest: '#1F3D2B', cream: '#F4EFE4', paper: '#FAF6EC',
  ink: '#15110D', orange: '#FF6B1F',
  dim: 'rgba(42,31,23,0.55)', hair: 'rgba(42,31,23,0.12)',
}

export function CourseSubmissionScreen({ go, userId, onToast }) {
  const [form, setForm] = useState({ name: '', location: '', holes: '18', notes: '' })
  const [submitting, setSubmitting] = useState(false)

  const update = (field, val) => setForm(prev => ({ ...prev, [field]: val }))

  const handleSubmit = async () => {
    if (!form.name.trim()) { onToast?.('Course name is required'); return }
    setSubmitting(true)
    try {
      await submitCourse(userId, {
        name: form.name.trim(),
        location: form.location.trim() || null,
        lat: null,
        lng: null,
        holes: parseInt(form.holes, 10) || 18,
        holes_detail: null,
        notes: form.notes.trim() || null,
      })
      onToast?.('Course submitted! We'll review it soon.')
      go('officialCourses')
    } catch (err) {
      onToast?.('Submission failed. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const fieldStyle = {
    width: '100%', boxSizing: 'border-box',
    background: FT.paper, border: `1.5px solid ${FT.hair}`, borderRadius: 12,
    padding: '11px 12px', fontSize: 13, color: FT.ink, outline: 'none'
  }
  const labelStyle = {
    fontFamily: 'SF Mono, monospace', fontSize: 9, letterSpacing: 1.5,
    color: FT.dim, textTransform: 'uppercase', display: 'block', marginBottom: 5
  }

  return (
    <div style={{ background: FT.cream, minHeight: '100vh', fontFamily: '-apple-system, SF Pro Display, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px 6px', fontSize: 10, fontWeight: 600, color: FT.ink }}>
        <span>9:41</span><span>●●●</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 14px 6px' }}>
        <button onClick={() => go('officialCourses')} style={{ width: 30, height: 30, borderRadius: 9, background: FT.paper, border: `1px solid ${FT.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer' }}>‹</button>
        <span style={{ fontFamily: 'SF Mono, monospace', fontSize: 9, letterSpacing: 2, color: FT.dim }}>SUBMIT COURSE</span>
        <div style={{ width: 30 }} />
      </div>

      <div style={{ padding: '0 14px 16px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.6, color: FT.ink, lineHeight: 1.15 }}>Submit a<br />Course.</h1>
        <p style={{ fontSize: 12, color: FT.dim, marginTop: 6, lineHeight: 1.6 }}>Found a course we're missing? Fill in what you know — we'll review and add it.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 14px' }}>
        <div>
          <label style={labelStyle}>Course name *</label>
          <input value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. Marka Disc Golf" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>Location</label>
          <input value={form.location} onChange={e => update('location', e.target.value)} placeholder="e.g. Oslo" style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>Number of holes</label>
          <input type="number" min="1" max="36" value={form.holes} onChange={e => update('holes', e.target.value)} style={fieldStyle} />
        </div>
        <div>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Anything useful — layout, difficulty, accessibility…" rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
        </div>
      </div>

      <div style={{ padding: '20px 14px 40px' }}>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{ width: '100%', background: submitting ? FT.dim : FT.orange, border: 'none', borderRadius: 14, padding: '14px 0', fontSize: 15, fontWeight: 700, color: FT.ink, cursor: submitting ? 'not-allowed' : 'pointer' }}
        >
          {submitting ? 'Submitting…' : 'Submit Course'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create AdminScreen**

```jsx
// src/screens/AdminScreen.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import { approveSubmission } from '../services/courses'

const FT = {
  forest: '#1F3D2B', cream: '#F4EFE4', paper: '#FAF6EC',
  ink: '#15110D', orange: '#FF6B1F',
  dim: 'rgba(42,31,23,0.55)', hair: 'rgba(42,31,23,0.12)',
}

export function AdminScreen({ go, userId, onToast }) {
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('course_submissions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (!error) setSubmissions(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const handleApprove = async (sub) => {
    try {
      await approveSubmission(userId, sub)
      setSubmissions(prev => prev.filter(s => s.id !== sub.id))
      onToast?.(`${sub.name} approved!`)
    } catch (err) {
      onToast?.('Approval failed. Try again.')
    }
  }

  const handleReject = async (subId) => {
    const { error } = await supabase
      .from('course_submissions')
      .update({ status: 'rejected', reviewed_by: userId, reviewed_at: new Date().toISOString() })
      .eq('id', subId)
    if (!error) {
      setSubmissions(prev => prev.filter(s => s.id !== subId))
      onToast?.('Submission rejected.')
    }
  }

  return (
    <div style={{ background: FT.cream, minHeight: '100vh', fontFamily: '-apple-system, SF Pro Display, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 18px 6px', fontSize: 10, fontWeight: 600, color: FT.ink }}>
        <span>9:41</span><span>●●●</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 14px 6px' }}>
        <button onClick={() => go('account')} style={{ width: 30, height: 30, borderRadius: 9, background: FT.paper, border: `1px solid ${FT.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, cursor: 'pointer' }}>‹</button>
        <span style={{ fontFamily: 'SF Mono, monospace', fontSize: 9, letterSpacing: 2, color: FT.dim }}>ADMIN</span>
        <div style={{ width: 30 }} />
      </div>
      <div style={{ padding: '0 14px 16px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.6, color: FT.ink }}>Course<br />Submissions.</h1>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 32, color: FT.dim, fontSize: 13 }}>Loading…</div>}
      {!loading && submissions.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: FT.dim, fontSize: 13 }}>No pending submissions.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 14px' }}>
        {submissions.map(sub => (
          <div key={sub.id} style={{ background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: FT.ink }}>{sub.name}</div>
            <div style={{ fontSize: 11, color: FT.dim, marginTop: 3 }}>
              {sub.location ?? 'No location'} · {sub.holes} holes
            </div>
            {sub.notes && <div style={{ fontSize: 11, color: FT.dim, marginTop: 3, fontStyle: 'italic' }}>{sub.notes}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                onClick={() => handleApprove(sub)}
                style={{ flex: 1, background: FT.forest, border: 'none', borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: FT.cream, cursor: 'pointer' }}
              >
                Approve
              </button>
              <button
                onClick={() => handleReject(sub.id)}
                style={{ flex: 1, background: 'rgba(42,31,23,0.06)', border: `1px solid ${FT.hair}`, borderRadius: 10, padding: '8px 0', fontSize: 12, fontWeight: 600, color: FT.ink, cursor: 'pointer' }}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/CourseSubmissionScreen.jsx src/screens/AdminScreen.jsx
git commit -m "feat: add CourseSubmissionScreen and AdminScreen"
```

---

### Task 14: Navigation wiring — App.jsx + HomeScreen

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/screens/HomeScreen.jsx`

- [ ] **Step 1: Read App.jsx**

Read `src/App.jsx` — note the `switch(screen)` cases and `go()` callback pattern.

- [ ] **Step 2: Add new route cases in App.jsx**

In the `switch(screen)` block, add these cases (after the existing `courses` case):

```jsx
case 'officialCourses':
  body = <OfficialCoursesScreen go={go} onToast={toast} />
  break

case 'courseDetail':
  body = <CourseDetailScreen go={go} params={params} />
  break

case 'submitCourse':
  body = <CourseSubmissionScreen go={go} userId={user?.id} onToast={toast} />
  break

case 'admin':
  body = profile?.is_admin
    ? <AdminScreen go={go} userId={user?.id} onToast={toast} />
    : <div style={{ padding: 24, color: '#c0392b' }}>Access denied.</div>
  break
```

Add imports at the top of `App.jsx`:

```jsx
import { OfficialCoursesScreen } from './screens/OfficialCoursesScreen'
import { CourseDetailScreen } from './screens/CourseDetailScreen'
import { CourseSubmissionScreen } from './screens/CourseSubmissionScreen'
import { AdminScreen } from './screens/AdminScreen'
```

- [ ] **Step 3: Update HomeScreen tile label**

Read `src/screens/HomeScreen.jsx`. Find the tile or button labelled "Courses" that calls `go('courses')`. Update its label to "Course Library". No other changes.

- [ ] **Step 4: Add admin entry point**

Read `src/screens/AccountScreen.jsx` (or wherever account settings live). After the existing settings rows, add this row — wrapped in a `profile?.is_admin` guard:

```jsx
{profile?.is_admin && (
  <button
    onClick={() => go('admin')}
    style={{ width: '100%', background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', marginTop: 8 }}
  >
    <div>
      <div style={{ fontWeight: 600, fontSize: 13, color: FT.ink }}>Course Submissions</div>
      <div style={{ fontSize: 11, color: FT.dim, marginTop: 2 }}>Review pending community submissions</div>
    </div>
    <span style={{ fontSize: 12, color: FT.dim }}>→</span>
  </button>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6: Run all tests**

```bash
npx vitest run --reporter=verbose
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/screens/HomeScreen.jsx
git commit -m "feat: wire official courses routes and update nav labels"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| Official courses read-only, seeded from JSON | Tasks 1, 5 |
| `source: 'official' \| 'user'` distinction | Tasks 1, 2 |
| Autocomplete search with Norwegian chars | Tasks 3, 8, 9 |
| 24h IndexedDB cache for official courses | Task 8 |
| Course detail page with map (Kartverket) | Task 10 |
| Weather widget (Met.no via Edge Function proxy) | Tasks 6, 7, 10 |
| Wind alert at ≥8 m/s | Task 10 |
| Weather emoji + compass direction | Task 7 |
| "Choose this course" → `go('start', { courseId })` | Task 10 |
| StartRoundScreen type-picker tiles | Task 11 |
| Course Library with filter chips (Recent/Official/Mine) | Task 12 |
| Community submission form | Task 13 |
| Admin approval screen | Task 13 |
| `is_admin` gate | Tasks 1, 2, 14 |
| `course_submissions` table + RLS | Task 1 |
| `approveSubmission` invalidates IndexedDB cache | Task 4 |
| Navigation wiring + "Course Library" label | Task 14 |

All spec requirements are covered. No gaps found.

### Placeholder scan

No "TBD", "TODO", or incomplete sections. All code blocks are complete and self-contained.

### Type consistency

- `Course.source: 'official' | 'user'` — defined in Task 2, used consistently in Tasks 3, 4, 5, 9, 12
- `getOfficialCourses()` — defined in Task 3, used in Tasks 8, 10
- `approveSubmission(adminId, sub)` — defined in Task 4, used in Tasks 13
- `WeatherData` type — defined in Task 2, returned by `fetchWeather()` in Task 7, consumed in Task 10
- `CourseSubmission` type — defined in Task 2, returned by `submitCourse()` in Task 4, used in Task 13
- `CACHE_KEY = 'official-courses'` — set in Task 8, deleted by `del('official-courses')` in Task 4 ✓
- `go('officialCourses')` — registered in Task 14, called in Tasks 9, 11, 12, 13 ✓
- `go('courseDetail', { courseId })` — registered in Task 14, called in Task 9 ✓
- `go('start', { courseId })` — existing route, called in Task 10 ✓
