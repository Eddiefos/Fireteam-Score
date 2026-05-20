-- supabase/migrations/20260520000003_official_courses.sql

-- 1. Add is_admin to profiles
alter table profiles add column if not exists is_admin boolean not null default false;

-- 2. Update courses source check: rename 'pdga' to 'official' for new rows
--    (existing rows, if any, are treated the same way — just update the allowed values)
--    No constraint to add/drop since source is free text in the original schema.
--    Add an explicit check constraint so the DB enforces the enum.
alter table courses
  add constraint courses_source_check
  check (source in ('official', 'user'));

-- 3. Tighten RLS on courses:
--    official courses are readable by all but only writable by service_role (seed script)
--    user courses are only writable by their creator
drop policy if exists "Users can create courses" on courses;
drop policy if exists "Creators can update their own courses" on courses;

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
