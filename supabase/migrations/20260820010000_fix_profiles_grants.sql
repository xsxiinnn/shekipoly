begin;

-- Supabase Anonymous Auth requests use the authenticated Postgres role.
-- Keep row ownership enforcement in RLS and expose the table operations that
-- PostgREST needs for INSERT ... ON CONFLICT DO UPDATE (upsert).
alter table public.profiles enable row level security;

revoke insert, update
on table public.profiles
from anon;

grant select, insert, update
on table public.profiles
to authenticated;

commit;
