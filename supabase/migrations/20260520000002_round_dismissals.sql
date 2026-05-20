-- Per-user round dismissal. Removing a finished round from your history does
-- not affect other participants — the round row and scores are preserved.
create table round_dismissals (
  round_id     uuid references rounds(id) on delete cascade,
  user_id      uuid references profiles(id) on delete cascade,
  dismissed_at timestamptz default now(),
  primary key (round_id, user_id)
);

alter table round_dismissals enable row level security;

create policy "Users manage own dismissals" on round_dismissals
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
