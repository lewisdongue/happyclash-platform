-- Short-lived tickets that let the import-asset Edge Function copy a 3D model
-- from Sketchfab into the public assets bucket. Created by the team, never by clients.
create table public.asset_import_tickets (
  token text primary key,
  expires_at timestamptz not null default now() + interval '20 minutes'
);
alter table public.asset_import_tickets enable row level security;
grant select on public.asset_import_tickets to service_role;
