-- A row returned by INSERT ... RETURNING is checked against the select policy,
-- but helper functions read a snapshot that does not contain it yet.
-- Creators and owners are therefore matched directly on the row.
drop policy "Clashes are visible to the people they are for" on public.clashes;
create policy "Clashes are visible to the people they are for" on public.clashes for select
  using (access = 'public' or creator_id = (select auth.uid()) or public.can_view_clash(id));

drop policy "Public groups and your own groups are visible" on public.groups;
create policy "Public groups and your own groups are visible" on public.groups for select
  using (visibility = 'public' or owner_id = (select auth.uid()) or public.is_group_member(id));
