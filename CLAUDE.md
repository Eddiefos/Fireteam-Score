# CLAUDE.md — Fireteam Score
> AI assistant instructions for the **Fireteam Score** codebase.
> Keep this file updated as architecture decisions are made.

---

## 1. Project Overview

**Fireteam Score** is a Progressive Web App (PWA) for disc golf scorekeeping with friends ("the squad"). Players can select or create courses, start a round together, track live scores hole-by-hole, and review personal stats and head-to-head records over time.

### Current State (as of initial handoff)
- Static design prototype in React (loaded via CDN, no bundler)
- Five screens designed: Home, Start Round, Live Scorecard, End of Round, Stats/History
- PWA manifest configured (`manifest.json`)
- No backend, no auth, no database yet — all data is hardcoded

### Target Stack
| Layer | Choice | Reason |
|---|---|---|
| Frontend | React (Vite) | Already in React; add build step |
| Styling | Inline styles → Tailwind (optional) | Existing design system is inline |
| Backend / DB | Supabase | Auth + Postgres + Realtime + Storage in one |
| Course data | PDGA API + local cache | Norway has 179+ PDGA-registered courses |
| Hosting | Vercel or Netlify | PWA-friendly, free tier |
| Offline | Service Worker + IndexedDB | Courses are often in areas with no signal |

---

## 2. Design System

**Never change these without updating the `FT` token object in `screens.jsx`.**

### Colour Tokens
```js
const FT = {
  forest: '#1F3D2B',   // primary dark green — headers, buttons, selected states
  moss:   '#3A5A40',   // secondary green
  fern:   '#588157',   // tertiary green — player avatar (Mara)
  cream:  '#F4EFE4',   // main background
  paper:  '#FAF6EC',   // card background (slightly lighter than cream)
  bark:   '#2A1F17',   // near-black — double bogey, dark text
  ink:    '#15110D',   // true near-black for body text
  orange: '#FF6B1F',   // CTA, birdie chips, accents — primary action colour
  amber:  '#FFB627',   // player avatar (Soren), secondary accent
  dim:    'rgba(42,31,23,0.55)',   // secondary text
  hair:   'rgba(42,31,23,0.12)',   // subtle borders
};
```

### Typography
- **Body / UI:** `-apple-system, "SF Pro Display", system-ui, sans-serif`
- **Rounded headings:** `-apple-system, "SF Pro Rounded", system-ui, sans-serif`
- **Monospace labels:** `"SF Mono", ui-monospace, Menlo, monospace`

### Par Chip Colours
| Score | Background | Text |
|---|---|---|
| Birdie (−1 or better) | `orange #FF6B1F` | `ink` |
| Par (E) | `rgba(42,31,23,0.08)` | `ink` |
| Bogey (+1) | `rgba(42,31,23,0.85)` | `cream` |
| Double bogey+ | `bark #2A1F17` | `cream` |

### Shared Components (already built)
- `ScreenShell` — full-bleed screen wrapper with bg + font defaults
- `StatusBar` — iOS-style time/signal/battery bar, supports `dark` prop
- `HomeIndicator` — iOS home pill at bottom
- `TopoBg` — decorative SVG topographic contour lines, used in hero areas
- `ParChip` — coloured score-vs-par badge, sizes `sm / md / lg`
- `Disc` — flying disc SVG icon

---

## 3. Screen Inventory

| # | Screen | Key Data Needed |
|---|---|---|
| 01 | **Home** | Current user profile, fireteam members, 3 most recent rounds |
| 02 | **Start Round** | Saved/nearby courses, fireteam member list, tee selection per player |
| 03 | **Live Scorecard** | Active round state, hole-by-hole scores for all players, live timer |
| 04 | **End of Round** | Final scores, winner, round summary |
| 05 | **Stats / History** | Per-user averages, birdie count, win%, head-to-head records, past rounds |

---

## 4. Database Schema (Supabase / PostgreSQL)

Use Supabase with Row Level Security (RLS) enabled on every table.

### 4.1 `profiles`
Extends Supabase Auth `auth.users`. Created automatically via trigger on signup.

```sql
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  username    text unique not null,
  display_name text not null,
  initials    text not null,           -- e.g. "JK" — shown in avatar
  avatar_color text not null default '#FF6B1F',  -- FT colour token hex
  created_at  timestamptz default now()
);

-- RLS
alter table profiles enable row level security;
create policy "Users can read all profiles"   on profiles for select using (true);
create policy "Users can update own profile"  on profiles for update using (auth.uid() = id);
```

### 4.2 `fireteams`
A group of players. One user can belong to multiple fireteams.

```sql
create table fireteams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid references profiles(id) on delete set null,
  invite_code text unique default substr(md5(random()::text), 1, 8),
  created_at  timestamptz default now()
);

create table fireteam_members (
  fireteam_id uuid references fireteams(id) on delete cascade,
  user_id     uuid references profiles(id) on delete cascade,
  joined_at   timestamptz default now(),
  primary key (fireteam_id, user_id)
);

-- RLS
alter table fireteams enable row level security;
create policy "Members can view their fireteams" on fireteams for select
  using (
    exists (
      select 1 from fireteam_members
      where fireteam_id = fireteams.id and user_id = auth.uid()
    )
  );
```

### 4.3 `courses`
Can be seeded from PDGA or created by users.

```sql
create table courses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text,                    -- city/area name
  lat         numeric(9,6),
  lng         numeric(9,6),
  holes       int not null default 18,
  par_total   int,
  source      text default 'user',     -- 'pdga' | 'udisc_import' | 'user'
  pdga_id     text unique,             -- null for user-created
  created_by  uuid references profiles(id) on delete set null,
  is_public   boolean default true,
  created_at  timestamptz default now()
);

-- Individual hole data (optional but recommended)
create table course_holes (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid references courses(id) on delete cascade,
  hole_number int not null,
  par         int not null default 3,
  distance_ft int,
  distance_m  int,
  unique (course_id, hole_number)
);

-- RLS: public courses visible to all; private only to creator
alter table courses enable row level security;
create policy "Public courses are readable by all" on courses for select
  using (is_public = true or created_by = auth.uid());
create policy "Users can create courses" on courses for insert
  with check (auth.uid() = created_by);
create policy "Creators can update their own courses" on courses for update
  using (auth.uid() = created_by);
```

### 4.4 `rounds`
One row per completed or in-progress round.

```sql
create table rounds (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid references courses(id),
  fireteam_id  uuid references fireteams(id),
  started_at   timestamptz default now(),
  finished_at  timestamptz,
  status       text default 'active',  -- 'active' | 'finished' | 'abandoned'
  holes_played int default 0,
  created_by   uuid references profiles(id)
);

-- RLS: only fireteam members can see rounds
alter table rounds enable row level security;
create policy "Fireteam members can view rounds" on rounds for select
  using (
    exists (
      select 1 from fireteam_members
      where fireteam_id = rounds.fireteam_id and user_id = auth.uid()
    )
  );
create policy "Fireteam members can create rounds" on rounds for insert
  with check (
    exists (
      select 1 from fireteam_members
      where fireteam_id = rounds.fireteam_id and user_id = auth.uid()
    )
  );
```

### 4.5 `scores`
One row per player per hole per round.

```sql
create table scores (
  id          uuid primary key default gen_random_uuid(),
  round_id    uuid references rounds(id) on delete cascade,
  user_id     uuid references profiles(id) on delete cascade,
  hole_number int not null,
  strokes     int not null,
  created_at  timestamptz default now(),
  unique (round_id, user_id, hole_number)
);

-- RLS: fireteam members can read; only the player can write their own score
alter table scores enable row level security;
create policy "Fireteam members can read scores" on scores for select
  using (
    exists (
      select 1 from rounds r
      join fireteam_members fm on fm.fireteam_id = r.fireteam_id
      where r.id = scores.round_id and fm.user_id = auth.uid()
    )
  );
create policy "Players write own scores" on scores for insert
  with check (auth.uid() = user_id);
create policy "Players update own scores" on scores for update
  using (auth.uid() = user_id);
```

### 4.6 `saved_courses` (favourites)
```sql
create table saved_courses (
  user_id    uuid references profiles(id) on delete cascade,
  course_id  uuid references courses(id) on delete cascade,
  saved_at   timestamptz default now(),
  primary key (user_id, course_id)
);
```

---

## 5. Authentication

Use **Supabase Auth** with the following flows:

### Supported Methods (in priority order)
1. **Magic Link (email)** — lowest friction, no password to forget
2. **Google OAuth** — optional, easy to add later
3. **No anonymous / guest play** — scores are meaningless without identity

### Auth Flow
```
App open
  └─ supabase.auth.getSession()
       ├─ session exists → load profile → Home screen
       └─ no session     → Onboarding / Login screen
```

### Profile Auto-creation
Create a Postgres trigger so a `profiles` row is inserted whenever a new `auth.users` row appears:

```sql
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, initials)
  values (
    new.id,
    split_part(new.email, '@', 1),   -- temp username from email
    split_part(new.email, '@', 1),
    upper(left(split_part(new.email, '@', 1), 2))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

User completes their profile (display name, initials, avatar colour) on first login.

---

## 6. API Layer

### Recommended pattern
Wrap all Supabase calls in a typed service layer. Never call `supabase` directly in components.

```
src/
  services/
    courses.ts    -- getCourses(), searchCourses(), createCourse()
    rounds.ts     -- startRound(), submitScore(), finishRound()
    profiles.ts   -- getProfile(), updateProfile()
    fireteams.ts  -- getFireteam(), joinByCode(), getMembers()
    stats.ts      -- getUserStats(), getHeadToHead()
```

### Key queries

**Search courses near a location:**
```ts
// Install PostGIS extension in Supabase dashboard first
const { data } = await supabase.rpc('courses_near', {
  lat: 58.14,
  lng: 7.99,
  radius_km: 50
});
```

```sql
-- The RPC function
create or replace function courses_near(lat float, lng float, radius_km float)
returns setof courses as $$
  select * from courses
  where (
    point(lng, lat) <@> point(courses.lng, courses.lat)
  ) * 1.60934 < radius_km   -- convert miles to km
  order by point(lng, lat) <@> point(courses.lng, courses.lat)
  limit 20;
$$ language sql stable;
```

**Realtime scores during a live round:**
```ts
supabase
  .channel(`round:${roundId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'scores',
    filter: `round_id=eq.${roundId}`
  }, (payload) => {
    updateScoreInState(payload.new);
  })
  .subscribe();
```

---

## 7. Course Data Pipeline

### Strategy: Seed from PDGA, augment with user content

**Step 1 — One-time import script** (Node.js, run locally):
```
scripts/
  import-pdga-courses.ts
```
- Fetch all Norwegian courses from `https://api.pdga.com/services/json/course_directory?field_course_location_country=NO`
- Normalise to our `courses` schema
- Upsert into Supabase using `pdga_id` as the deduplication key
- Mark `source = 'pdga'`, `is_public = true`, `created_by = null`

**Step 2 — User-created courses:**
- Shown in `StartRoundScreen` "Pick your course" list
- Form fields: Name, Location (map pin), Number of holes, Per-hole par + distance (optional)
- Saved to `courses` table with `source = 'user'`
- User can toggle `is_public` to share with the community

**Step 3 — Periodic PDGA refresh** (optional):
- Weekly cron via Supabase Edge Function or GitHub Actions
- Only updates `pdga_`-sourced rows, never overwrites user courses

---

## 8. Offline Support

Disc golf courses are frequently in forests with no signal. Offline support is **required**.

### Service Worker strategy
Use **Workbox** (via Vite plugin `vite-plugin-pwa`):

| Resource | Strategy |
|---|---|
| App shell (HTML/JS/CSS) | Cache First |
| Course data for active round | Cache First (pre-cached on round start) |
| Course search results | Stale While Revalidate |
| Score submissions | Background Sync (queue until online) |
| Profile images | Cache First with expiry |

### Score submission offline queue
```ts
// On score submit while offline:
// 1. Write to IndexedDB immediately (optimistic UI)
// 2. Register a Background Sync event
// 3. Service worker flushes queue when connection returns
```

Use `idb-keyval` for simple IndexedDB access. Key structure:
```
pending-scores:{roundId}:{userId}:{hole}  →  { strokes, timestamp }
active-round:{roundId}                    →  full round + scores snapshot
```

---

## 9. Security Checklist

### Supabase / Database
- [ ] RLS enabled on **every** table — verify with `select schemaname, tablename, rowsecurity from pg_tables where schemaname = 'public'`
- [ ] Never expose the Supabase `service_role` key in client code — only `anon` key
- [ ] All user input sanitised before DB writes (Supabase handles parameterised queries, but validate lengths/types in the service layer)
- [ ] `created_by` is always set server-side via `auth.uid()` — never trust client-supplied user IDs for ownership
- [ ] Invite codes are single-use or time-limited — add `expires_at` to fireteam invites
- [ ] Score edits only allowed while `round.status = 'active'` — enforce via DB constraint or RLS policy

### Auth
- [ ] Magic link tokens expire after 1 hour (Supabase default — keep it)
- [ ] Session stored in `localStorage` by Supabase client — acceptable for a PWA; ensure HTTPS only
- [ ] Implement session refresh handling — Supabase does this automatically; make sure the app responds to `SIGNED_OUT` events

### API / Network
- [ ] All API calls go over HTTPS — enforce via Vercel/Netlify redirect rules
- [ ] PDGA course import script runs server-side only — never expose PDGA credentials in the client
- [ ] If you add an Edge Function for anything sensitive, validate `Authorization` header before processing

### Frontend
- [ ] No secrets in client bundle — use `.env.local` for local dev, environment variables in Vercel/Netlify for production
- [ ] CSP header: set `Content-Security-Policy` to restrict `script-src` and `connect-src` to known domains
- [ ] `X-Frame-Options: DENY` — prevent clickjacking
- [ ] Validate all form inputs client-side (UX) **and** server-side via RLS / DB constraints (security)

---

## 10. Environment Variables

```env
# .env.local (never commit this file)
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...   # safe to expose — RLS protects data
```

Only `VITE_`-prefixed vars are exposed to the browser in Vite. The Supabase `anon` key is designed to be public — RLS is the security layer, not key secrecy.

---

## 11. Folder Structure (target)

```
fireteam-score/
  public/
    manifest.json
    icon-192.png
    icon-512.png
    sw.js               -- generated by vite-plugin-pwa
  src/
    assets/
    components/
      atoms/            -- ParChip, Disc, StatusBar, HomeIndicator
      screens/          -- HomeScreen, StartRoundScreen, etc.
      layout/           -- ScreenShell, TopoBg
    services/
      supabase.ts       -- createClient() singleton
      courses.ts
      rounds.ts
      profiles.ts
      fireteams.ts
      stats.ts
    hooks/
      useRound.ts       -- live round state + realtime subscription
      useProfile.ts
      useFireteam.ts
    store/              -- Zustand (recommended) for global state
      roundStore.ts
      authStore.ts
    lib/
      offline.ts        -- IndexedDB queue helpers
      pdga.ts           -- PDGA API client (server-side only)
    types/
      index.ts          -- Course, Round, Score, Profile, etc.
    screens/            -- page-level route components
    App.tsx
    main.tsx
  scripts/
    import-pdga-courses.ts
  CLAUDE.md             -- this file
```

---

## 12. Key Product Decisions

These are intentional choices — do not change without discussion:

| Decision | Rationale |
|---|---|
| PWA over native app | Lower barrier to entry, no App Store, works on all phones |
| Squad-first model | App is designed for groups — solo play is secondary |
| No guest/anonymous play | Scores are meaningless without identity; makes stats worthless |
| Invite code to join fireteam | Simpler than friend requests; one share = join |
| Orange as primary CTA colour | High contrast on both dark (forest) and light (cream) backgrounds |
| Supabase Realtime for live scoring | All players see scores update during an active round without polling |
| Per-hole par stored in DB | Allows different layouts / tees for the same course in future |

---

## 13. Coding Conventions

- **TypeScript** everywhere — `strict: true`
- **No default exports** from service files — use named exports
- **No direct `supabase.from()` calls in components** — always go through service functions
- **Optimistic UI** for score submission — update state immediately, sync in background
- Colours always referenced via `FT` token object, never raw hex strings in components
- Screen components receive no props for data — they use hooks (`useRound()`, `useProfile()`, etc.)
- Error boundaries around each screen

---

## 14. Testing Priorities

1. **Score calculation** — par-relative arithmetic, edge cases (hole-in-one, max strokes)
2. **RLS policies** — use Supabase's policy testing tools; a user must never see another fireteam's rounds
3. **Offline queue** — scores submitted offline must flush correctly and not duplicate
4. **Course search** — fuzzy match + distance sort with Norwegian characters (ø, æ, å)

---

## 15. Norwegian-specific Notes

- Course names often contain `ø`, `æ`, `å` — ensure UTF-8 throughout and use `ILIKE` with proper collation in Postgres
- Distance unit: metric (metres) is standard in Norway — show metres, store both in DB
- PDGA has ~179 registered Norwegian courses; UDisc has ~867 — the gap is user-created courses worth importing eventually
- Bølgane Frisbeegolfpark (Kristiansand) — likely a "home course" for the developer 🙂
