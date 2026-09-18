-- Real GMZ Staff accounts, for the unified sign-in.
--
-- Staff never needed accounts before: `/staff` pointed anyone at the shared
-- external ChatGPT-hosted tool with no per-person login. The unified sign-in
-- at /portal/sign-in now needs to tell a staff member's own credentials apart
-- from a client's and an admin's, so staff gets a real, minimal account of
-- its own here.
--
-- This deliberately does not touch `gmz_operations_*`: those tables bridge
-- the Admin operations workspace to the live client data, and a staff sign-in
-- has no business there. Staff identity is its own small, isolated system,
-- shaped exactly like the client portal's (`portal_clients` /
-- `portal_sessions` / `portal_password_attempts`): scrypt password hashes
-- from src/server/crypto.ts, hashed session tokens, row level security on
-- with no policies, so only the service role can read a row.
create extension if not exists citext;
create extension if not exists pgcrypto;

create table if not exists gmz_staff_accounts (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  name text not null,
  -- scrypt, never plain text; see src/server/crypto.ts. Set with
  -- `npm run staff -- password --email <email>`.
  password_hash text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists gmz_staff_sessions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references gmz_staff_accounts (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists gmz_staff_sessions_staff_idx on gmz_staff_sessions (staff_id);

-- One row per failed try, keyed by the address that was typed whether or not
-- it is on file, so the throttle tells nobody which addresses are staff.
create table if not exists gmz_staff_password_attempts (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  attempted_at timestamptz not null default now()
);

create index if not exists gmz_staff_password_attempts_email_idx
  on gmz_staff_password_attempts (email, attempted_at desc);

alter table gmz_staff_accounts enable row level security;
alter table gmz_staff_sessions enable row level security;
alter table gmz_staff_password_attempts enable row level security;
