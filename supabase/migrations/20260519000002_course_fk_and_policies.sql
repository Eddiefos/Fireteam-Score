-- Fix FK: allow course deletion even when rounds reference it
alter table rounds drop constraint if exists rounds_course_id_fkey;
alter table rounds add constraint rounds_course_id_fkey
  foreign key (course_id) references courses(id) on delete set null;

-- Ensure courses DELETE policy exists
drop policy if exists "Creators can delete their own courses" on courses;
create policy "Creators can delete their own courses" on courses for delete
  using (auth.uid() = created_by);

-- Ensure course_holes has full CRUD policies for the course creator
drop policy if exists "Creators can delete course holes" on course_holes;
create policy "Creators can delete course holes" on course_holes for delete
  using (exists (select 1 from courses where id = course_id and created_by = auth.uid()));

drop policy if exists "Creators can insert course holes" on course_holes;
create policy "Creators can insert course holes" on course_holes for insert
  with check (exists (select 1 from courses where id = course_id and created_by = auth.uid()));

drop policy if exists "Creators can update course holes" on course_holes;
create policy "Creators can update course holes" on course_holes for update
  using (exists (select 1 from courses where id = course_id and created_by = auth.uid()));

drop policy if exists "Course holes are readable with course" on course_holes;
create policy "Course holes are readable with course" on course_holes for select
  using (exists (select 1 from courses where id = course_id and (is_public = true or created_by = auth.uid())));
