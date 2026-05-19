-- Fireteam Score — full database schema
-- Run this in: Supabase dashboard → SQL Editor → New query → paste → Run

-- ─── profiles ───────────────────────────────────────────────────────────────
create table profiles (
  id           uuid primary key references auth.users on delete cascade,
  username     text unique not null,
  display_name text not null,
  initials     text not null,
  avatar_color text not null default '#FF6B1F',
  created_at   timestamptz default now()
);

alter table profiles enable row level security;
create policy "Users can read all profiles"  on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, initials)
  values (
    new.id,
    split_part(new.email, '@', 1),
    split_part(new.email, '@', 1),
    upper(left(split_part(new.email, '@', 1), 2))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── fireteams ───────────────────────────────────────────────────────────────
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

alter table fireteams enable row level security;
alter table fireteam_members enable row level security;

create policy "Members can view their fireteams" on fireteams for select
  using (exists (
    select 1 from fireteam_members
    where fireteam_id = fireteams.id and user_id = auth.uid()
  ));
create policy "Users can create fireteams" on fireteams for insert
  with check (auth.uid() = created_by);

create policy "Members can view fireteam members" on fireteam_members for select
  using (exists (
    select 1 from fireteam_members fm
    where fm.fireteam_id = fireteam_members.fireteam_id and fm.user_id = auth.uid()
  ));
create policy "Users can join fireteams" on fireteam_members for insert
  with check (auth.uid() = user_id);

-- ─── courses ─────────────────────────────────────────────────────────────────
create table courses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text,
  lat         numeric(9,6),
  lng         numeric(9,6),
  holes       int not null default 18,
  par_total   int,
  source      text default 'user',
  pdga_id     text unique,
  created_by  uuid references profiles(id) on delete set null,
  is_public   boolean default true,
  created_at  timestamptz default now()
);

create table course_holes (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid references courses(id) on delete cascade,
  hole_number int not null,
  par         int not null default 3,
  distance_ft int,
  distance_m  int,
  unique (course_id, hole_number)
);

alter table courses enable row level security;
alter table course_holes enable row level security;

create policy "Public courses readable by all" on courses for select
  using (is_public = true or created_by = auth.uid());
create policy "Users can create courses" on courses for insert
  with check (auth.uid() = created_by);
create policy "Creators can update courses" on courses for update
  using (auth.uid() = created_by);

create policy "Course holes readable with course" on course_holes for select
  using (exists (
    select 1 from courses
    where id = course_holes.course_id
    and (is_public = true or created_by = auth.uid())
  ));

-- ─── rounds ──────────────────────────────────────────────────────────────────
create table rounds (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid references courses(id),
  fireteam_id  uuid references fireteams(id),
  started_at   timestamptz default now(),
  finished_at  timestamptz,
  status       text default 'active',
  holes_played int default 0,
  created_by   uuid references profiles(id)
);

alter table rounds enable row level security;

create policy "Fireteam members can view rounds" on rounds for select
  using (exists (
    select 1 from fireteam_members
    where fireteam_id = rounds.fireteam_id and user_id = auth.uid()
  ));
create policy "Fireteam members can create rounds" on rounds for insert
  with check (exists (
    select 1 from fireteam_members
    where fireteam_id = rounds.fireteam_id and user_id = auth.uid()
  ));
create policy "Fireteam members can update rounds" on rounds for update
  using (exists (
    select 1 from fireteam_members
    where fireteam_id = rounds.fireteam_id and user_id = auth.uid()
  ));

-- ─── scores ──────────────────────────────────────────────────────────────────
create table scores (
  id          uuid primary key default gen_random_uuid(),
  round_id    uuid references rounds(id) on delete cascade,
  user_id     uuid references profiles(id) on delete cascade,
  hole_number int not null,
  strokes     int not null,
  created_at  timestamptz default now(),
  unique (round_id, user_id, hole_number)
);

alter table scores enable row level security;

create policy "Fireteam members can read scores" on scores for select
  using (exists (
    select 1 from rounds r
    join fireteam_members fm on fm.fireteam_id = r.fireteam_id
    where r.id = scores.round_id and fm.user_id = auth.uid()
  ));
create policy "Players write own scores" on scores for insert
  with check (auth.uid() = user_id);
create policy "Players update own scores" on scores for update
  using (auth.uid() = user_id);

-- ─── saved_courses ────────────────────────────────────────────────────────────
create table saved_courses (
  user_id    uuid references profiles(id) on delete cascade,
  course_id  uuid references courses(id) on delete cascade,
  saved_at   timestamptz default now(),
  primary key (user_id, course_id)
);

alter table saved_courses enable row level security;
create policy "Users can manage own saved courses" on saved_courses for all
  using (auth.uid() = user_id);
