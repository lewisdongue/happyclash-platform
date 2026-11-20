-- Each table's row is read only through its own columns.
create or replace function public.bump_comment_counters()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  entry uuid;
  changed uuid;
begin
  if tg_table_name = 'comment_likes' then
    changed := case when tg_op = 'INSERT' then new.comment_id else old.comment_id end;
    update public.comments set likes_count = greatest(0, likes_count + delta)
    where id = changed
    returning entry_id into entry;
  else
    changed := case when tg_op = 'INSERT' then new.id else old.id end;
    entry := case when tg_op = 'INSERT' then new.entry_id else old.entry_id end;
    if (case when tg_op = 'INSERT' then new.parent_id else old.parent_id end) is not null then
      update public.comments set replies_count = greatest(0, replies_count + delta)
      where id = (case when tg_op = 'INSERT' then new.parent_id else old.parent_id end);
    end if;
  end if;
  if entry is not null then
    perform realtime.send(jsonb_build_object('id', changed), 'comment', 'entry:' || entry, false);
  end if;
  return null;
end;
$$;
