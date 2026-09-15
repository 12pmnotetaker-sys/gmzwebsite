-- The client portal's tables.
--
-- Everything the portal reads or writes lives here, in the `public` schema of
-- the gmz-client-portal project, prefixed `portal_` so it cannot be confused
-- with `website_leads` or anything the estimating system keeps in the same
-- database later.
--
-- Access model, and it is the whole of the security design:
--
--   * Row level security is ON for every table, with NO policies. The anon
--     and authenticated roles can therefore read and write nothing. Only the
--     service role, used from the server and never shipped to a browser, can
--     touch these rows.
--   * The server decides who a request belongs to from the session cookie,
--     looks the client up, and scopes every query by client_id itself.
--
-- Nothing internal to GMZ belongs in these tables: no cost, margin, rate or
-- crew-day figure. A record is what the client is shown, and only that.

create extension if not exists citext;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Who can sign in
-- ---------------------------------------------------------------------------

create table if not exists portal_clients (
  id uuid primary key default gen_random_uuid(),
  -- Case-insensitive, unique: one client, one address, one record.
  email citext not null unique,
  -- What the screens call them: "Kate Games", "Heron".
  name text not null,
  -- A garden client arrives at /portal/garden, a project client at /portal/project.
  kind text not null check (kind in ('garden', 'project')),
  -- Optional. Set only for accounts that sign in with a password; everyone
  -- else uses the emailed link. scrypt, never plain text; see src/server/crypto.ts.
  password_hash text,
  created_at timestamptz not null default now()
);

-- One row per link sent. Only the hash of the token is stored, so a copy of
-- this table is not a set of working links.
create table if not exists portal_sign_in_tokens (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  -- First use. The link stays usable for a short grace period after this so a
  -- mail scanner that opens it first does not lock the person out.
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists portal_sign_in_tokens_client_idx
  on portal_sign_in_tokens (client_id, created_at desc);

-- A signed-in browser. The cookie carries the token; this holds its hash.
create table if not exists portal_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists portal_sessions_client_idx on portal_sessions (client_id);

-- ---------------------------------------------------------------------------
-- What a client is shown
-- ---------------------------------------------------------------------------

-- The garden record: next visit, last visit, the service, the agreement, the
-- documents shelf, the application notice and record, the seasonal offer.
-- One JSON document, validated on the way in and on the way out against the
-- schema in src/data/portal/shapes.ts, which is the one home for its shape.
create table if not exists portal_gardens (
  client_id uuid primary key references portal_clients (id) on delete cascade,
  record jsonb not null,
  updated_at timestamptz not null default now()
);

-- The project record: the proposal, its allowance, the draw schedule, the
-- approval sheet, what happens after approval, and any change orders.
create table if not exists portal_projects (
  client_id uuid primary key references portal_clients (id) on delete cascade,
  record jsonb not null,
  updated_at timestamptz not null default now()
);

-- One row per plant on a garden's record. This is the screen no competitor
-- has, and it is a table of its own because the crew will write to it.
create table if not exists portal_plants (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients (id) on delete cascade,
  slug text not null,
  record jsonb not null,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (client_id, slug)
);

-- ---------------------------------------------------------------------------
-- What a client sends
-- ---------------------------------------------------------------------------

-- The reference a client sees on the receipt: R-2026-0311. One sequence for
-- the whole portal, reset by nobody, so a reference is never reused.
create sequence if not exists portal_request_seq;

create or replace function portal_next_reference() returns text
language sql volatile as $$
  select 'R-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('portal_request_seq')::text, 4, '0');
$$;

create table if not exists portal_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients (id) on delete cascade,
  reference text not null unique default portal_next_reference(),
  -- 'ask' from the request form, 'offer' from a seasonal offer,
  -- 'application' for the answer to an application notice.
  kind text not null check (kind in ('ask', 'offer', 'application')),
  -- The category chip the client chose, in their words: "Extra work".
  about text not null,
  -- What they wrote. May be empty for an offer or an application answer.
  body text not null default '',
  -- The choices on an offer form, or the decision on a notice.
  details jsonb not null default '{}'::jsonb,
  -- Paths in the private `portal` storage bucket. Never a public URL.
  photo_paths text[] not null default '{}',
  -- True once the office was told by email. False means the row is the only
  -- copy, and the admin script lists these so nothing is missed.
  notified boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists portal_requests_client_idx
  on portal_requests (client_id, created_at desc);

-- A recorded intention to proceed: the proposal, or one change order. The
-- typed name is what the client entered, kept as entered.
create table if not exists portal_approvals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references portal_clients (id) on delete cascade,
  -- 'proposal', or 'change-order:1'.
  subject text not null,
  typed_name text not null,
  -- The figure that was on the sheet when they approved it, as shown.
  amount text,
  notified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (client_id, subject)
);

-- ---------------------------------------------------------------------------
-- Nobody but the server
-- ---------------------------------------------------------------------------

alter table portal_clients enable row level security;
alter table portal_sign_in_tokens enable row level security;
alter table portal_sessions enable row level security;
alter table portal_gardens enable row level security;
alter table portal_projects enable row level security;
alter table portal_plants enable row level security;
alter table portal_requests enable row level security;
alter table portal_approvals enable row level security;

-- The private bucket for photographs a client attaches and documents on file.
-- Private: every read goes through a signed URL the server mints for the
-- client that owns the file.
insert into storage.buckets (id, name, public)
values ('portal', 'portal', false)
on conflict (id) do nothing;
