-- GMZ Client Portal, Phase 0: the spine.
-- public   = client-readable, protected by RLS
-- portal   = access control, never exposed to the API
-- internal = staff-only facts that must never reach a client
--
-- Recorded from the live project's migration history. This and the other
-- phase0/phase1 files were applied to gmz-client-portal before this
-- repository carried any migration, and nothing in this repository reads
-- these tables; they are here so that the migrations directory is the whole
-- of what the database is, and so a fresh database built from it accepts
-- every later migration that references them.

create schema if not exists portal;
create schema if not exists internal;

comment on schema portal is 'Access control. Never added to the exposed schema list.';
comment on schema internal is 'Staff-only facts. Cost, margin, site access. Never exposed.';

-- ---------- enums ----------
create type public.client_kind    as enum ('residential','commercial');
create type public.client_status  as enum ('prospect','active','dormant','closed');
create type public.contact_role   as enum ('owner','spouse','facilities','ap','other');
create type public.access_scope   as enum ('all','billing_only');
create type public.service_line   as enum ('design_build','maintenance');
create type public.project_status as enum ('lead','active','on_hold','complete','lost');
create type public.contact_locale as enum ('en','es');
create type public.staff_role     as enum ('owner','office','field');

-- ---------- updated_at ----------
create or replace function portal.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- clients ----------
create table public.clients (
  id                  uuid primary key default gen_random_uuid(),
  display_name        text not null,
  kind                public.client_kind   not null default 'residential',
  status              public.client_status not null default 'prospect',
  freshbooks_client_id text,
  marketing_consent   boolean not null default false,
  consent_recorded_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint consent_needs_a_date check (marketing_consent = false or consent_recorded_at is not null)
);
comment on table public.clients is 'The client of record. marketing_consent gates any use of their photos outside their own portal.';

-- ---------- contacts ----------
create table public.client_contacts (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  full_name      text not null,
  email          text,
  phone          text,
  role           public.contact_role not null default 'owner',
  locale         public.contact_locale not null default 'en',
  portal_enabled boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index client_contacts_email_key on public.client_contacts (lower(email)) where email is not null;
create index client_contacts_client_idx on public.client_contacts (client_id);
comment on table public.client_contacts is 'People, not logins. A household has two; a corporate account has a facilities manager and an AP address.';

-- ---------- properties ----------
create table public.properties (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  label         text not null,
  address_line1 text,
  city          text,
  state         text not null default 'CA',
  postal_code   text,
  lat           numeric(9,6),
  lng           numeric(9,6),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index properties_client_idx on public.properties (client_id);
comment on table public.properties is 'No gate codes, no hazards, no dog notes. Those live in internal.site_access.';

-- ---------- projects ----------
create table public.projects (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients(id) on delete cascade,
  property_id       uuid references public.properties(id) on delete set null,
  service_line      public.service_line not null,
  name              text not null,
  current_stage_key text,
  estimate_number   text,
  status            public.project_status not null default 'lead',
  started_on        date,
  target_completion date,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index projects_client_idx on public.projects (client_id);
create index projects_property_idx on public.projects (property_id);
comment on column public.projects.service_line is 'Set once at intake, same rule the estimating engine enforces. Internal category; never shown to the client as a label.';
comment on column public.projects.published_at is 'Null means invisible to the client. Publishing is an act, not a state.';

-- ---------- staff ----------
create table portal.staff (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        public.staff_role not null default 'office',
  can_publish boolean not null default true,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table portal.staff is 'Xavier, Liliana, Rafael Jr. A staff session is an ordinary Supabase session with a row here, never a service key in a browser.';

-- ---------- the bridge from auth to a GMZ person ----------
create table portal.portal_users (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  contact_id   uuid not null references public.client_contacts(id) on delete cascade,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now()
);
create index portal_users_contact_idx on portal.portal_users (contact_id);
comment on table portal.portal_users is 'Both doors write here. One auth.uid(), one predicate.';

-- ---------- the grant table the predicate reads ----------
create table portal.contact_client_access (
  id         uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.client_contacts(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete cascade,
  scope      public.access_scope not null default 'all',
  created_at timestamptz not null default now(),
  unique (contact_id, client_id)
);

-- ---------- emailed links ----------
create table portal.access_grants (
  id           uuid primary key default gen_random_uuid(),
  token_sha256 bytea not null unique,
  contact_id   uuid not null references public.client_contacts(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete cascade,
  project_id   uuid references public.projects(id) on delete cascade,
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  last_used_at timestamptz,
  use_count    integer not null default 0,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index access_grants_contact_idx on portal.access_grants (contact_id);
comment on table portal.access_grants is 'Only the hash is stored, so a database read never yields a working link. Null project_id means whole-client access.';

-- ---------- audit ----------
create table portal.audit_log (
  id            bigserial primary key,
  occurred_at   timestamptz not null default now(),
  actor_user_id uuid,
  actor_kind    text not null default 'staff',
  action        text not null,
  entity        text,
  entity_id     uuid,
  ip            inet,
  user_agent    text,
  payload       jsonb
);
create index audit_log_entity_idx on portal.audit_log (entity, entity_id);
create index audit_log_occurred_idx on portal.audit_log (occurred_at desc);
comment on table portal.audit_log is 'Append-only. Every publish, approval, revocation and override. Answers "what did they see, and when" a year later.';

-- ---------- the things a client must never reach ----------
create table internal.site_access (
  property_id   uuid primary key references public.properties(id) on delete cascade,
  gate_code     text,
  key_location  text,
  dogs          text,
  hazards       text,
  parking_note  text,
  updated_at    timestamptz not null default now()
);
comment on table internal.site_access is 'Separate schema, not a hidden column. A column can be selected by accident; a schema outside the exposed list cannot be reached at all.';

-- ---------- touch triggers ----------
create trigger t_clients_touch         before update on public.clients         for each row execute function portal.touch_updated_at();
create trigger t_client_contacts_touch before update on public.client_contacts for each row execute function portal.touch_updated_at();
create trigger t_properties_touch      before update on public.properties      for each row execute function portal.touch_updated_at();
create trigger t_projects_touch        before update on public.projects        for each row execute function portal.touch_updated_at();
create trigger t_staff_touch           before update on portal.staff           for each row execute function portal.touch_updated_at();
create trigger t_site_access_touch     before update on internal.site_access   for each row execute function portal.touch_updated_at();
