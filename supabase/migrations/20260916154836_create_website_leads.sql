-- Recorded from the live project's migration history.
--
-- Website contact-form leads, for the /admin panel in the gmzwebsite repo.
--
-- Deliberately separate from this project's client-portal tables (clients,
-- portal_clients, portal_*, admin_*): a website enquiry is not yet a client,
-- and this table has nothing to do with the portal's own auth system. It is
-- reached only by two Vercel Functions in gmzwebsite using the service role
-- key (api/enquiry.ts to insert, api/admin/leads.ts to read and update).
--
-- RLS is enabled with no policies defined, which is deliberate: nothing but
-- the service role can read or write this table, not even an authenticated
-- portal_clients session. Staff sign-in for /admin is verified in the Vercel
-- Function itself (Supabase Auth token + an email allowlist), not through a
-- Postgres policy, so no policy is needed here.
create table public.website_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  town text not null,
  property_type text not null,
  project_type text not null,
  timeline text not null,
  budget_band text,
  heard_via text,
  message text not null,
  wants_portfolio boolean not null default false,
  source text not null default 'website',
  status text not null default 'new' check (status in ('new', 'contacted', 'won', 'lost')),
  staff_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.website_leads is
  'Contact-form submissions from the public marketing site. Not a client record; see clients/portal_clients for those. Read and written only by gmzwebsite''s Vercel Functions via the service role key.';

alter table public.website_leads enable row level security;

create index website_leads_created_at_idx on public.website_leads (created_at desc);
