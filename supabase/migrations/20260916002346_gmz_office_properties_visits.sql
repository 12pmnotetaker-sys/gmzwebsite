-- Recorded from the live project's migration history. The office's first
-- property and visit tables, which the operations bridge migration that
-- follows depends on (it writes admin_properties and locks it).

create table if not exists public.admin_members (
client_id uuid primary key references public.portal_clients(id), active boolean not null default true
);
create table if not exists public.admin_properties (
client_id uuid primary key references public.portal_clients(id),
address text not null default '',town text not null default '',truck text not null default '',
budget_minutes integer check (budget_minutes between 0 and 1440),monthly numeric(12,2) check(monthly>=0),
internal boolean not null default false,service_day text not null default '',next_visit date,
notes text not null default '',updated_at timestamptz not null default now()
);
create table if not exists public.admin_visits (
id uuid primary key default gen_random_uuid(),client_id uuid not null references public.portal_clients(id),
visit_date date not null,summary text not null,private_notes text not null default '',
author_id uuid references public.portal_clients(id),published_at timestamptz,created_at timestamptz not null default now()
);
alter table public.admin_members enable row level security;
alter table public.admin_properties enable row level security;
alter table public.admin_visits enable row level security;
revoke all on public.admin_members,public.admin_properties,public.admin_visits from anon,authenticated;
grant all on public.admin_members,public.admin_properties,public.admin_visits to service_role;
create or replace function public.admin_publish_visit(p_visit_id uuid,p_record jsonb,p_author uuid) returns void language plpgsql security invoker set search_path=public as $$
declare target uuid;
begin
if not exists(select 1 from admin_members where client_id=p_author and active) then raise exception 'Office access required'; end if;
select client_id into strict target from admin_visits where id=p_visit_id for update;
update portal_gardens set record=p_record,updated_at=now() where client_id=target;
if not found then raise exception 'Garden not found'; end if;
update admin_visits set published_at=now() where id=p_visit_id;
end;
$$;
revoke all on function public.admin_publish_visit(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.admin_publish_visit(uuid,jsonb,uuid) to service_role;
