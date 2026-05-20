-- supabase/migrations/20260520000003_official_courses.sql

-- 1. Add is_admin to profiles
alter table profiles add column if not exists is_admin boolean not null default false;

-- 2. Update courses source check: rename 'pdga' / 'udisc_import' to 'official'
--    Migrate any existing rows before adding the enum constraint, otherwise
--    the constraint will hard-fail on databases that already have 'pdga' data.
update courses set source = 'official' where source = 'pdga';
update courses set source = 'official' where source = 'udisc_import';

--    Add an explicit check constraint so the DB enforces the enum going forward.
alter table courses
  drop constraint if exists courses_source_check;
alter table courses
  add constraint courses_source_check
  check (source in ('official', 'user'));

-- 3. Tighten RLS on courses:
--    official courses are readable by all but only writable by service_role (seed script)
--    user courses are only writable by their creator
drop policy if exists "Users can create courses" on courses;
drop policy if exists "Creators can update their own courses" on courses;
drop policy if exists "Creators can delete their own courses" on courses;
drop policy if exists "Users can create user courses" on courses;
drop policy if exists "Creators can update own user courses" on courses;
drop policy if exists "Creators can delete own user courses" on courses;

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

drop policy if exists "Anyone can submit a course" on course_submissions;
drop policy if exists "Submitter can view own submissions" on course_submissions;
drop policy if exists "Admins can view all submissions" on course_submissions;
drop policy if exists "Admins can update submissions" on course_submissions;

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
