# Friends Screen Redesign

**Date:** 2026-05-20
**Status:** Approved

---

## Goal

Rename the Squad screen to Friends, add an activity feed showing friends' recent rounds, split the Friends tab into Friends/Requests sub-tabs, and add a friend profile view with a remove friend action.

---

## Screen Structure

```
Friends (heading — was "Squad")
├── [Activity]  [Friends]   ← top-level chip tabs
│
├── Activity tab
│     Grouped by friend. 2 most recent finished rounds per friend.
│     Each round: course name, relative date, holes, score vs par chip.
│     Tapping a friend group → Friend Profile screen.
│
└── Friends tab
      ├── [Friends]  [Requests]   ← underline sub-tabs
      │
      ├── Friends sub-tab
      │     Search bar (find by username)
      │     Friend list: avatar, display name, @username, rounds together, avg vs par chip
      │     Tapping a row → Friend Profile screen
      │
      └── Requests sub-tab
            Orange badge on tab when incoming requests > 0
            INCOMING section: avatar, name, Accept + ✕ buttons
            SENT section: avatar, name, Cancel button (dimmed)
            Empty state if both sections empty
```

---

## Friend Profile Screen

Route: `friendProfile`, params: `{ friendId: string }`

Layout:
1. `‹ Friends` back button (returns to Friends tab)
2. Large avatar + display name + @username
3. Stats row: Rounds together · Avg vs par · W–L vs you
4. `RECENT ROUNDS` section label
5. Last 5 finished rounds: course name, relative date, holes, score chip
6. **Remove Friend** button — destructive red style, requires confirm modal

---

## Data Requirements

### New RLS policy
Friends can read each other's finished rounds:

```sql
create policy "Friends can view finished rounds" on rounds for select
  using (
    status = 'finished' and
    exists (
      select 1 from friends
      where status = 'accepted' and (
        (requester_id = auth.uid() and addressee_id = rounds.created_by)
        or
        (addressee_id = auth.uid() and requester_id = rounds.created_by)
      )
    )
  );
```

Apply in Supabase SQL editor.

### New service function
`getFriendActivity(friendUserId: string): Promise<Round[]>`
- Fetches last 5 finished rounds for a single friend
- Joins course name + scores to compute total vs par
- Same assembly pattern as `getPlayerRoundsWithData`

### Remove friend
Already exists in `src/services/friends.ts` — just needs wiring to a UI button.

---

## Changes Summary

| File | Change |
|---|---|
| `src/screens/SquadScreen.jsx` | Rename heading to "Friends"; replace Friends/Requests tabs with Activity/Friends top chips + Friends/Requests sub-tabs; activity feed |
| `src/services/friends.ts` | Add `getFriendActivity(friendUserId)` |
| `src/screens/FriendProfileScreen.jsx` | New screen — stats, recent rounds, remove friend |
| `src/App.jsx` | Add `friendProfile` route |
| `supabase/migrations/20260520000004_friends_view_rounds.sql` | New RLS policy |

---

## Design Tokens

All existing FT tokens. Score chips follow existing ParChip colour rules:
- Birdie (≤ −1): orange bg, ink text
- Par (E): bark alpha bg, ink text
- Bogey (+1): bark 85% bg, cream text
- Double bogey+: bark bg, cream text
