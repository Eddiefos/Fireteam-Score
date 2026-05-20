-- Allow fireteam creator to rename the fireteam
create policy "Creator can update fireteam name" on fireteams for update
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- Allow fireteam creator to remove any member (kick)
create policy "Creator can remove members" on fireteam_members for delete
  using (
    exists (
      select 1 from fireteams
      where id = fireteam_members.fireteam_id and created_by = auth.uid()
    )
  );

-- Allow members to remove themselves (leave)
create policy "Members can leave fireteam" on fireteam_members for delete
  using (user_id = auth.uid());
