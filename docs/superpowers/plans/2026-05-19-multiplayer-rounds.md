# Multi-Player Rounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add friends, multi-player round setup, and live Realtime scoring so multiple players can score a disc golf round together from their own devices.

**Architecture:** New `friends` and `round_players` tables extend the existing schema; `scores` grows a `round_player_id` FK so guests and registered players are handled uniformly. Service and hook layers wrap all Supabase calls; screens consume hooks only. Supabase Realtime (postgres_changes) syncs scores across devices without polling.

**Tech Stack:** React 18 + Vite, TypeScript services/hooks, Supabase JS v2 (Postgres + Realtime), Vitest + @testing-library/react, idb-keyval offline queue.

**Spec:** `docs/superpowers/specs/2026-05-19-multiplayer-rounds-design.md`

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `supabase/migrations/20260519000000_multiplayer_rounds.sql` | DB schema changes |
| Modify | `src/types/index.ts` | Add Friend, FriendRequest, NewRoundPlayer; update RoundPlayer, Score, PendingScore, Round |
| Create | `src/services/friends.ts` | All friends CRUD |
| Create | `src/services/__tests__/friends.test.ts` | |
| Create | `src/services/roundPlayers.ts` | round_players CRUD |
| Create | `src/services/__tests__/roundPlayers.test.ts` | |
| Modify | `src/services/rounds.ts` | startRound with players; getRounds/getActiveRound select created_by |
| Modify | `src/services/__tests__/rounds.test.ts` | |
| Modify | `src/services/scores.ts` | submitScore takes roundPlayerId |
| Modify | `src/services/__tests__/scores.test.ts` | |
| Modify | `src/lib/offline.ts` | queueScore/flushScoreQueue with roundPlayerId |
| Modify | `src/lib/__tests__/offline.test.ts` | |
| Create | `src/hooks/useFriends.ts` | Friends state + actions |
| Create | `src/hooks/__tests__/useFriends.test.ts` | |
| Create | `src/hooks/useRoundPlayers.ts` | Round players list |
| Create | `src/hooks/__tests__/useRoundPlayers.test.ts` | |
| Modify | `src/hooks/useRounds.ts` | Pass players array to startRound |
| Modify | `src/hooks/useScores.ts` | Realtime subscription; roundPlayerId in submitScore |
| Create | `src/screens/SquadScreen.jsx` | Friends + Requests tabs |
| Modify | `src/screens/AuthScreens.jsx` | Remove SquadScreen stub and export |
| Modify | `src/screens/StartRoundScreen.jsx` | Player picker section |
| Modify | `src/screens/LiveScorecardScreen.jsx` | Multi-player + scorekeeper override |
| Modify | `src/screens/HomeScreen.jsx` | Player avatars in active round card |
| Modify | `src/App.jsx` | Import SquadScreen from new path; pass userId |

---

## Task 1: DB Migration SQL

**Files:**
- Create: `supabase/migrations/20260519000000_multiplayer_rounds.sql`

- [ ] **Step 1: Write migration file**

```sql
-- supabase/migrations/20260519000000_multiplayer_rounds.sql

-- ── friends ───────────────────────────────────────────────────────────────
create table friends (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid references profiles(id) on delete cascade,
  addressee_id uuid references profiles(id) on delete cascade,
  status       text default 'pending',  -- 'pending' | 'accepted' | 'declined'
  created_at   timestamptz default now(),
  unique (requester_id, addressee_id)
);

alter table friends enable row level security;

create policy "Users see their own friend rows" on friends for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can send friend requests" on friends for insert
  with check (auth.uid() = requester_id);

create policy "Addressee can update status" on friends for update
  using (auth.uid() = addressee_id);

create policy "Participants can delete" on friends for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ── round_players ─────────────────────────────────────────────────────────
create table round_players (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid references rounds(id) on delete cascade,
  user_id      uuid references profiles(id) on delete set null,
  guest_name   text,
  display_name text not null,
  initials     text not null,
  color        text not null,
  is_guest     boolean default false,
  created_at   timestamptz default now(),
  check (user_id is not null or guest_name is not null)
);

alter table round_players enable row level security;

create policy "Round participants can view players" on round_players for select
  using (
    exists (
      select 1 from round_players rp2
      where rp2.round_id = round_players.round_id
        and rp2.user_id = auth.uid()
    )
    or exists (
      select 1 from rounds r
      where r.id = round_players.round_id
        and r.created_by = auth.uid()
    )
  );

create policy "Round creator can add players" on round_players for insert
  with check (
    exists (
      select 1 from rounds r
      where r.id = round_id and r.created_by = auth.uid()
    )
  );

-- ── scores changes ────────────────────────────────────────────────────────
alter table scores
  add column round_player_id uuid references round_players(id) on delete cascade,
  alter column user_id drop not null;

-- Replace old unique constraint with round_player_id–based one
-- (run manually if constraint name differs: check with \d scores)
alter table scores drop constraint if exists scores_round_id_user_id_hole_number_key;
alter table scores add constraint scores_round_player_hole_unique
  unique (round_id, round_player_id, hole_number);

-- Updated RLS for scores
drop policy if exists "Players write own scores" on scores;
drop policy if exists "Fireteam members can read scores" on scores;

create policy "Players write own scores" on scores for insert
  with check (
    auth.uid() = user_id
    or auth.uid() = (select created_by from rounds where id = round_id)
  );

create policy "Players update own scores" on scores for update
  using (
    auth.uid() = user_id
    or auth.uid() = (select created_by from rounds where id = round_id)
  );

create policy "Round participants can read scores" on scores for select
  using (
    exists (
      select 1 from round_players rp
      where rp.round_id = scores.round_id
        and rp.user_id = auth.uid()
    )
    or auth.uid() = (select created_by from rounds where id = round_id)
  );

-- ── rounds RLS update ─────────────────────────────────────────────────────
-- Old policy was fireteam-based; new rounds are ad-hoc (no fireteam_id)
drop policy if exists "Fireteam members can view rounds" on rounds;
drop policy if exists "Fireteam members can create rounds" on rounds;

create policy "Round participants can view rounds" on rounds for select
  using (
    auth.uid() = created_by
    or exists (
      select 1 from round_players rp
      where rp.round_id = rounds.id
        and rp.user_id = auth.uid()
    )
  );

create policy "Authenticated users can create rounds" on rounds for insert
  with check (auth.uid() = created_by);
```

- [ ] **Step 2: Apply in Supabase dashboard**

Open your Supabase project → SQL Editor → paste the migration → Run.

If the constraint drop fails with "does not exist", run `\d scores` in Supabase's SQL editor to find the actual constraint name and replace the drop statement.

- [ ] **Step 3: Commit migration file**

```bash
git add supabase/migrations/20260519000000_multiplayer_rounds.sql
git commit -m "feat: add DB migration for friends, round_players, scores changes"
```

---

## Task 2: Update Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Write the updated types file**

Replace the entire content of `src/types/index.ts` with:

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
  lat: number | null
  lng: number | null
  holes: number
  par_total: number | null
  pars: number[]
  source: 'pdga' | 'user'
  is_public: boolean
  created_by: string | null
  created_at: string
}

export type RoundPlayer = {
  id: string           // round_players.id — used as score key
  roundId: string
  userId: string | null
  guestName: string | null
  displayName: string
  initials: string
  color: string
  isGuest: boolean
}

export type NewRoundPlayer = {
  userId?: string
  guestName?: string
  displayName: string
  initials: string
  color: string
  isGuest: boolean
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

export type Score = {
  id: string
  round_id: string
  round_player_id: string | null
  user_id: string | null
  hole_number: number
  strokes: number
  created_at: string
}

export type PendingScore = {
  round_id: string
  round_player_id: string | null
  user_id: string | null
  hole_number: number
  strokes: number
  timestamp: number
}

export type Friend = {
  id: string           // friends.id
  userId: string       // the other person's profile id
  displayName: string
  username: string
  initials: string
  avatarColor: string
  roundsTogether: number
  avgVsPar: number | null
}

export type FriendRequest = {
  id: string
  requesterId: string
  addresseeId: string
  status: 'pending' | 'accepted' | 'declined'
  profile: Profile
  createdAt: string
}

export type Fireteam = {
  id: string
  name: string
  created_by: string | null
  invite_code: string
  created_at: string
}

export type FireteamMember = {
  fireteam_id: string
  user_id: string
  joined_at: string
}

export type SavedCourse = {
  user_id: string
  course_id: string
  saved_at: string
}
```

- [ ] **Step 2: Fix gameLogic.ts — p.name → p.displayName**

`computePlayerStats` in `src/lib/gameLogic.ts` uses `p.name` to match and key players. Update the four occurrences:

```ts
// Line ~128
const mine = completed.filter((r) => r.players.some((p) => p.displayName === playerName))
// Line ~140
const me = r.players.find((p) => p.displayName === playerName)
// Line ~168
const opp = h2h[p.displayName] || { w: 0, l: 0, t: 0, last: '–' }
// Line ~180
h2h[p.displayName] = opp
```

Then update `src/lib/__tests__/gameLogic.test.ts` — any test that builds a mock `RoundPlayer` with `name:` needs to change to `displayName:`. For example:
```ts
// Before
{ id: 'u1', name: 'Edvard', color: '#FF6B1F' }
// After
{ id: 'rp1', roundId: 'r1', userId: 'u1', guestName: null, displayName: 'Edvard', initials: 'EF', color: '#FF6B1F', isGuest: false }
```

Run tests after to confirm:
```bash
npx vitest run src/lib/__tests__/gameLogic.test.ts
```

Expected: PASS.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: Remaining TypeScript errors in services/hooks/screens that still use old `submitScore` signature or `useRoundPlayers`. These will be fixed in subsequent tasks.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/lib/gameLogic.ts src/lib/__tests__/gameLogic.test.ts
git commit -m "feat: update types + fix gameLogic for multi-player rounds"
```

---

## Task 3: Friends Service

**Files:**
- Create: `src/services/friends.ts`
- Create: `src/services/__tests__/friends.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/services/__tests__/friends.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../supabase'
import {
  sendFriendRequest,
  acceptRequest,
  declineRequest,
  cancelRequest,
  removeFriend,
  searchUsers,
} from '../friends'

beforeEach(() => vi.clearAllMocks())

describe('sendFriendRequest', () => {
  it('inserts a pending friend row', async () => {
    const chain = { insert: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)
    await sendFriendRequest('u1', 'u2')
    expect(chain.insert).toHaveBeenCalledWith({
      requester_id: 'u1',
      addressee_id: 'u2',
      status: 'pending',
    })
  })
})

describe('acceptRequest', () => {
  it('updates status to accepted', async () => {
    const chain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)
    await acceptRequest('req1')
    expect(chain.update).toHaveBeenCalledWith({ status: 'accepted' })
  })
})

describe('declineRequest', () => {
  it('updates status to declined', async () => {
    const chain = { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)
    await declineRequest('req1')
    expect(chain.update).toHaveBeenCalledWith({ status: 'declined' })
  })
})

describe('cancelRequest', () => {
  it('deletes the friend row', async () => {
    const chain = { delete: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)
    await cancelRequest('req1')
    expect(chain.delete).toHaveBeenCalled()
  })
})

describe('removeFriend', () => {
  it('deletes the friend row', async () => {
    const chain = { delete: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)
    await removeFriend('req1')
    expect(chain.delete).toHaveBeenCalled()
  })
})

describe('searchUsers', () => {
  it('searches profiles by username excluding self', async () => {
    const profiles = [{ id: 'u2', username: 'mara', display_name: 'Mara', initials: 'M', avatar_color: '#FF6B1F', created_at: '' }]
    const chain = {
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: profiles, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(chain as any)
    const result = await searchUsers('mar', 'u1')
    expect(chain.ilike).toHaveBeenCalledWith('username', '%mar%')
    expect(chain.neq).toHaveBeenCalledWith('id', 'u1')
    expect(result).toEqual(profiles)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/services/__tests__/friends.test.ts
```

Expected: FAIL — module `../friends` not found.

- [ ] **Step 3: Implement the service**

```ts
// src/services/friends.ts
import { supabase } from './supabase'
import type { Friend, FriendRequest, Profile } from '../types'

export async function getFriends(userId: string): Promise<Friend[]> {
  const { data, error } = await supabase
    .from('friends')
    .select(`
      id,
      requester_id,
      addressee_id,
      requester:profiles!requester_id(id, display_name, username, initials, avatar_color),
      addressee:profiles!addressee_id(id, display_name, username, initials, avatar_color)
    `)
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
  if (error) throw new Error(error.message)

  return (data ?? []).map((row: any) => {
    const other = row.requester_id === userId ? row.addressee : row.requester
    return {
      id: row.id,
      userId: other.id,
      displayName: other.display_name,
      username: other.username,
      initials: other.initials,
      avatarColor: other.avatar_color,
      roundsTogether: 0,
      avgVsPar: null,
    }
  })
}

export async function getPendingRequests(userId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('friends')
    .select(`
      id, requester_id, addressee_id, status, created_at,
      profile:profiles!requester_id(id, display_name, username, initials, avatar_color, created_at)
    `)
    .eq('addressee_id', userId)
    .eq('status', 'pending')
  if (error) throw new Error(error.message)

  return (data ?? []).map((row: any) => ({
    id: row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    status: row.status,
    profile: {
      id: row.profile.id,
      display_name: row.profile.display_name,
      username: row.profile.username,
      initials: row.profile.initials,
      avatar_color: row.profile.avatar_color,
      created_at: row.profile.created_at,
    },
    createdAt: row.created_at,
  }))
}

export async function getSentRequests(userId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('friends')
    .select(`
      id, requester_id, addressee_id, status, created_at,
      profile:profiles!addressee_id(id, display_name, username, initials, avatar_color, created_at)
    `)
    .eq('requester_id', userId)
    .eq('status', 'pending')
  if (error) throw new Error(error.message)

  return (data ?? []).map((row: any) => ({
    id: row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    status: row.status,
    profile: {
      id: row.profile.id,
      display_name: row.profile.display_name,
      username: row.profile.username,
      initials: row.profile.initials,
      avatar_color: row.profile.avatar_color,
      created_at: row.profile.created_at,
    },
    createdAt: row.created_at,
  }))
}

export async function searchUsers(query: string, currentUserId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, initials, avatar_color, created_at')
    .ilike('username', `%${query}%`)
    .neq('id', currentUserId)
    .limit(10)
  if (error) throw new Error(error.message)
  return (data ?? []) as Profile[]
}

export async function sendFriendRequest(requesterId: string, addresseeId: string): Promise<void> {
  const { error } = await supabase
    .from('friends')
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' })
  if (error) throw new Error(error.message)
}

export async function acceptRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friends')
    .update({ status: 'accepted' })
    .eq('id', requestId)
  if (error) throw new Error(error.message)
}

export async function declineRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friends')
    .update({ status: 'declined' })
    .eq('id', requestId)
  if (error) throw new Error(error.message)
}

export async function cancelRequest(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friends')
    .delete()
    .eq('id', requestId)
  if (error) throw new Error(error.message)
}

export async function removeFriend(requestId: string): Promise<void> {
  const { error } = await supabase
    .from('friends')
    .delete()
    .eq('id', requestId)
  if (error) throw new Error(error.message)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run src/services/__tests__/friends.test.ts
```

Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/services/friends.ts src/services/__tests__/friends.test.ts
git commit -m "feat: add friends service"
```

---

## Task 4: Round Players Service

**Files:**
- Create: `src/services/roundPlayers.ts`
- Create: `src/services/__tests__/roundPlayers.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/services/__tests__/roundPlayers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../supabase'
import { addRoundPlayer, getRoundPlayers } from '../roundPlayers'

beforeEach(() => vi.clearAllMocks())

describe('addRoundPlayer', () => {
  it('inserts a round_player and returns it', async () => {
    const player = {
      id: 'rp1', round_id: 'r1', user_id: 'u1', guest_name: null,
      display_name: 'Edvard', initials: 'EF', color: '#FF6B1F', is_guest: false,
    }
    const chain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: player, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await addRoundPlayer('r1', {
      userId: 'u1',
      displayName: 'Edvard',
      initials: 'EF',
      color: '#FF6B1F',
      isGuest: false,
    })
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      round_id: 'r1',
      display_name: 'Edvard',
      is_guest: false,
    }))
    expect(result.id).toBe('rp1')
  })
})

describe('getRoundPlayers', () => {
  it('returns players for a round', async () => {
    const rows = [
      { id: 'rp1', round_id: 'r1', user_id: 'u1', guest_name: null, display_name: 'Edvard', initials: 'EF', color: '#FF6B1F', is_guest: false },
    ]
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await getRoundPlayers('r1')
    expect(result).toHaveLength(1)
    expect(result[0].displayName).toBe('Edvard')
    expect(result[0].isGuest).toBe(false)
  })
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
npx vitest run src/services/__tests__/roundPlayers.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

```ts
// src/services/roundPlayers.ts
import { supabase } from './supabase'
import type { RoundPlayer, NewRoundPlayer } from '../types'

function toRoundPlayer(row: any): RoundPlayer {
  return {
    id: row.id,
    roundId: row.round_id,
    userId: row.user_id ?? null,
    guestName: row.guest_name ?? null,
    displayName: row.display_name,
    initials: row.initials,
    color: row.color,
    isGuest: row.is_guest,
  }
}

export async function addRoundPlayer(
  roundId: string,
  player: NewRoundPlayer,
): Promise<RoundPlayer> {
  const { data, error } = await supabase
    .from('round_players')
    .insert({
      round_id: roundId,
      user_id: player.userId ?? null,
      guest_name: player.guestName ?? null,
      display_name: player.displayName,
      initials: player.initials,
      color: player.color,
      is_guest: player.isGuest,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return toRoundPlayer(data)
}

export async function getRoundPlayers(roundId: string): Promise<RoundPlayer[]> {
  const { data, error } = await supabase
    .from('round_players')
    .select('*')
    .eq('round_id', roundId)
  if (error) throw new Error(error.message)
  return (data ?? []).map(toRoundPlayer)
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/services/__tests__/roundPlayers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/roundPlayers.ts src/services/__tests__/roundPlayers.test.ts
git commit -m "feat: add roundPlayers service"
```

---

## Task 5: Update Rounds Service

**Files:**
- Modify: `src/services/rounds.ts`
- Modify: `src/services/__tests__/rounds.test.ts`

Context: `startRound` must now also insert `round_players` rows. `getRounds` must return rounds where user is a player (not just creator). `getActiveRound` must select `created_by`.

- [ ] **Step 1: Update the tests**

Replace `src/services/__tests__/rounds.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../supabase'
import { startRound, finishRound, abandonRound } from '../rounds'

beforeEach(() => vi.clearAllMocks())

describe('startRound', () => {
  it('inserts a round then inserts round_players and returns the round id', async () => {
    const mockRound = { id: 'r1', course_id: 'c1', status: 'active', started_at: '2026-01-01', finished_at: null, holes_played: 0, created_by: 'u1' }
    const roundChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockRound, error: null }),
    }
    const playerChain = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    }
    vi.mocked(supabase.from)
      .mockReturnValueOnce(roundChain as any)  // rounds insert
      .mockReturnValueOnce(playerChain as any) // round_players insert

    const result = await startRound('c1', 'u1', [
      { userId: 'u1', displayName: 'Edvard', initials: 'EF', color: '#FF6B1F', isGuest: false },
    ])

    expect(roundChain.insert).toHaveBeenCalledWith(expect.objectContaining({ course_id: 'c1', created_by: 'u1' }))
    expect(playerChain.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ round_id: 'r1', display_name: 'Edvard', is_guest: false }),
      ])
    )
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

- [ ] **Step 2: Run to confirm tests fail**

```bash
npx vitest run src/services/__tests__/rounds.test.ts
```

Expected: FAIL — startRound signature mismatch.

- [ ] **Step 3: Update the service**

Replace `src/services/rounds.ts`:

```ts
import { supabase } from './supabase'
import type { NewRoundPlayer } from '../types'

export async function startRound(
  courseId: string,
  userId: string,
  players: NewRoundPlayer[],
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('rounds')
    .insert({ course_id: courseId, status: 'active', holes_played: 0, created_by: userId })
    .select()
    .single()
  if (error) throw new Error(error.message)

  const roundId = (data as any).id

  if (players.length > 0) {
    const rows = players.map((p) => ({
      round_id: roundId,
      user_id: p.userId ?? null,
      guest_name: p.guestName ?? null,
      display_name: p.displayName,
      initials: p.initials,
      color: p.color,
      is_guest: p.isGuest,
    }))
    const { error: playerError } = await supabase.from('round_players').insert(rows)
    if (playerError) throw new Error(playerError.message)
  }

  return data as { id: string }
}

export async function getRounds(userId: string): Promise<{
  id: string
  course_id: string
  started_at: string
  finished_at: string | null
  status: string
  holes_played: number
  created_by: string
}[]> {
  // RLS now allows seeing rounds where user is creator OR round_player
  const { data, error } = await supabase
    .from('rounds')
    .select('id, course_id, started_at, finished_at, status, holes_played, created_by')
    .order('started_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as any[]
}

export async function getActiveRound(userId: string): Promise<{
  id: string
  course_id: string
  started_at: string
  holes_played: number
  created_by: string
} | null> {
  const { data } = await supabase
    .from('rounds')
    .select('id, course_id, started_at, holes_played, created_by')
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as any) ?? null
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

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/services/__tests__/rounds.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/rounds.ts src/services/__tests__/rounds.test.ts
git commit -m "feat: startRound inserts round_players; getRounds/getActiveRound include created_by"
```

---

## Task 6: Update Scores Service and Offline Queue

**Files:**
- Modify: `src/services/scores.ts`
- Modify: `src/services/__tests__/scores.test.ts`
- Modify: `src/lib/offline.ts`
- Modify: `src/lib/__tests__/offline.test.ts`

Context: `submitScore` now takes `roundPlayerId` (the round_players.id) and `userId | null`. The offline queue key and stored payload update accordingly.

- [ ] **Step 1: Update scores tests**

Replace `src/services/__tests__/scores.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { supabase } from '../supabase'
import { submitScore, getScores } from '../scores'

beforeEach(() => vi.clearAllMocks())

describe('submitScore', () => {
  it('upserts using round_player_id conflict key', async () => {
    const chain = { upsert: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await submitScore('r1', 'rp1', 'u1', 3, 4)
    expect(chain.upsert).toHaveBeenCalledWith(
      { round_id: 'r1', round_player_id: 'rp1', user_id: 'u1', hole_number: 3, strokes: 4 },
      { onConflict: 'round_id,round_player_id,hole_number' },
    )
  })

  it('allows null userId for guests', async () => {
    const chain = { upsert: vi.fn().mockResolvedValue({ error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    await submitScore('r1', 'rp2', null, 1, 3)
    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: null }),
      expect.anything(),
    )
  })
})

describe('getScores', () => {
  it('fetches scores for a round', async () => {
    const scores = [{ id: 's1', round_id: 'r1', round_player_id: 'rp1', user_id: 'u1', hole_number: 1, strokes: 3 }]
    const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: scores, error: null }) }
    vi.mocked(supabase.from).mockReturnValue(chain as any)

    const result = await getScores('r1')
    expect(result).toEqual(scores)
  })
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
npx vitest run src/services/__tests__/scores.test.ts
```

Expected: FAIL — submitScore signature mismatch.

- [ ] **Step 3: Update scores service**

Replace `src/services/scores.ts`:

```ts
import { supabase } from './supabase'
import type { Score } from '../types'

export async function submitScore(
  roundId: string,
  roundPlayerId: string,
  userId: string | null,
  holeNumber: number,
  strokes: number,
): Promise<void> {
  const { error } = await supabase
    .from('scores')
    .upsert(
      { round_id: roundId, round_player_id: roundPlayerId, user_id: userId, hole_number: holeNumber, strokes },
      { onConflict: 'round_id,round_player_id,hole_number' },
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

- [ ] **Step 4: Run scores tests**

```bash
npx vitest run src/services/__tests__/scores.test.ts
```

Expected: PASS.

- [ ] **Step 5: Update offline queue**

Replace `src/lib/offline.ts`:

```ts
import { set, get, del, keys } from 'idb-keyval'
import type { PendingScore } from '../types'

const SCORE_PREFIX = 'pending-score:'

export async function queueScore(
  round_id: string,
  round_player_id: string,
  user_id: string | null,
  hole_number: number,
  strokes: number,
): Promise<void> {
  const key = `${SCORE_PREFIX}${round_id}:${round_player_id}:${hole_number}`
  const entry: PendingScore = { round_id, round_player_id, user_id, hole_number, strokes, timestamp: Date.now() }
  await set(key, entry)
}

export async function flushScoreQueue(
  onSubmit: (
    round_id: string,
    round_player_id: string,
    user_id: string | null,
    hole_number: number,
    strokes: number,
  ) => Promise<void>,
): Promise<void> {
  const allKeys = await keys()
  const scoreKeys = (allKeys as string[]).filter((k) => k.startsWith(SCORE_PREFIX))

  const entries = await Promise.all(
    scoreKeys.map(async (k) => ({ key: k, entry: await get<PendingScore>(k) }))
  )

  const sorted = entries
    .filter((e) => e.entry != null)
    .sort((a, b) => a.entry!.timestamp - b.entry!.timestamp)

  for (const { key, entry } of sorted) {
    try {
      await onSubmit(
        entry!.round_id,
        entry!.round_player_id ?? '',
        entry!.user_id,
        entry!.hole_number,
        entry!.strokes,
      )
      await del(key)
    } catch {
      // Leave in queue — will retry next flush
    }
  }
}
```

- [ ] **Step 6: Update offline tests**

In `src/lib/__tests__/offline.test.ts`, update any test that calls `queueScore` or checks the `flushScoreQueue` callback signature:

Find the test file and update the `queueScore` call to:
```ts
await queueScore('r1', 'rp1', 'u1', 3, 4)
```
And the `flushScoreQueue` mock callback signature to:
```ts
const submit = vi.fn().mockResolvedValue(undefined)
await flushScoreQueue(submit)
expect(submit).toHaveBeenCalledWith('r1', 'rp1', 'u1', 3, 4)
```

- [ ] **Step 7: Run all updated tests**

```bash
npx vitest run src/services/__tests__/scores.test.ts src/lib/__tests__/offline.test.ts
```

Expected: PASS all.

- [ ] **Step 8: Commit**

```bash
git add src/services/scores.ts src/services/__tests__/scores.test.ts src/lib/offline.ts src/lib/__tests__/offline.test.ts
git commit -m "feat: submitScore uses roundPlayerId; offline queue updated to match"
```

---

## Task 7: useFriends Hook

**Files:**
- Create: `src/hooks/useFriends.ts`
- Create: `src/hooks/__tests__/useFriends.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/hooks/__tests__/useFriends.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../services/friends', () => ({
  getFriends: vi.fn().mockResolvedValue([]),
  getPendingRequests: vi.fn().mockResolvedValue([]),
  getSentRequests: vi.fn().mockResolvedValue([]),
  sendFriendRequest: vi.fn().mockResolvedValue(undefined),
  acceptRequest: vi.fn().mockResolvedValue(undefined),
  declineRequest: vi.fn().mockResolvedValue(undefined),
  cancelRequest: vi.fn().mockResolvedValue(undefined),
  searchUsers: vi.fn().mockResolvedValue([]),
}))

import * as friendsService from '../../services/friends'
import { useFriends } from '../useFriends'

beforeEach(() => vi.clearAllMocks())

describe('useFriends', () => {
  it('loads friends, pending requests, and sent requests on mount', async () => {
    const mockFriend = { id: 'f1', userId: 'u2', displayName: 'Mara', username: 'mara', initials: 'M', avatarColor: '#FF6B1F', roundsTogether: 0, avgVsPar: null }
    vi.mocked(friendsService.getFriends).mockResolvedValue([mockFriend])

    const { result } = renderHook(() => useFriends('u1'))

    // Initially loading
    expect(result.current.loading).toBe(true)

    // Wait for load
    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.friends).toHaveLength(1)
    expect(result.current.friends[0].displayName).toBe('Mara')
  })

  it('sendRequest calls service and refreshes', async () => {
    const { result } = renderHook(() => useFriends('u1'))
    await act(async () => {})

    await act(async () => {
      await result.current.sendRequest('u2')
    })

    expect(friendsService.sendFriendRequest).toHaveBeenCalledWith('u1', 'u2')
  })

  it('acceptRequest calls service and refreshes', async () => {
    const { result } = renderHook(() => useFriends('u1'))
    await act(async () => {})

    await act(async () => {
      await result.current.acceptRequest('req1')
    })

    expect(friendsService.acceptRequest).toHaveBeenCalledWith('req1')
  })
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
npx vitest run src/hooks/__tests__/useFriends.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

```ts
// src/hooks/useFriends.ts
import { useState, useEffect, useCallback } from 'react'
import type { Friend, FriendRequest, Profile } from '../types'
import {
  getFriends,
  getPendingRequests,
  getSentRequests,
  sendFriendRequest,
  acceptRequest as acceptRequestService,
  declineRequest as declineRequestService,
  cancelRequest as cancelRequestService,
  searchUsers as searchUsersService,
} from '../services/friends'

export function useFriends(userId: string | undefined) {
  const [friends, setFriends] = useState<Friend[]>([])
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([])
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) return
    const [f, p, s] = await Promise.all([
      getFriends(userId),
      getPendingRequests(userId),
      getSentRequests(userId),
    ])
    setFriends(f)
    setPendingRequests(p)
    setSentRequests(s)
  }, [userId])

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    refresh().finally(() => setLoading(false))
  }, [userId, refresh])

  const sendRequest = useCallback(async (addresseeId: string) => {
    if (!userId) return
    await sendFriendRequest(userId, addresseeId)
    await refresh()
  }, [userId, refresh])

  const acceptRequest = useCallback(async (requestId: string) => {
    await acceptRequestService(requestId)
    await refresh()
  }, [refresh])

  const declineRequest = useCallback(async (requestId: string) => {
    await declineRequestService(requestId)
    await refresh()
  }, [refresh])

  const cancelRequest = useCallback(async (requestId: string) => {
    await cancelRequestService(requestId)
    await refresh()
  }, [refresh])

  const searchUsers = useCallback(async (query: string): Promise<Profile[]> => {
    if (!userId || query.length < 2) return []
    return searchUsersService(query, userId)
  }, [userId])

  return {
    friends,
    pendingRequests,
    sentRequests,
    loading,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    searchUsers,
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/hooks/__tests__/useFriends.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useFriends.ts src/hooks/__tests__/useFriends.test.ts
git commit -m "feat: add useFriends hook"
```

---

## Task 8: useRoundPlayers Hook

**Files:**
- Create: `src/hooks/useRoundPlayers.ts`
- Create: `src/hooks/__tests__/useRoundPlayers.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/hooks/__tests__/useRoundPlayers.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../services/roundPlayers', () => ({
  getRoundPlayers: vi.fn().mockResolvedValue([]),
}))

import * as rpService from '../../services/roundPlayers'
import { useRoundPlayers } from '../useRoundPlayers'

beforeEach(() => vi.clearAllMocks())

describe('useRoundPlayers', () => {
  it('loads players for a round', async () => {
    const mockPlayer = {
      id: 'rp1', roundId: 'r1', userId: 'u1', guestName: null,
      displayName: 'Edvard', initials: 'EF', color: '#FF6B1F', isGuest: false,
    }
    vi.mocked(rpService.getRoundPlayers).mockResolvedValue([mockPlayer])

    const { result } = renderHook(() => useRoundPlayers('r1'))
    expect(result.current.loading).toBe(true)

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.players).toHaveLength(1)
    expect(result.current.players[0].displayName).toBe('Edvard')
  })

  it('does nothing when roundId is undefined', async () => {
    const { result } = renderHook(() => useRoundPlayers(undefined))
    await act(async () => {})
    expect(result.current.players).toHaveLength(0)
    expect(rpService.getRoundPlayers).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to confirm fail**

```bash
npx vitest run src/hooks/__tests__/useRoundPlayers.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement the hook**

```ts
// src/hooks/useRoundPlayers.ts
import { useState, useEffect } from 'react'
import type { RoundPlayer } from '../types'
import { getRoundPlayers } from '../services/roundPlayers'

export function useRoundPlayers(roundId: string | undefined) {
  const [players, setPlayers] = useState<RoundPlayer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!roundId) { setLoading(false); return }
    getRoundPlayers(roundId)
      .then(setPlayers)
      .finally(() => setLoading(false))
  }, [roundId])

  return { players, loading }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/hooks/__tests__/useRoundPlayers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRoundPlayers.ts src/hooks/__tests__/useRoundPlayers.test.ts
git commit -m "feat: add useRoundPlayers hook"
```

---

## Task 9: Update useRounds Hook

**Files:**
- Modify: `src/hooks/useRounds.ts`

Context: `startRound` now takes a `players: NewRoundPlayer[]` array and passes it to the service. The hook's caller (StartRoundScreen) will build this array in Task 12.

- [ ] **Step 1: Update useRounds.ts**

Replace `src/hooks/useRounds.ts`:

```ts
import { useState, useEffect, useCallback } from 'react'
import type { NewRoundPlayer } from '../types'
import {
  getRounds,
  getActiveRound,
  startRound as startRoundService,
  finishRound as finishRoundService,
  abandonRound as abandonRoundService,
} from '../services/rounds'

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

  const startRound = useCallback(async (courseId: string, players: NewRoundPlayer[]) => {
    if (!userId) return null
    const round = await startRoundService(courseId, userId, players)
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

- [ ] **Step 2: Run all tests to check for regressions**

```bash
npx vitest run
```

Expected: All tests pass. TypeScript errors may appear in StartRoundScreen (it still calls the old `startRound(courseId)` signature) — these are fixed in Task 12.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRounds.ts
git commit -m "feat: useRounds.startRound accepts players array"
```

---

## Task 10: Update useScores Hook (Realtime)

**Files:**
- Modify: `src/hooks/useScores.ts`

Context: Add Supabase Realtime subscription on `scores` for `round_id`. Update `submitScore` to take `(roundPlayerId, userId | null, holeNumber, strokes)`.

- [ ] **Step 1: Update useScores.ts**

Replace `src/hooks/useScores.ts`:

```ts
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
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

  // Realtime subscription
  useEffect(() => {
    if (!roundId) return
    const channel = supabase
      .channel(`scores:${roundId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores', filter: `round_id=eq.${roundId}` },
        (payload: any) => {
          const incoming = payload.new as Score
          setScores((prev) => {
            const idx = prev.findIndex(
              (s) => s.round_player_id === incoming.round_player_id && s.hole_number === incoming.hole_number
            )
            if (idx >= 0) {
              const updated = [...prev]
              updated[idx] = incoming
              return updated
            }
            return [...prev, incoming]
          })
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [roundId])

  useEffect(() => {
    const handleOnline = () => {
      flushScoreQueue((rid, rp, uid, hole, strokes) =>
        submitScoreService(rid, rp, uid, hole, strokes)
      )
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  const submitScore = useCallback(async (
    roundPlayerId: string,
    userId: string | null,
    holeNumber: number,
    strokes: number,
  ) => {
    if (!roundId) return

    // Optimistic update
    setScores((prev) => {
      const existing = prev.findIndex(
        (s) => s.round_player_id === roundPlayerId && s.hole_number === holeNumber
      )
      const next: Score = {
        id: 'optimistic',
        round_id: roundId,
        round_player_id: roundPlayerId,
        user_id: userId,
        hole_number: holeNumber,
        strokes,
        created_at: new Date().toISOString(),
      }
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = next
        return updated
      }
      return [...prev, next]
    })

    if (navigator.onLine) {
      await submitScoreService(roundId, roundPlayerId, userId, holeNumber, strokes)
    } else {
      await queueScore(roundId, roundPlayerId, userId, holeNumber, strokes)
    }
  }, [roundId])

  return { scores, loading, submitScore }
}
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All pass. The `supabase.channel` call in useScores isn't tested here (no hook test for Realtime); Realtime is integration-tested manually.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useScores.ts
git commit -m "feat: useScores adds Realtime subscription and roundPlayerId to submitScore"
```

---

## Task 11: SquadScreen

**Files:**
- Create: `src/screens/SquadScreen.jsx`
- Modify: `src/screens/AuthScreens.jsx` (remove stub + export)
- Modify: `src/App.jsx` (update import + add userId prop)

Context: The existing `SquadScreen` at `AuthScreens.jsx:507–529` is a placeholder. Extract it to its own file with two tabs: Friends (list + search) and Requests (incoming + sent).

- [ ] **Step 1: Create SquadScreen.jsx**

```jsx
// src/screens/SquadScreen.jsx
import { useState } from 'react'
import { FT, SFR, SF, MONO } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import { StatusBar, HomeIndicator, Avatar } from '../components/atoms'
import { useFriends } from '../hooks/useFriends'

function SquadScreen({ go, userId }) {
  const { friends, pendingRequests, sentRequests, loading, sendRequest, acceptRequest, declineRequest, cancelRequest, searchUsers } = useFriends(userId)
  const [tab, setTab] = useState('friends')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  const handleSearch = async (q) => {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const results = await searchUsers(q)
      setSearchResults(results)
    } finally {
      setSearching(false)
    }
  }

  const friendUserIds = new Set(friends.map((f) => f.userId))
  const pendingCount = pendingRequests.length

  return (
    <ScreenShell label="Squad" bg={FT.cream}>
      <StatusBar />

      {/* Title */}
      <div style={{ padding: '6px 24px 0' }}>
        <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 34, letterSpacing: -1.2, lineHeight: 1.05, color: FT.ink }}>Squad</div>
      </div>

      {/* Search bar */}
      <div style={{ padding: '10px 20px 0' }}>
        <div style={{
          background: 'rgba(42,31,23,0.07)', borderRadius: 14, padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Find players by username…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontFamily: SF, fontSize: 14, color: FT.ink,
            }}
          />
        </div>
        {/* Search results */}
        {searchQuery.length >= 2 && (
          <div style={{ background: FT.paper, borderRadius: 14, marginTop: 6, overflow: 'hidden', border: `1px solid ${FT.hair}` }}>
            {searching && <div style={{ padding: '12px 16px', color: FT.dim, fontSize: 13 }}>Searching…</div>}
            {!searching && searchResults.length === 0 && <div style={{ padding: '12px 16px', color: FT.dim, fontSize: 13 }}>No players found</div>}
            {!searching && searchResults.map((p) => {
              const alreadyFriend = friendUserIds.has(p.id)
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${FT.hair}` }}>
                  <Avatar name={p.display_name} color={p.avatar_color} size={36} fontSize={12} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 14, color: FT.ink }}>{p.display_name}</div>
                    <div style={{ fontSize: 12, color: FT.dim }}>@{p.username}</div>
                  </div>
                  {alreadyFriend ? (
                    <div style={{ fontSize: 11, fontFamily: MONO, color: FT.dim, padding: '4px 10px' }}>FRIENDS</div>
                  ) : (
                    <button onClick={() => sendRequest(p.id)} className="flat" style={{
                      height: 32, padding: '0 14px', borderRadius: 10, border: 'none',
                      background: FT.orange, color: FT.ink, fontFamily: SFR, fontWeight: 800, fontSize: 13,
                    }}>+ Add</button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '12px 20px 0', gap: 0, borderBottom: `1px solid ${FT.hair}`, flexShrink: 0 }}>
        {[
          { key: 'friends', label: 'Friends' },
          { key: 'requests', label: `Requests${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} className="flat" style={{
            padding: '8px 16px', fontSize: 14, fontWeight: 700, fontFamily: SFR,
            color: tab === key ? FT.ink : FT.dim,
            background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: tab === key ? `2px solid ${FT.forest}` : '2px solid transparent',
            marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {/* Tab content */}
      <div className="ft-scroll">
        {tab === 'friends' && (
          <>
            {loading && <div style={{ padding: 24, textAlign: 'center', color: FT.dim, fontSize: 14 }}>Loading…</div>}
            {!loading && friends.length === 0 && (
              <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🎯</div>
                <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 16, color: FT.ink }}>Find your crew</div>
                <div style={{ fontSize: 13, color: FT.dim, marginTop: 4 }}>Search for players by username above</div>
              </div>
            )}
            {friends.map((f) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px' }}>
                <Avatar name={f.displayName} color={f.avatarColor} size={40} fontSize={13} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 15, color: FT.ink }}>{f.displayName}</div>
                  <div style={{ fontSize: 12, color: FT.dim, marginTop: 1 }}>
                    @{f.username}{f.roundsTogether > 0 ? ` · ${f.roundsTogether} rounds together` : ''}
                  </div>
                </div>
                {f.avgVsPar !== null && (
                  <div style={{
                    background: 'rgba(42,31,23,0.07)', borderRadius: 8, padding: '3px 8px',
                    fontSize: 11, fontWeight: 700, color: FT.dim, fontFamily: MONO,
                  }}>
                    {f.avgVsPar > 0 ? '+' : ''}{f.avgVsPar.toFixed(1)} avg
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {tab === 'requests' && (
          <>
            {pendingRequests.length > 0 && (
              <>
                <div style={{ padding: '14px 20px 4px', fontSize: 10, letterSpacing: 2, color: FT.dim, fontFamily: MONO }}>INCOMING</div>
                {pendingRequests.map((req) => (
                  <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px' }}>
                    <Avatar name={req.profile.display_name} color={req.profile.avatar_color} size={38} fontSize={12} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 14, color: FT.ink }}>{req.profile.display_name}</div>
                      <div style={{ fontSize: 12, color: FT.dim }}>@{req.profile.username}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => acceptRequest(req.id)} className="flat" style={{
                        height: 32, padding: '0 12px', borderRadius: 9, border: 'none',
                        background: FT.forest, color: FT.cream, fontFamily: SFR, fontWeight: 800, fontSize: 12,
                      }}>Accept</button>
                      <button onClick={() => declineRequest(req.id)} className="flat" style={{
                        height: 32, padding: '0 12px', borderRadius: 9, border: 'none',
                        background: 'rgba(42,31,23,0.08)', color: FT.dim, fontFamily: SFR, fontWeight: 700, fontSize: 12,
                      }}>Decline</button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {sentRequests.length > 0 && (
              <>
                <div style={{ padding: '14px 20px 4px', fontSize: 10, letterSpacing: 2, color: FT.dim, fontFamily: MONO }}>SENT</div>
                {sentRequests.map((req) => (
                  <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px', opacity: 0.65 }}>
                    <Avatar name={req.profile.display_name} color={req.profile.avatar_color} size={38} fontSize={12} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 14, color: FT.ink }}>{req.profile.display_name}</div>
                      <div style={{ fontSize: 12, color: FT.dim }}>@{req.profile.username}</div>
                    </div>
                    <button onClick={() => cancelRequest(req.id)} className="flat" style={{
                      height: 32, padding: '0 12px', borderRadius: 9, border: 'none',
                      background: 'rgba(42,31,23,0.08)', color: FT.dim, fontFamily: SFR, fontWeight: 700, fontSize: 12,
                    }}>Cancel</button>
                  </div>
                ))}
              </>
            )}

            {pendingRequests.length === 0 && sentRequests.length === 0 && (
              <div style={{ padding: '32px 24px', textAlign: 'center', color: FT.dim, fontSize: 14 }}>No pending requests</div>
            )}
          </>
        )}
      </div>

      <HomeIndicator />
    </ScreenShell>
  )
}

export { SquadScreen }
```

- [ ] **Step 2: Remove SquadScreen from AuthScreens.jsx**

In `src/screens/AuthScreens.jsx`:
1. Find and delete lines 507–529 (the `function SquadScreen()` definition and the "Squad coming soon" placeholder content).
2. Remove `SquadScreen` from the export at the bottom (line ~596):

Change:
```js
export { LandingScreen, CreateAccountScreen, LoginScreen, AccountScreen, SettingsScreen, SquadScreen }
```
To:
```js
export { LandingScreen, CreateAccountScreen, LoginScreen, AccountScreen, SettingsScreen }
```

- [ ] **Step 3: Update App.jsx import**

In `src/App.jsx`, find:
```js
import { LandingScreen, CreateAccountScreen, LoginScreen, AccountScreen, SettingsScreen, SquadScreen } from './screens/AuthScreens';
```

Replace with:
```js
import { LandingScreen, CreateAccountScreen, LoginScreen, AccountScreen, SettingsScreen } from './screens/AuthScreens'
import { SquadScreen } from './screens/SquadScreen'
```

Also find the Squad case in the screen switch:
```js
case 'squad':      body = <SquadScreen go={go} />; break;
```
Replace with:
```js
case 'squad':      body = <SquadScreen go={go} userId={userId} />; break;
```

Where `userId` is `user?.id` (already available in App.jsx).

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: PASS — SquadScreen is JSX with no unit tests; existing tests unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/screens/SquadScreen.jsx src/screens/AuthScreens.jsx src/App.jsx
git commit -m "feat: implement SquadScreen with friends + requests tabs"
```

---

## Task 12: StartRoundScreen — Player Picker

**Files:**
- Modify: `src/screens/StartRoundScreen.jsx`

Context: Add a "Players" section below the course picker. The user is always pre-added. Friends load from `useFriends`. Guests can be added by name. Players shown as chips. The updated `startRound` receives the players array.

- [ ] **Step 1: Update StartRoundScreen.jsx**

Replace `src/screens/StartRoundScreen.jsx` with:

```jsx
// src/screens/StartRoundScreen.jsx
import { useState, useCallback } from 'react'
import { FT, SFR, MONO, PLAYER_COLORS } from '../constants/colors'
import { ScreenShell } from '../components/layout/ScreenShell'
import {
  StatusBar, HomeIndicator, TopoBg,
  IconChevronLeft, IconCheck, IconPlus, EmptyState, Avatar,
} from '../components/atoms'
import { useCourses } from '../hooks/useCourses'
import { useRounds } from '../hooks/useRounds'
import { useProfile } from '../hooks/useProfile'
import { useFriends } from '../hooks/useFriends'
import { totalPar } from '../lib/gameLogic'

function StartRoundScreen({ go, userId }) {
  const { courses, loading: coursesLoading } = useCourses(userId)
  const { startRound } = useRounds(userId)
  const { profile } = useProfile(userId)
  const { friends, loading: friendsLoading } = useFriends(userId)

  const [selectedCourseId, setSelectedCourseId] = useState(null)
  const [starting, setStarting] = useState(false)
  const [guestInput, setGuestInput] = useState('')
  const [showGuestInput, setShowGuestInput] = useState(false)

  // Players list — current user is always first and not removable
  const myPlayer = profile ? {
    roundPlayerId: 'me',
    userId,
    guestName: null,
    displayName: profile.display_name,
    initials: profile.initials,
    color: profile.avatar_color,
    isGuest: false,
  } : null

  const [addedPlayers, setAddedPlayers] = useState([]) // friends + guests added after "me"

  const allPlayers = myPlayer ? [myPlayer, ...addedPlayers] : addedPlayers
  const addedIds = new Set(addedPlayers.map((p) => p.userId).filter(Boolean))

  const addFriend = useCallback((friend) => {
    if (addedIds.has(friend.userId)) return
    const color = PLAYER_COLORS[allPlayers.length % PLAYER_COLORS.length]
    setAddedPlayers((prev) => [...prev, {
      roundPlayerId: `friend-${friend.userId}`,
      userId: friend.userId,
      guestName: null,
      displayName: friend.displayName,
      initials: friend.initials,
      color,
      isGuest: false,
    }])
  }, [addedIds, allPlayers.length])

  const removePlayer = useCallback((roundPlayerId) => {
    setAddedPlayers((prev) => prev.filter((p) => p.roundPlayerId !== roundPlayerId))
  }, [])

  const addGuest = () => {
    const name = guestInput.trim()
    if (!name) return
    const initials = name.split(' ').map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2)
    const color = PLAYER_COLORS[allPlayers.length % PLAYER_COLORS.length]
    setAddedPlayers((prev) => [...prev, {
      roundPlayerId: `guest-${Date.now()}`,
      userId: null,
      guestName: name,
      displayName: name,
      initials,
      color,
      isGuest: true,
    }])
    setGuestInput('')
    setShowGuestInput(false)
  }

  const selectedCourse = courses.find((c) => c.id === selectedCourseId)
  const canStart = !!selectedCourse && !starting && !!myPlayer

  const start = async () => {
    if (!canStart) return
    setStarting(true)
    try {
      const players = allPlayers.map((p) => ({
        userId: p.userId ?? undefined,
        guestName: p.guestName ?? undefined,
        displayName: p.displayName,
        initials: p.initials,
        color: p.color,
        isGuest: p.isGuest,
      }))
      await startRound(selectedCourseId, players)
      go('live')
    } catch {
      setStarting(false)
    }
  }

  if (coursesLoading) {
    return (
      <ScreenShell label="Start Round">
        <StatusBar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: FT.orange, opacity: 0.8 }} />
        </div>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell label="Start Round">
      <StatusBar />

      {/* Top bar */}
      <div style={{ padding: '6px 24px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={() => go('home')} className="flat" style={{
          width: 36, height: 36, borderRadius: 12, background: FT.paper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${FT.hair}`,
        }}>
          <IconChevronLeft />
        </button>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: FT.dim }}>START ROUND</div>
        <div style={{ width: 36 }} />
      </div>

      <div className="ft-scroll">
        <div style={{ padding: '6px 24px 16px' }}>
          <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 34, letterSpacing: -1.2, lineHeight: 1 }}>
            Pick your<br/>course.
          </div>
        </div>

        {/* Courses */}
        {courses.length === 0 ? (
          <div style={{ padding: '0 20px' }}>
            <EmptyState icon="🌲" title="No courses yet"
              body="Add a course first — name and par for each hole."
              cta={
                <button onClick={() => go('newCourse')} className="flat" style={{
                  marginTop: 14, padding: '10px 16px', borderRadius: 12, border: 'none',
                  background: FT.orange, color: FT.ink,
                  fontFamily: SFR, fontWeight: 800, fontSize: 14,
                }}>+ Add a course</button>
              } />
          </div>
        ) : (
          <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {courses.map((c) => {
              const sel = c.id === selectedCourseId
              return (
                <button key={c.id} onClick={() => setSelectedCourseId(c.id)} className="flat" style={{
                  padding: '14px 16px', borderRadius: 18,
                  background: sel ? FT.forest : FT.paper,
                  color: sel ? FT.cream : FT.ink,
                  border: sel ? `2px solid ${FT.forest}` : `1px solid ${FT.hair}`,
                  display: 'flex', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden',
                  textAlign: 'left',
                }}>
                  {sel && <TopoBg color="rgba(244,239,228,0.08)" />}
                  <div style={{
                    width: 46, height: 46, borderRadius: 14,
                    background: sel ? FT.orange : FT.forest,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: SFR, fontWeight: 900, fontSize: 14,
                    color: sel ? FT.ink : FT.cream, position: 'relative', zIndex: 1, flexShrink: 0,
                  }}>{c.pars.length}H</div>
                  <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
                    <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 17, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 1 }}>Par {totalPar(c.pars)}</div>
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: 11, position: 'relative', zIndex: 1, flexShrink: 0,
                    border: `2px solid ${sel ? FT.cream : 'rgba(42,31,23,0.3)'}`,
                    background: sel ? FT.cream : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {sel && <IconCheck color={FT.forest} />}
                  </div>
                </button>
              )
            })}
            <button onClick={() => go('newCourse')} className="flat" style={{
              padding: '12px 16px', borderRadius: 14, border: `1px dashed ${FT.hair}`,
              background: 'transparent', color: FT.dim,
              fontFamily: SFR, fontWeight: 700, fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <IconPlus size={14} /> Add course
            </button>
          </div>
        )}

        {/* ── Players section ─────────────────────────────── */}
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: FT.dim, marginBottom: 10 }}>PLAYING</div>

          {/* Added player chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {allPlayers.map((p, i) => (
              <div key={p.roundPlayerId} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: FT.paper, border: `1px solid ${FT.hair}`, borderRadius: 20,
                padding: '5px 10px 5px 6px',
              }}>
                <Avatar name={p.displayName} color={p.color} size={24} fontSize={9} />
                <span style={{ fontFamily: SFR, fontWeight: 700, fontSize: 12, color: FT.ink }}>{p.displayName}</span>
                {i > 0 && (
                  <button onClick={() => removePlayer(p.roundPlayerId)} className="flat" style={{
                    background: 'none', border: 'none', padding: 0, marginLeft: 2,
                    color: 'rgba(42,31,23,0.35)', fontSize: 13, lineHeight: 1, cursor: 'pointer',
                  }}>✕</button>
                )}
              </div>
            ))}
          </div>

          {/* Friends to add */}
          {!friendsLoading && friends.length > 0 && (
            <>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 2, color: FT.dim, marginBottom: 6 }}>FRIENDS</div>
              {friends.map((f) => {
                const added = addedIds.has(f.userId)
                return (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
                    <Avatar name={f.displayName} color={f.avatarColor} size={34} fontSize={11} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 14, color: FT.ink }}>{f.displayName}</div>
                      <div style={{ fontSize: 11, color: FT.dim }}>@{f.username}</div>
                    </div>
                    <button
                      onClick={() => added ? removePlayer(`friend-${f.userId}`) : addFriend(f)}
                      className="flat"
                      style={{
                        width: 30, height: 30, borderRadius: 9, border: 'none',
                        background: added ? 'rgba(31,61,43,0.1)' : 'rgba(255,107,31,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: added ? 14 : 18, color: added ? FT.forest : FT.orange, fontWeight: 700,
                      }}>
                      {added ? '✓' : '+'}
                    </button>
                  </div>
                )
              })}
            </>
          )}

          {/* Add guest */}
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${FT.hair}` }}>
            {showGuestInput ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  autoFocus
                  value={guestInput}
                  onChange={(e) => setGuestInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addGuest()}
                  placeholder="Guest name…"
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 12,
                    border: `1.5px solid ${FT.hair}`, background: FT.paper,
                    fontFamily: SFR, fontSize: 15, color: FT.ink, outline: 'none',
                  }}
                />
                <button onClick={addGuest} className="flat" style={{
                  height: 40, padding: '0 14px', borderRadius: 12, border: 'none',
                  background: FT.forest, color: FT.cream, fontFamily: SFR, fontWeight: 800, fontSize: 13,
                }}>Add</button>
                <button onClick={() => setShowGuestInput(false)} className="flat" style={{
                  height: 40, padding: '0 10px', borderRadius: 12, border: 'none',
                  background: 'rgba(42,31,23,0.08)', color: FT.dim, fontFamily: SFR, fontWeight: 700, fontSize: 13,
                }}>✕</button>
              </div>
            ) : (
              <button onClick={() => setShowGuestInput(true)} className="flat" style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
                background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                  border: `1.5px dashed rgba(42,31,23,0.25)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, color: 'rgba(42,31,23,0.3)',
                }}>+</div>
                <div>
                  <div style={{ fontFamily: SFR, fontWeight: 700, fontSize: 14, color: 'rgba(42,31,23,0.5)' }}>Add guest player</div>
                  <div style={{ fontSize: 11, color: FT.dim }}>No account needed</div>
                </div>
              </button>
            )}
          </div>
        </div>

        <div style={{ height: 100 }} />
      </div>

      {/* Start button */}
      <div style={{ padding: '10px 20px', paddingBottom: 'max(20px, env(safe-area-inset-bottom))', flexShrink: 0, borderTop: `1px solid ${FT.hair}` }}>
        <button
          onClick={start}
          disabled={!canStart}
          className="flat"
          style={{
            width: '100%', padding: '16px', borderRadius: 18, border: 'none',
            background: canStart ? FT.forest : 'rgba(42,31,23,0.1)',
            color: canStart ? FT.cream : FT.dim,
            fontFamily: SFR, fontWeight: 800, fontSize: 17, letterSpacing: -0.3,
          }}>
          {starting ? 'Starting…' : `Start Round${allPlayers.length > 1 ? ` · ${allPlayers.length} players` : ''} →`}
        </button>
      </div>

      <HomeIndicator />
    </ScreenShell>
  )
}

export { StartRoundScreen }
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: PASS — no automated tests for screen UI; verifying no regressions in service/hook tests.

- [ ] **Step 3: Commit**

```bash
git add src/screens/StartRoundScreen.jsx
git commit -m "feat: StartRoundScreen player picker — friends, guests, chips"
```

---

## Task 13: LiveScorecardScreen — Multi-Player

**Files:**
- Modify: `src/screens/LiveScorecardScreen.jsx`

Context: Switch from single-player (profile-based) to `useRoundPlayers`. Round assembly uses `round_players` rows. Scores keyed by `round_player_id`. The current user's row shows the stepper; round creator can tap any other player's scored chip to open an inline override picker. `p.name` → `p.displayName`.

- [ ] **Step 1: Update the data-layer wrapper (LiveScorecardScreen component)**

Find the `LiveScorecardScreen` function (lines ~46–90). Replace it with:

```jsx
function LiveScorecardScreen({ go, userId }) {
  const { activeRound, loading: roundsLoading, finishRound } = useRounds(userId)
  const { scores, submitScore } = useScores(activeRound?.id)
  const { players, loading: playersLoading } = useRoundPlayers(activeRound?.id)
  const { courses, loading: coursesLoading } = useCourses(userId)

  const isFinishingRef = useRef(false)

  useEffect(() => {
    if (!roundsLoading && !activeRound && !isFinishingRef.current) go('home')
  }, [roundsLoading, activeRound])

  const anyLoading = roundsLoading || playersLoading || coursesLoading
  const course = courses.find((c) => c.id === activeRound?.course_id)
  const pars = course?.pars ?? []

  const round = useMemo(() => {
    if (!activeRound || pars.length === 0 || players.length === 0) return null
    const scoreMap = {}
    for (const p of players) scoreMap[p.id] = Array(pars.length).fill(null)
    for (const s of scores) {
      if (s.round_player_id && scoreMap[s.round_player_id]) {
        scoreMap[s.round_player_id][s.hole_number - 1] = s.strokes
      }
    }
    return {
      id: activeRound.id,
      courseId: activeRound.course_id,
      courseName: course?.name ?? '',
      pars,
      players,
      scores: scoreMap,
      startedAt: activeRound.started_at,
      holesPlayed: activeRound.holes_played,
      createdBy: activeRound.created_by,
    }
  }, [activeRound, players, courses, scores])

  if (anyLoading || !round) {
    return (
      <ScreenShell bg={FT.forest} dark>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: FT.orange, opacity: 0.8 }} />
        </div>
      </ScreenShell>
    )
  }

  const handleFinish = async () => {
    isFinishingRef.current = true
    await finishRound(activeRound.id)
    go('round', { roundId: activeRound.id, justFinished: true })
  }

  const handleQuit = () => go('home')

  return (
    <LiveScorecardImpl
      key={activeRound.id}
      go={go}
      round={round}
      currentUserId={userId}
      onSubmitScore={submitScore}
      onFinish={handleFinish}
      onQuit={handleQuit}
    />
  )
}
```

- [ ] **Step 2: Add useRoundPlayers import**

At the top of the file, add:
```js
import { useRoundPlayers } from '../hooks/useRoundPlayers'
```

- [ ] **Step 3: Update LiveScorecardImpl**

Replace the `LiveScorecardImpl` function signature and internals. The key changes are:
1. Accept `currentUserId` prop
2. Replace `p.name` with `p.displayName`
3. Stepper shows only when the current user hasn't scored the current hole
4. Round creator can tap other players' score chips for an inline override picker

Replace the opening of `LiveScorecardImpl` and its state/memos:

```jsx
function LiveScorecardImpl({ go, round: r, currentUserId, onSubmitScore, onFinish, onQuit }) {
  const myPlayer = r.players.find((p) => p.userId === currentUserId) ?? r.players[0]
  const isCreator = r.createdBy === currentUserId

  const [hole, setHole] = useState(() => {
    for (let i = 0; i < r.pars.length; i++) {
      if (typeof (r.scores[myPlayer?.id] || [])[i] !== 'number') return i
    }
    return r.pars.length - 1
  })
  const [range, setRange] = useState('low')
  const [showQuit, setShowQuit] = useState(false)
  const [localClears, setLocalClears] = useState(new Set())
  const [inlinePicker, setInlinePicker] = useState(null) // roundPlayerId with picker open

  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const N = r.pars.length
  const par = r.pars[hole]

  const effectiveScores = useMemo(() => {
    const copy = {}
    for (const playerId of Object.keys(r.scores)) {
      copy[playerId] = r.scores[playerId].map((s, idx) =>
        localClears.has(`${playerId}:${idx + 1}`) ? null : s
      )
    }
    return copy
  }, [r.scores, localClears])

  const myScoreThisHole = myPlayer ? (effectiveScores[myPlayer.id] || [])[hole] : null
  const myNeedsScore = typeof myScoreThisHole !== 'number'

  const setScore = (playerId, holeIdx, value) => {
    const player = r.players.find((p) => p.id === playerId)
    if (value === null) {
      setLocalClears((prev) => new Set([...prev, `${playerId}:${holeIdx + 1}`]))
    } else {
      setLocalClears((prev) => {
        const next = new Set(prev); next.delete(`${playerId}:${holeIdx + 1}`); return next
      })
      onSubmitScore(playerId, player?.userId ?? null, holeIdx + 1, value)
    }
    setInlinePicker(null)
  }

  const tapStroke = (n) => {
    if (!myPlayer || !myNeedsScore) return
    setScore(myPlayer.id, hole, n)
    const myScoresAfter = { ...effectiveScores, [myPlayer.id]: effectiveScores[myPlayer.id].map((s, i) => i === hole ? n : s) }
    // Advance hole when all players scored (best-effort; others may arrive via Realtime)
    const allMyHolesDone = r.players.every((p) =>
      p.id === myPlayer.id ? true : typeof effectiveScores[p.id]?.[hole] === 'number'
    )
    if (allMyHolesDone) {
      if (hole < N - 1) {
        const holeAtTap = hole
        setTimeout(() => setHole((h) => (h === holeAtTap ? h + 1 : h)), 220)
      }
    }
  }

  const tapOverride = (roundPlayerId, n) => {
    setScore(roundPlayerId, hole, n)
  }

  const undoLast = () => {
    for (let h = hole; h >= 0; h--) {
      if (myPlayer && typeof effectiveScores[myPlayer.id]?.[h] === 'number') {
        setScore(myPlayer.id, h, null)
        if (h < hole) setHole(h)
        return
      }
    }
  }

  const quit = () => { setShowQuit(false); onQuit() }
  const nums = range === 'low' ? [1, 2, 3, 4, 5, 6] : [7, 8, 9, 10, 11, 12]
```

- [ ] **Step 4: Update player card rendering in LiveScorecardImpl**

Find the section where player cards are rendered (`r.players.map((p) => {`). Replace the card content to:
1. Use `p.displayName` instead of `p.name`
2. Mark the current user's card
3. Show inline override picker for the round creator

```jsx
          {r.players.map((p) => {
            const score = effectiveScores[p.id][hole]
            const hasScore = typeof score === 'number'
            const isMe = p.id === myPlayer?.id
            const pickerOpen = inlinePicker === p.id
            const rEff = { ...r, scores: effectiveScores }
            const total = playerTotal(rEff, p.id)
            const vs = playerVsPar(rEff, p.id)
            const through = (effectiveScores[p.id] || []).filter((s) => typeof s === 'number').length
            return (
              <div key={p.id}>
                {/* Inline override picker for round creator, non-self players */}
                {pickerOpen && isCreator && !isMe && (
                  <div style={{
                    background: FT.cream, borderRadius: 16, padding: '10px 12px 12px',
                    marginBottom: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: FT.dim, marginBottom: 6 }}>
                      {p.displayName.toUpperCase()} — HOLE {hole + 1}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5 }}>
                      {[1,2,3,4,5,6,7,8,9].map((n) => {
                        const tone = n - par
                        const bg = tone < 0 ? FT.orange : tone === 0 ? FT.forest : tone === 1 ? 'rgba(42,31,23,0.85)' : FT.bark
                        const fg = tone < 0 ? FT.ink : FT.cream
                        return (
                          <button key={n} onClick={() => tapOverride(p.id, n)} style={{
                            height: 44, borderRadius: 12, border: 'none',
                            background: bg, color: fg,
                            fontFamily: SFR, fontWeight: 900, fontSize: 20,
                          }}>{n}</button>
                        )
                      })}
                    </div>
                  </div>
                )}
                <div style={{
                  background: isMe
                    ? (myNeedsScore ? FT.cream : 'rgba(244,239,228,0.1)')
                    : (hasScore ? 'rgba(244,239,228,0.08)' : 'rgba(244,239,228,0.04)'),
                  color: isMe ? (myNeedsScore ? FT.ink : FT.cream) : FT.cream,
                  borderRadius: 18, padding: '12px 14px',
                  border: isMe ? `2px solid ${myNeedsScore ? FT.orange : 'rgba(244,239,228,0.2)'}` : '2px solid transparent',
                  boxShadow: isMe && myNeedsScore ? '0 8px 24px rgba(0,0,0,0.25)' : 'none',
                  display: 'flex', alignItems: 'center', gap: 12,
                  transition: 'all 180ms ease-out',
                }}>
                  <Avatar name={p.displayName} color={p.color} size={40} fontSize={13} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: SFR, fontWeight: 800, fontSize: 16, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>{p.displayName}</span>
                      {isMe && <span style={{ fontSize: 9, fontWeight: 800, fontFamily: MONO, letterSpacing: 1, color: FT.orange, background: 'rgba(255,107,31,0.12)', padding: '2px 6px', borderRadius: 5 }}>YOU</span>}
                      {through > 0 && <ParChip value={vs} size="sm" />}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.5, marginTop: 1, fontFamily: MONO, letterSpacing: 0.5 }}>
                      TOTAL {total} · THRU {through}
                    </div>
                  </div>
                  {hasScore ? (
                    <button
                      onClick={() => {
                        if (isMe) { setScore(p.id, hole, null) }
                        else if (isCreator) { setInlinePicker((prev) => prev === p.id ? null : p.id) }
                      }}
                      className="flat"
                      title={isMe ? 'Edit score' : isCreator ? 'Override score' : undefined}
                      style={{
                        width: 44, height: 44, borderRadius: 12, border: 'none',
                        background: score - par <= -1 ? FT.orange : 'rgba(244,239,228,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: SFR, fontWeight: 900, fontSize: 22,
                        color: score - par <= -1 ? FT.ink : FT.cream,
                        cursor: (isMe || isCreator) ? 'pointer' : 'default',
                      }}>{score}</button>
                  ) : (
                    <div style={{ fontFamily: SFR, fontWeight: 900, fontSize: 28, color: isMe && myNeedsScore ? FT.orange : 'rgba(244,239,228,0.3)', paddingRight: 4 }}>—</div>
                  )}
                </div>
              </div>
            )
          })}
```

- [ ] **Step 5: Update stepper label in LiveScorecardImpl**

Find the stepper section. Update the label to reflect "your turn" context:

```jsx
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: FT.dim, textTransform: 'uppercase' }}>
            {myNeedsScore ? 'Your turn' : 'Hole locked in'}
          </div>
          <div style={{ fontFamily: SFR, fontWeight: 800, fontSize: 15 }}>
            {myNeedsScore ? 'Tap the strokes' : (hole < N - 1 ? 'Next hole →' : 'Final hole — finish up')}
          </div>
```

And the stepper buttons — disable them when it's not your turn:

Change the `disabled` condition on each number button from `!activePlayer` to `!myNeedsScore`:
```jsx
const disabled = !myNeedsScore
```

- [ ] **Step 6: Run all tests**

```bash
npx vitest run
```

Expected: PASS — screen changes are UI only.

- [ ] **Step 7: Commit**

```bash
git add src/screens/LiveScorecardScreen.jsx
git commit -m "feat: LiveScorecardScreen multi-player — useRoundPlayers, YOU tag, scorekeeper override"
```

---

## Task 14: HomeScreen — Player Avatars

**Files:**
- Modify: `src/screens/HomeScreen.jsx`

Context: Active round card shows stacked avatars for all `round_players`. Recent rounds show player count.

- [ ] **Step 1: Add useRoundPlayers to HomeScreen**

In `src/screens/HomeScreen.jsx`, add the import:
```js
import { useRoundPlayers } from '../hooks/useRoundPlayers'
```

Add the hook call inside `HomeScreen`:
```js
const { players: activePlayers } = useRoundPlayers(activeRound?.id)
```

- [ ] **Step 2: Update the active round card to show player avatars**

Find the active round resume card (the button that calls `go('live')`). Inside the card, add player avatars below the course/hole info. Find the div with `Hole {Math.min(...)} of {activeCourse?.holes || '?'}` and add after it:

```jsx
              {activePlayers.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
                  {activePlayers.slice(0, 4).map((p, i) => (
                    <div key={p.id} style={{ marginLeft: i ? -6 : 0 }}>
                      <Avatar name={p.displayName} color={p.color} size={20} fontSize={7} border={`1.5px solid ${FT.bark}`} />
                    </div>
                  ))}
                  {activePlayers.length > 4 && (
                    <div style={{ marginLeft: 4, fontSize: 10, color: 'rgba(244,239,228,0.5)', fontFamily: MONO }}>+{activePlayers.length - 4}</div>
                  )}
                </div>
              )}
```

- [ ] **Step 3: Run tests and commit**

```bash
npx vitest run
git add src/screens/HomeScreen.jsx
git commit -m "feat: HomeScreen shows player avatars in active round card"
```

---

## Task 15: RoundDetailScreen — Wire Multi-Player Data

**Files:**
- Modify: `src/screens/RoundDetailScreen.jsx`

Context: `RoundDetailScreen` builds a round object using `useProfile` for the single player. Update it to use `useRoundPlayers` instead, so the round's `players` array reflects all participants.

- [ ] **Step 1: Add useRoundPlayers import and usage**

In `src/screens/RoundDetailScreen.jsx`, add import:
```js
import { useRoundPlayers } from '../hooks/useRoundPlayers'
```

Inside `RoundDetailScreen`, add the hook:
```js
const { players, loading: playersLoading } = useRoundPlayers(params?.roundId)
```

Update `anyLoading` to include `playersLoading`:
```js
const anyLoading = roundsLoading || playersLoading || coursesLoading
```

- [ ] **Step 2: Update round assembly to use players from round_players**

Find where `round` is assembled (the useMemo). Update the `players` field and score mapping:

```js
  const round = useMemo(() => {
    if (!rawRound || !course || players.length === 0) return null
    const pars = course.pars ?? []
    const scoreMap = {}
    for (const p of players) scoreMap[p.id] = Array(pars.length).fill(null)
    for (const s of scores) {
      if (s.round_player_id && scoreMap[s.round_player_id]) {
        scoreMap[s.round_player_id][s.hole_number - 1] = s.strokes
      }
    }
    return {
      id: rawRound.id,
      courseId: rawRound.course_id,
      courseName: course.name,
      pars,
      players,
      scores: scoreMap,
      completedAt: rawRound.finished_at,
      status: rawRound.status,
      created_by: rawRound.created_by,
    }
  }, [rawRound, course, players, scores])
```

- [ ] **Step 3: Fix p.name → p.displayName and remove useProfile dependency**

In `RoundDetailScreen` (the data wrapper):
- Remove `useProfile` import and hook call — `profile` is no longer used once players come from `useRoundPlayers`
- Remove `profileLoading` from `anyLoading`

In `RoundDetailImpl`, replace all `p.name`, `player.name`, and `winner.name` with `p.displayName`, `player.displayName`, `winner.displayName` respectively. There are 5 occurrences around lines 182, 184, 236, 261, 263.

- [ ] **Step 4: Run all tests**

```bash
npx vitest run
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/RoundDetailScreen.jsx
git commit -m "feat: RoundDetailScreen uses useRoundPlayers for multi-player data"
```

---

## Final Verification

- [ ] **Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors. Fix any remaining `p.name` → `p.displayName` or old signature mismatches.

- [ ] **Manual smoke test**

1. Apply DB migration in Supabase dashboard
2. `npm run dev`
3. Start a round — verify you can add friends and a guest player
4. Open the live scorecard — verify "YOU" tag on your row, stepper only for you
5. Send a friend request to another test account — verify it appears in Requests tab
6. Accept a request — verify friend appears in Friends tab

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: multi-player rounds complete — friends, round_players, Realtime scoring"
```
