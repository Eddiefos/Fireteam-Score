-- Allow any round participant to delete a round (not just the creator).
-- Needed so players can clean up orphaned rounds created by other users.
drop policy if exists "Round creator can delete" on rounds;

create policy "Round creator or player can delete" on rounds
  for delete using (
    auth.uid() = created_by
    or is_round_player(id)
  );
