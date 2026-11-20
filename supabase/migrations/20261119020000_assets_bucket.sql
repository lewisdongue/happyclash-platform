-- Public bucket for the app's own 3D assets. Only the HappyClash owner account
-- can add or replace files; everyone can read them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assets', 'assets', true, 10485760, array['model/gltf-binary', 'image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy "Owner uploads app assets" on storage.objects for insert to authenticated
  with check (bucket_id = 'assets' and (select auth.uid()) = '1062b53f-9e72-44d0-894c-c3f0938b9022');
create policy "Owner replaces app assets" on storage.objects for update to authenticated
  using (bucket_id = 'assets' and (select auth.uid()) = '1062b53f-9e72-44d0-894c-c3f0938b9022');
create policy "Owner reads app asset rows" on storage.objects for select to authenticated
  using (bucket_id = 'assets' and (select auth.uid()) = '1062b53f-9e72-44d0-894c-c3f0938b9022');
