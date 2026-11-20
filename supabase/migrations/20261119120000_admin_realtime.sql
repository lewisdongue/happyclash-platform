-- Live Admin Console: any change a moderator cares about pings the topic
-- `admin`. The ping carries no data; the console reads again through the
-- role-checked functions.

create function public.ping_admin_console()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Counters move on every view and Spark; only moderation changes matter here.
  if tg_op = 'UPDATE' and tg_table_name = 'entries' then
    if new.hidden_at is not distinct from old.hidden_at and new.reports_count is not distinct from old.reports_count then
      return null;
    end if;
  elsif tg_op = 'UPDATE' and tg_table_name = 'profiles' then
    if new.suspended_at is not distinct from old.suspended_at and new.verified is not distinct from old.verified then
      return null;
    end if;
  end if;
  perform realtime.send(jsonb_build_object('table', tg_table_name), 'changed', 'admin', false);
  return null;
end;
$$;
revoke execute on function public.ping_admin_console() from public, anon, authenticated;

create trigger safety_reports_ping_admin after insert or update on public.safety_reports for each statement execute function public.ping_admin_console();
create trigger admin_approvals_ping_admin after insert or update on public.admin_approvals for each statement execute function public.ping_admin_console();
create trigger audit_events_ping_admin after insert on public.audit_events for each statement execute function public.ping_admin_console();
create trigger entries_ping_admin after insert or update or delete on public.entries for each row execute function public.ping_admin_console();
create trigger profiles_ping_admin after insert or update on public.profiles for each row execute function public.ping_admin_console();
create trigger clashes_ping_admin after insert or update or delete on public.clashes for each statement execute function public.ping_admin_console();
create trigger groups_ping_admin after insert or delete on public.groups for each statement execute function public.ping_admin_console();
