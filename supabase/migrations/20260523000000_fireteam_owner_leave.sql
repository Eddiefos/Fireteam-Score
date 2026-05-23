-- Allow the fireteam creator to delete the fireteam (when they're the last member)
create policy "Owner can delete fireteam" on fireteams for delete
  using (auth.uid() = created_by);

-- Change rounds.fireteam_id to ON DELETE SET NULL so deleting a fireteam
-- detaches its rounds instead of blocking the delete.
alter table rounds
  drop constraint if exists rounds_fireteam_id_fkey;

alter table rounds
  add constraint rounds_fireteam_id_fkey
    foreign key (fireteam_id) references fireteams(id)
    on delete set null;
