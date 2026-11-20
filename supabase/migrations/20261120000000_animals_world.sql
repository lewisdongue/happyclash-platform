-- New Talent World for pet challenges.
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    where c.contype = 'c' and c.connamespace = 'public'::regnamespace
      and pg_get_constraintdef(c.oid) like '%world_id%innovation%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format(
      'alter table %s add constraint %I check (world_id in (''music'',''dance'',''sport'',''comedy'',''art'',''tech'',''lifestyle'',''innovation'',''animals''))',
      r.tbl, r.conname);
  end loop;
end $$;
