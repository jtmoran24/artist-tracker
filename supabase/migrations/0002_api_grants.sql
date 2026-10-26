-- Newer Supabase projects don't auto-grant the API roles access to tables
-- created via SQL, so PostgREST hides them (PGRST205). Grant explicitly;
-- RLS (enabled on every table) still decides which rows anon/authenticated see.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;

notify pgrst, 'reload schema';
