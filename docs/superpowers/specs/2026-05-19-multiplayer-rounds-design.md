# Multi-Player Rounds Design

## Goal

Enable disc golf rounds with multiple players — registered users and guests — where one person can score for everyone (scorekeeper mode) and registered players can also enter their own strokes live on their own devices. Add a friends system so players are easy to find and re-add.

---

## Scope

This spec covers:
- Mutual friend relationships (send/accept/decline requests)
- Multi-player round setup (player picker in StartRoundScreen)
- Multi-player live scoring with Supabase Realtime sync
- Squad screen rewrite (friends + requests tabs)
- Stats now populated with real multi-player data

**Out of scope (deferred):**
- Fireteam Hub — saved named groups for leaderboard/rivalry stats (separate spec)
- Push notifications for friend requests
- Removing a player from an active round mid-game

---

## Key Decisions

| Decision | Rationale |
|---|---|
| Rounds are ad-hoc — not tied to a saved group | Simpler; you pick players fresh each round |
| Guests supported with just a name | Quick games shouldn't require everyone to sign up |
| Mutual friend requests | Prevents spam; both sides opt in |
| Each player enters own score on their device | Natural multi-device flow; scorekeeper can still override |
| Realtime via Supabase subscription | All devices see scores update live without polling |
| Only round creator sees Finish button | One person controls when the round ends |
| Stats keyed by `round_player_id` → `profiles.id` | Registered players accumulate history; guests do not |

---

## Data Model

### New table: `friends`

```sql
create table friends (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid references profiles(id) on delete cascade,
  addressee_id uuid references profiles(id) on delete cascade,
  status       text default 'pending', -- 'pending' | 'accepted' | 'declined'
  created_at   timestamptz default now(),
  unique (requester_id, addressee_id)
);

alter table friends enable row level security;

-- Each user sees only rows where they are a participant
create policy "Users see their own friend rows" on friends for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Anyone can send a friend request
create policy "Users can send friend requests" on friends for insert
  with check (auth.uid() = requester_id);

-- Only the addressee can accept or decline
create policy "Addressee can update status" on friends for update
  using (auth.uid() = addressee_id);

-- Either party can delete (unfriend / cancel)
create policy "Participants can delete" on friends for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
```

### New table: `round_players`

```sql
create table round_players (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid references rounds(id) on delete cascade,
  user_id      uuid references profiles(id) on delete set null, -- null for guests
  guest_name   text,    -- set for guests, null for registered users
  display_name text not null,  -- cached at round start
  initials     text not null,
  color        text not null,  -- avatar colour assigned at round start
  is_guest     boolean default false,
  created_at   timestamptz default now(),
  check (user_id is not null or guest_name is not null)
);

alter table round_players enable row level security;

-- Anyone in the round can see all players in that round
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

-- Only the round creator can add players
create policy "Round creator can add players" on round_players for insert
  with check (
    exists (
      select 1 from rounds r
      where r.id = round_id and r.created_by = auth.uid()
    )
  );
```

### Changes to `scores`

Add `round_player_id` as the canonical player identifier. `user_id` stays for registered players (used by stats and RLS) but becomes nullable for guest scores.

```sql
alter table scores
  add column round_player_id uuid references round_players(id) on delete cascade,
  alter column user_id drop not null;

-- New unique constraint (replaces old one)
alter table scores drop constraint scores_round_id_user_id_hole_number_key;
alter table scores add constraint scores_round_player_hole_unique
  unique (round_id, round_player_id, hole_number);

-- Updated RLS: own score OR scorekeeper
drop policy "Players write own scores" on scores;

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

-- Read: any registered player in the round can read all scores
create policy "Round participants can read scores" on scores for select
  using (
    exists (
      select 1 from round_players rp
      where rp.round_id = scores.round_id
        and rp.user_id = auth.uid()
    )
    or auth.uid() = (select created_by from rounds where id = round_id)
  );
```

---

## Service Layer

### New: `src/services/friends.ts`

```ts
getFriends(userId): Promise<Friend[]>
  // Returns accepted friends (as either requester or addressee)
  // Returns profile data for the other person

getPendingRequests(userId): Promise<FriendRequest[]>
  // Incoming: status='pending', addressee=userId
  // Returns profile of requester

getSentRequests(userId): Promise<FriendRequest[]>
  // Outgoing: status='pending', requester=userId

searchUsers(query: string, currentUserId: string): Promise<Profile[]>
  // ilike on username, exclude self and existing friends

sendFriendRequest(requesterId: string, addresseeId: string): Promise<void>

acceptRequest(requestId: string): Promise<void>
  // update status → 'accepted'

declineRequest(requestId: string): Promise<void>
  // update status → 'declined'

cancelRequest(requestId: string): Promise<void>
  // delete row (requester cancels sent request)

removeFriend(requestId: string): Promise<void>
  // delete row (unfriend)
```

### New: `src/services/roundPlayers.ts`

```ts
addRoundPlayer(roundId: string, player: {
  userId?: string
  guestName?: string
  displayName: string
  initials: string
  color: string
  isGuest: boolean
}): Promise<RoundPlayer>

getRoundPlayers(roundId: string): Promise<RoundPlayer[]>
```

### Changes to `src/services/rounds.ts`

`startRound` now accepts a `players` array and inserts into `round_players` after creating the round.

```ts
startRound(courseId: string, userId: string, players: NewRoundPlayer[]): Promise<Round>
```

### Changes to `src/services/scores.ts`

`submitScore` now takes `roundPlayerId` instead of `userId`:

```ts
submitScore(roundId: string, roundPlayerId: string, userId: string | null, holeNumber: number, strokes: number): Promise<void>
```

---

## Hook Layer

### New: `src/hooks/useFriends.ts`

```ts
useFriends(userId): {
  friends: Friend[]           // accepted
  pendingRequests: FriendRequest[]  // incoming
  sentRequests: FriendRequest[]     // outgoing
  loading: boolean
  sendRequest(addresseeId): Promise<void>
  acceptRequest(requestId): Promise<void>
  declineRequest(requestId): Promise<void>
  cancelRequest(requestId): Promise<void>
  searchUsers(query): Promise<Profile[]>
}
```

### New: `src/hooks/useRoundPlayers.ts`

```ts
useRoundPlayers(roundId): {
  players: RoundPlayer[]
  loading: boolean
}
```

### Changes to `src/hooks/useRounds.ts`

`startRound` passes the players array through to the service.

### Changes to `src/hooks/useScores.ts`

`submitScore` signature updated to include `roundPlayerId`. Realtime subscription added:

```ts
useScores(roundId, currentRoundPlayerId): {
  scores: Score[]
  loading: boolean
  submitScore(roundPlayerId, userId, holeNumber, strokes): Promise<void>
  // Supabase Realtime subscription on scores INSERT/UPDATE for this roundId
}
```

---

## New Types (`src/types/index.ts`)

```ts
type Friend = {
  id: string           // friends.id
  userId: string       // the other person's profile id
  displayName: string
  username: string
  initials: string
  avatarColor: string
  roundsTogether: number  // computed from rounds history
  avgVsPar: number | null // computed from shared rounds
}

type FriendRequest = {
  id: string
  requesterId: string
  addresseeId: string
  status: 'pending' | 'accepted' | 'declined'
  profile: Profile     // the other person's profile
  createdAt: string
}

type RoundPlayer = {
  id: string           // round_players.id — used as score key
  roundId: string
  userId: string | null
  guestName: string | null
  displayName: string
  initials: string
  color: string
  isGuest: boolean
}
```

---

## Screen Changes

### SquadScreen (`src/screens/AuthScreens.jsx` → extract to `src/screens/SquadScreen.jsx`)

Extracted from AuthScreens into its own file. Two tabs:

**Friends tab:**
- Search bar at top (username search, debounced, min 2 chars)
- Friends listed with avatar, display name, username, rounds-together count, avg vs par chip
- Tap a friend row → no action yet (Fireteam Hub will add head-to-head drill-down later)
- No friends state: "Find your crew — search for players by username above"

**Requests tab (badge shows pending count):**
- Incoming requests: avatar, name, username, Accept / Decline buttons
- Sent requests section below: greyed out, Cancel button
- No pending state: empty message

### StartRoundScreen (`src/screens/StartRoundScreen.jsx`)

New **Players section** below the course picker:

- You are pre-added and shown as the first chip (not removable)
- Friends list loads from `useFriends` — shown as rows with `+` button
- Recent players section: last 10 unique registered players from `round_players` for this user's rounds
- "Add guest" row: tapping opens an inline name input, assigns the next available colour from `PLAYER_COLORS`, adds to the list
- Added players shown as removable chips at the top of the section (except yourself)
- Player colours assigned sequentially from `PLAYER_COLORS` constant

### LiveScorecardScreen (`src/screens/LiveScorecardScreen.jsx`)

- `useRoundPlayers(activeRound.id)` replaces the single-player `players` array
- `useScores` upgraded with Realtime subscription
- Round object assembly uses `round_players` rows for `players`
- **Your row**: always highlighted (matched by `userId === currentUserId`); stepper at bottom shows for you
- **Other rows**: show live score as it comes in via Realtime; tapping their score chip opens a small inline number picker (scorekeeper override)
- **Inline picker**: appears as a compact row of number buttons (1–9) above the tapped player card; only the round creator sees this
- Round auto-finishes when all players have entered all holes, or creator taps Finish
- Only the round creator sees the Finish / Abandon buttons

### RoundDetailScreen (`src/screens/RoundDetailScreen.jsx`)

- `useRoundPlayers(params.roundId)` provides the `players` array
- Already has multi-player leaderboard and scorecard table UI from the original design — this just wires it up with real data

### HomeScreen (`src/screens/HomeScreen.jsx`)

- Active round card shows player avatars for all `round_players` in the active round (up to 4, then +N)
- Recent rounds show player count ("3 players")

---

## Realtime Strategy

`useScores` subscribes to `postgres_changes` on the `scores` table filtered by `round_id`:

```ts
supabase
  .channel(`scores:${roundId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'scores',
    filter: `round_id=eq.${roundId}`
  }, (payload) => {
    // Upsert into local scores state by round_player_id + hole_number
  })
  .subscribe()
```

Cleanup: channel is removed when `useScores` unmounts or `roundId` changes.

Conflict handling: if the same score arrives from both the optimistic update and the Realtime event, the upsert logic deduplicates by `round_player_id + hole_number` — last write wins.

---

## Error Handling

- Friend request to someone who already sent you a request: show "They already sent you a request — check your Requests tab"
- Duplicate friend request: Supabase unique constraint error → show "Already sent"
- Score submit failure (offline): falls back to existing IndexedDB queue (unchanged)
- Realtime subscription lost: silent reconnect via Supabase client; no user-visible error

---

## Stats Impact

`computePlayerStats` in `gameLogic.ts` is unchanged. It iterates `round.players` and aggregates scores. Once `useRounds` returns rounds with a real `players` array sourced from `round_players`, all stats (avg vs par, birdies, wins, head-to-head) populate automatically for registered players. Guest players are excluded from stats (no persistent identity).
