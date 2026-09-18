-- The access model: two doors, one session, one predicate.
--
-- Recorded from the live project's migration history; see
-- 20260826173624_phase0_identity_spine.sql.

-- Is this session a member of staff?
create or replace function portal.is_staff()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from portal.staff s
    where s.user_id = auth.uid() and s.active
  );
$$;

-- Which clients may this session see? Resolves auth.uid() to a contact, then to grants.
create or replace function portal.visible_client_ids()
returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct a.client_id), '{}'::uuid[])
  from portal.portal_users u
  join portal.contact_client_access a on a.contact_id = u.contact_id
  join public.client_contacts c on c.id = u.contact_id and c.portal_enabled
  where u.user_id = auth.uid();
$$;

-- If this session arrived on a link scoped to one project, which one? Null means unrestricted.
create or replace function portal.project_scope()
returns uuid
language sql stable security definer set search_path = '' as $$
  select nullif(coalesce(auth.jwt() -> 'app_metadata' -> 'gmz' ->> 'project_scope', ''), '')::uuid;
$$;

comment on function portal.visible_client_ids is 'The second clause of every client-facing policy. Written once.';
comment on function portal.project_scope is 'Set in app_metadata when an emailed link is redeemed, so a link opens one project and an account login sees everything that client owns.';

-- ---------- deny by default, everywhere, before any data lands ----------
alter table public.clients            enable row level security;
alter table public.client_contacts    enable row level security;
alter table public.properties         enable row level security;
alter table public.projects           enable row level security;
alter table portal.staff              enable row level security;
alter table portal.portal_users       enable row level security;
alter table portal.contact_client_access enable row level security;
alter table portal.access_grants      enable row level security;
alter table portal.audit_log          enable row level security;
alter table internal.site_access      enable row level security;

alter table public.clients            force row level security;
alter table public.client_contacts    force row level security;
alter table public.properties         force row level security;
alter table public.projects           force row level security;
alter table portal.staff              force row level security;
alter table portal.portal_users       force row level security;
alter table portal.contact_client_access force row level security;
alter table portal.access_grants      force row level security;
alter table portal.audit_log          force row level security;
alter table internal.site_access      force row level security;

-- ---------- clients ----------
create policy clients_client_read on public.clients for select to authenticated
  using ( id = any (portal.visible_client_ids()) );
create policy clients_staff_read on public.clients for select to authenticated
  using ( portal.is_staff() );
create policy clients_staff_write on public.clients for all to authenticated
  using ( portal.is_staff() ) with check ( portal.is_staff() );

-- ---------- contacts ----------
create policy contacts_client_read on public.client_contacts for select to authenticated
  using ( client_id = any (portal.visible_client_ids()) );
create policy contacts_staff_read on public.client_contacts for select to authenticated
  using ( portal.is_staff() );
create policy contacts_staff_write on public.client_contacts for all to authenticated
  using ( portal.is_staff() ) with check ( portal.is_staff() );

-- ---------- properties ----------
create policy properties_client_read on public.properties for select to authenticated
  using ( client_id = any (portal.visible_client_ids()) );
create policy properties_staff_read on public.properties for select to authenticated
  using ( portal.is_staff() );
create policy properties_staff_write on public.properties for all to authenticated
  using ( portal.is_staff() ) with check ( portal.is_staff() );

-- ---------- projects: the full three-clause predicate ----------
create policy projects_client_read on public.projects for select to authenticated
  using (
    published_at is not null
    and client_id = any (portal.visible_client_ids())
    and ( portal.project_scope() is null or id = portal.project_scope() )
  );
create policy projects_staff_read on public.projects for select to authenticated
  using ( portal.is_staff() );
create policy projects_staff_write on public.projects for all to authenticated
  using ( portal.is_staff() ) with check ( portal.is_staff() );

-- ---------- staff can see the roster and themselves ----------
create policy staff_self_read on portal.staff for select to authenticated
  using ( user_id = auth.uid() or portal.is_staff() );
create policy staff_admin_write on portal.staff for all to authenticated
  using ( portal.is_staff() and exists (
            select 1 from portal.staff s where s.user_id = auth.uid() and s.role = 'owner' and s.active ) )
  with check ( portal.is_staff() and exists (
            select 1 from portal.staff s where s.user_id = auth.uid() and s.role = 'owner' and s.active ) );

-- ---------- a person may see their own bridge row ----------
create policy portal_users_self on portal.portal_users for select to authenticated
  using ( user_id = auth.uid() or portal.is_staff() );

-- ---------- audit is staff-readable, never client-readable, never editable ----------
create policy audit_staff_read on portal.audit_log for select to authenticated
  using ( portal.is_staff() );

-- portal.contact_client_access, portal.access_grants and internal.site_access
-- deliberately have NO policies. RLS is on and forced, so they are unreachable
-- through the API by any client or staff session. They are touched only by
-- migrations and by edge functions holding the service key.
