-- Recorded from the live project's migration history; see
-- 20260826173624_phase0_identity_spine.sql.

-- Anonymous sessions get nothing at all. There is no public read surface.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
revoke usage on schema public from anon;

-- Signed-in sessions reach public tables, and RLS decides what they see.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.clients, public.client_contacts,
      public.properties, public.projects to authenticated;

-- The access-control schema is reachable only for the three predicate functions.
revoke all on schema portal from anon, authenticated;
revoke all on all tables in schema portal from anon, authenticated;
grant usage on schema portal to authenticated;
grant execute on function portal.is_staff()            to authenticated;
grant execute on function portal.visible_client_ids()  to authenticated;
grant execute on function portal.project_scope()       to authenticated;
grant select on portal.staff, portal.portal_users, portal.audit_log to authenticated;

-- The internal schema is reachable by nobody through the API.
revoke all on schema internal from anon, authenticated;
revoke all on all tables in schema internal from anon, authenticated;

-- Future tables inherit the same posture rather than the Supabase default.
alter default privileges in schema public  revoke all on tables from anon;
alter default privileges in schema portal  revoke all on tables from anon, authenticated;
alter default privileges in schema internal revoke all on tables from anon, authenticated;
