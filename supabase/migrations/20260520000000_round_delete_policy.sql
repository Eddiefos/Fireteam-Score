-- Allow the round creator to delete their own rounds.
-- Scores and round_players cascade automatically (ON DELETE CASCADE).
drop policy if exists "Round creator can delete" on rounds;
create policy "Round creator can delete" on rounds
  for delete using (auth.uid() = created_by);
