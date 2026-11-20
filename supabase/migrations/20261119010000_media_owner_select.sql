-- Removing a file goes through a select on its row, so owners need to see their own objects.
create policy "Users see their own media rows" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
