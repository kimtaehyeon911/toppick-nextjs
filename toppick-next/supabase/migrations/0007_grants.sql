-- ============================================================
-- 0007: table-level grants
--
-- Supabase's default grants are wiped by `drop schema public cascade`.
-- RLS policies alone are not enough: PostgREST checks table privileges
-- FIRST, so a missing grant surfaces as 42501 / HTTP 403 even when the
-- policy would have allowed the row.
--
-- Role mapping (important):
--   anon          = visitor with NO session
--   authenticated = signed-in user, INCLUDING anonymous sign-ins
--                   (JWT: role=authenticated, is_anonymous=true)
--   service_role  = worker / edge functions (bypasses RLS by design)
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

-- read: everything public is readable; RLS narrows the rows
grant select on all tables in schema public to anon, authenticated;

-- write: signed-in users only (RLS enforces auth.uid() = user_id)
grant insert, update on public.picks      to authenticated;
grant insert         on public.posts      to authenticated;
grant insert         on public.star_picks to authenticated;
grant insert, update on public.profiles   to authenticated;

grant usage, select on all sequences in schema public to anon, authenticated;

-- worker / edge functions
grant all on all tables     in schema public to service_role;
grant all on all sequences  in schema public to service_role;
grant all on all functions  in schema public to service_role;

-- keep future objects working without re-running this file
alter default privileges in schema public grant all on tables    to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;