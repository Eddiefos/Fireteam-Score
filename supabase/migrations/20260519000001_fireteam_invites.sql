create table if not exists fireteam_invites (
  id           uuid primary key default gen_random_uuid(),
  fireteam_id  uuid references fireteams(id) on delete cascade,
  inviter_id   uuid references profiles(id) on delete cascade,
  invitee_id   uuid references profiles(id) on delete cascade,
  status       text default 'pending', -- 'pending' | 'accepted' | 'declined'
  created_at   timestamptz default now(),
  unique (fireteam_id, invitee_id)
);

alter table fireteam_invites enable row level security;

drop policy if exists "Invitee or inviter can see their invites" on fireteam_invites;
create policy "Invitee or inviter can see their invites"
  on fireteam_invites for select
  using (auth.uid() = invitee_id or auth.uid() = inviter_id);

drop policy if exists "Fireteam members can send invites" on fireteam_invites;
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

drop policy if exists "Invitee can update (accept/decline) their invite" on fireteam_invites;
create policy "Invitee can update (accept/decline) their invite"
  on fireteam_invites for update
  using (auth.uid() = invitee_id);
