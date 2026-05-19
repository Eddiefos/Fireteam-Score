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

-- Replace old unique constraint with round_player_id-based one
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
