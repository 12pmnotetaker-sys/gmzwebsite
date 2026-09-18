-- Recorded from the live project's migration history; see
-- 20260826173624_phase0_identity_spine.sql.
--
-- The real stage model, from the GMZ Operating Manual and the Lead-to-sale
-- pipeline document, both dated 17 August 2026.
--
-- Three service lines, not two. The one-off service call was missing from the
-- schema entirely: the intake router in Diagram 2 sorts every lead five ways,
-- and "too small for a build crew" is one of them.

alter type public.service_line add value if not exists 'service_call';

-- "Build to others' plans" is not a fourth line. It is a design/build project
-- where the client already has an architect's or designer's plan set, which
-- skips stages 04 and 05 and carries no design fee.
alter table public.projects
  add column if not exists plans_supplied_by_client boolean not null default false;
comment on column public.projects.plans_supplied_by_client is
  'Client arrived with a complete plan set. Skips stages 04 and 05. No design fee.';

create table if not exists public.project_stages (
  id             uuid primary key default gen_random_uuid(),
  service_line   public.service_line not null,
  ordinal        integer not null,
  key            text not null,
  internal_label text not null,
  client_label   text not null,
  client_blurb   text,
  band           text,
  payment_due    boolean not null default false,
  gate           text,
  unique (service_line, ordinal),
  unique (service_line, key)
);
comment on table public.project_stages is
  'A catalogue, not an enum. Renaming a stage is a row edit. Never carries a fee amount: those live in the fee register and are read from there.';
comment on column public.project_stages.payment_due is
  'Whether the client pays at this stage. The amount is deliberately not here, so there is only one home for a fee.';
comment on column public.project_stages.gate is
  'What must be true before the next stage runs. From the pipeline document.';

alter table public.project_stages enable row level security;
alter table public.project_stages force row level security;
create policy stages_read on public.project_stages for select to authenticated using (true);
create policy stages_staff_write on public.project_stages for all to authenticated
  using ( portal.is_staff() ) with check ( portal.is_staff() );
grant select, insert, update, delete on public.project_stages to authenticated;
