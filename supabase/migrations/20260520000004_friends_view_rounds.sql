-- Allow accepted friends to view each other's finished rounds
create policy "Friends can view finished rounds" on rounds for select
  using (
    status = 'finished' and
    exists (
      select 1 from friends
      where status = 'accepted' and (
        (requester_id = auth.uid() and addressee_id = rounds.created_by)
        or
        (addressee_id = auth.uid() and requester_id = rounds.created_by)
      )
    )
  );
