-- Contains no user data. A singleton marker detects accidental cross-environment wiring.
create table public.app_health (
  id integer primary key default 1 check (id = 1),
  environment text not null check (environment in ('development', 'preview', 'production')),
  schema_version integer not null default 1 check (schema_version = 1)
);
alter table public.app_health enable row level security;
revoke all on table public.app_health from anon, authenticated;
grant select on table public.app_health to anon, authenticated;
create policy "Read public health marker" on public.app_health for select to anon, authenticated using (true);
-- Seed the environment separately; never copy a development marker into production.
