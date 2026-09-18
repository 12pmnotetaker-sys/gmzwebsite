-- What the database's own advisors asked for, and what the portal's tables
-- lacked: a locked search path on the reference generator, an index under
-- every foreign key, and a sweep of the rows that only ever grow.
--
-- Decided and not done here: `citext` stays in the public schema. Moving it
-- means altering every email column that uses the type, for an extension
-- that adds no table and no function a client could reach. Recorded so the
-- advisor's warning is a known one, not a forgotten one.

-- ---------------------------------------------------------------------------
-- 1. The reference generator resolves its names with an empty search path,
--    so a role that can create objects cannot put a `portal_request_seq` of
--    its own in front of the real one.
-- ---------------------------------------------------------------------------

create or replace function public.portal_next_reference() returns text
language sql volatile set search_path = '' as $$
  select 'R-' || to_char(now(), 'YYYY') || '-' ||
    case when nextval('public.portal_request_seq') < 10000
      then lpad(currval('public.portal_request_seq')::text, 4, '0')
      else currval('public.portal_request_seq')::text
    end;
$$;

-- ---------------------------------------------------------------------------
-- 2. An index under every foreign key the advisor found bare. A delete on
--    the referenced side otherwise scans the referencing table.
-- ---------------------------------------------------------------------------

create index if not exists access_grants_client_idx on portal.access_grants (client_id);
create index if not exists access_grants_created_by_idx on portal.access_grants (created_by);
create index if not exists access_grants_project_idx on portal.access_grants (project_id);
create index if not exists contact_client_access_client_idx on portal.contact_client_access (client_id);
create index if not exists admin_visits_author_idx on public.admin_visits (author_id);
create index if not exists admin_visits_client_idx on public.admin_visits (client_id);
create index if not exists gmz_operations_admins_scope_idx on public.gmz_operations_admins (scope);
create index if not exists gmz_operations_clients_client_idx on public.gmz_operations_clients (client_id);
create index if not exists gmz_operations_properties_client_idx on public.gmz_operations_properties (client_id);
create index if not exists gmz_portal_announcements_scope_idx on public.gmz_portal_announcements (scope);
create index if not exists gmz_portal_reports_property_idx on public.gmz_portal_reports (scope, property_id);

-- ---------------------------------------------------------------------------
-- 3. The sweep. Three tables gain a row per event and lose none: a link
--    asked for, a browser signed in, a password guessed. None of it is
--    needed once it has expired, with one exception: an expired link still
--    identifies its client so the recovery screen can offer a new one to the
--    same address, so links are kept a month past their expiry and then go.
-- ---------------------------------------------------------------------------

create or replace function public.portal_sweep_expired() returns void
language sql volatile set search_path = '' as $$
  delete from public.portal_sign_in_tokens where expires_at < now() - interval '30 days';
  delete from public.portal_sessions where expires_at < now();
  delete from public.portal_password_attempts where attempted_at < now() - interval '1 day';
$$;
revoke all on function public.portal_sweep_expired() from public, anon, authenticated;

-- Nightly, from inside the database, so no server has to remember. Where
-- pg_cron cannot be enabled (a plain Postgres without it) the function still
-- exists and the sweep is simply not scheduled; the notice says so.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron is not available here, so portal_sweep_expired() is not scheduled: %', sqlerrm;
    return;
  end;
  perform cron.schedule('portal-sweep-expired', '17 10 * * *', 'select public.portal_sweep_expired()');
end $$;
