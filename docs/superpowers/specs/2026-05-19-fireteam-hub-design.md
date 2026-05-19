# Fireteam Hub — Design Spec
_2026-05-19_

## Overview

A persistent group hub that turns individual multi-player rounds into an ongoing competition narrative. Members see their rivalry records, a group leaderboard, and recent shared rounds — all scoped to their fireteam.

**Constraints:**
- One fireteam per user for now (extensible to multiple later)
- Invite friends directly from the friends list (no invite codes)
- No badges in this phase — deferred
- `fireteams` and `fireteam_members` tables already exist in the DB schema

---

## 1. Navigation

Tab bar becomes 5 tabs: **Home · Friends · Stats · Fireteam · Account**

- "Squad" tab renamed to "Friends" — same screen, same functionality
- "Fireteam" is a new 5th tab
- Badge on Fireteam tab icon when there are pending invites

---

## 2. Fireteam Entry Flow

### No fireteam yet
The Fireteam tab shows an empty state with two actions:
- **Create a fireteam** — name field + Create button → creates the group, you become the first member
- **Pending invites** — if someone has invited you, a card shows: *"[Name] invited you to [Fireteam Name]"* with Accept / Decline

### Creating
Simple modal: fireteam name → "Create". After creation, an "Invite members" button appears. Tapping it opens the friends list with checkboxes. Select friends → "Send invites". Each selected friend sees a badge on their Fireteam tab.

### Joining
Pending invite card on the Fireteam tab empty state. Accept → you're in. Decline → card disappears.

**Constraint:** "Create" is hidden if you're already in a fireteam.

---

## 3. Hub Screen Layout

Once in a fireteam, the Fireteam tab shows three sections top to bottom:

### Rivalry strip (hero)
Horizontal scroll, one card per teammate. Each card shows:
- Teammate avatar + color
- Head-to-head record: "You vs [Name] — 7W / 4L"
- Streak indicator: "3-win streak" (or "on a 2-loss streak")

### Leaderboard
All members ranked by wins (default). Each row: rank, avatar, display name, wins, avg score vs par, rounds played together.

### Recent rounds
Last 5 rounds with `fireteam_id` matching this group. Shows: course name, date, winner name. Tapping navigates to RoundDetailScreen.

---

## 4. Linking Rounds to a Fireteam

`rounds.fireteam_id` is already nullable in the schema. `startRound()` gets a small update: if the round creator is in a fireteam, `fireteam_id` is set automatically on the new round row. No UI change needed in StartRoundScreen.

---

## 5. DB Migration

One new table:

```sql
create table fireteam_invites (
  id           uuid primary key default gen_random_uuid(),
  fireteam_id  uuid references fireteams(id) on delete cascade,
  inviter_id   uuid references profiles(id) on delete cascade,
  invitee_id   uuid references profiles(id) on delete cascade,
  status       text default 'pending', -- 'pending' | 'accepted' | 'declined'
  created_at   timestamptz default now(),
  unique (fireteam_id, invitee_id)
);

alter table fireteam_invites enable row level security;

create policy "Invitee can see their own invites"
  on fireteam_invites for select
  using (auth.uid() = invitee_id or auth.uid() = inviter_id);

create policy "Fireteam members can send invites"
  on fireteam_invites for insert
  with check (
    auth.uid() = inviter_id and
    exists (
      select 1 from fireteam_members
      where fireteam_id = fireteam_invites.fireteam_id
        and user_id = auth.uid()
    )
  );

create policy "Invitee can update (accept/decline) their invite"
  on fireteam_invites for update
  using (auth.uid() = invitee_id);
```

---

## 6. Service Layer

New file: `src/services/fireteams.ts`

```
createFireteam(name, userId)           → Fireteam
getMyFireteam(userId)                  → Fireteam | null
getFireteamMembers(fireteamId)         → Profile[]
inviteToFireteam(fireteamId, inviteeId) → void
getPendingInvites(userId)              → FireteamInvite[]
acceptInvite(inviteId, fireteamId, userId) → void  (inserts into fireteam_members)
declineInvite(inviteId)                → void
getFireteamRounds(fireteamId)          → Round[]
```

Update `src/services/rounds.ts`:
- `startRound(courseId, players, fireteamId?: string)` — sets `fireteam_id` on insert

---

## 7. Hook

New file: `src/hooks/useFireteam.ts`

```ts
useFireteam(userId) → {
  fireteam: Fireteam | null,
  members: Profile[],
  rounds: Round[],
  pendingInvites: FireteamInvite[],
  loading: boolean,
  createFireteam: (name: string) => Promise<void>,
  inviteMember: (inviteeId: string) => Promise<void>,
  acceptInvite: (inviteId: string) => Promise<void>,
  declineInvite: (inviteId: string) => Promise<void>,
}
```

---

## 8. Game Logic

New functions in `src/lib/gameLogic.ts`:

```ts
computeHeadToHead(userId, opponentId, rounds)
  → { wins: number, losses: number, streak: number, streakType: 'win' | 'loss' | null }

computeFireteamLeaderboard(members, rounds)
  → Array<{ profile: Profile, wins: number, avgVsPar: number, roundsPlayed: number }>
```

Both operate on the existing in-memory round assembly pattern (rounds with `players` + `scores` already loaded).

---

## 9. New Screen

`src/screens/FireteamScreen.jsx`

States:
1. **Loading** — spinner
2. **No fireteam, no invites** — empty state, Create button
3. **No fireteam, pending invite** — invite card(s), Create button (disabled if invite pending)
4. **In fireteam** — rivalry strip + leaderboard + recent rounds

App.jsx: add `case 'fireteam'` to the switch, add `'fireteam'` to `TAB_SCREENS`.

---

## 10. Out of Scope

- Multiple fireteams per user
- Badges / achievements
- Fireteam chat
- Leaving or disbanding a fireteam
- Personal Stats screen (still shows zeros — unblocked once fireteam rounds accumulate)
