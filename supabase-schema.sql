-- Expo Staffing — Supabase schema
--
-- Run this once in your Supabase project's SQL editor to enable real,
-- cross-device sync. Without it, the app falls back to browser-only
-- localStorage (each device sees its own independent copy of the data).
--
-- After running this, set these two environment variables when building
-- the app (e.g. in a .env file, or your host's env config):
--   VITE_SUPABASE_URL=https://<your-project>.supabase.co
--   VITE_SUPABASE_ANON_KEY=<your-project-anon-key>

create table if not exists booth_events (
  id text primary key,
  admin_key text unique not null,
  public_key text unique not null,
  config jsonb not null,
  slots jsonb not null,
  roster jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists booth_events_admin_key_idx on booth_events (admin_key);
create index if not exists booth_events_public_key_idx on booth_events (public_key);

alter table booth_events enable row level security;

-- This app has no user accounts — access is controlled entirely by
-- possession of the admin/public key (the "zero-login" model). These
-- policies allow any request with the anon key to read/write, which
-- matches that model but is not a substitute for real authentication.
-- If you need stronger guarantees, add Supabase Auth and scope these
-- policies to authenticated event owners instead.
create policy "anyone can read events" on booth_events
  for select using (true);

create policy "anyone can create events" on booth_events
  for insert with check (true);

create policy "anyone can update events" on booth_events
  for update using (true);
