-- Server-only integration. Existing portal sessions and tables keep their access rules.
create table public.gmz_operations_integrations(scope text primary key, token_hash text not null unique, active boolean not null default true);
create table public.gmz_operations_workspaces(scope text primary key references public.gmz_operations_integrations(scope), data jsonb not null, version bigint not null default 0, updated_at timestamptz not null default now());
create table public.gmz_operations_clients(scope text not null references public.gmz_operations_integrations(scope),local_id text not null,client_id uuid not null references public.portal_clients(id),primary key(scope,local_id),unique(scope,client_id));
create table public.gmz_operations_properties(scope text not null references public.gmz_operations_integrations(scope),id text not null,client_id uuid not null references public.portal_clients(id),data jsonb not null,legacy_primary boolean not null default false,primary key(scope,id));
create unique index gmz_ops_primary_property on public.gmz_operations_properties(scope,client_id) where legacy_primary;
create table public.gmz_portal_reports(id uuid primary key default gen_random_uuid(),scope text not null,visit_id text not null,property_id text not null,client_id uuid not null references public.portal_clients(id),revision text not null,report jsonb not null,published_at timestamptz not null default now(),unique(scope,visit_id,revision),foreign key(scope,property_id) references public.gmz_operations_properties(scope,id));
create index gmz_portal_reports_client on public.gmz_portal_reports(client_id,published_at desc);
create table public.gmz_portal_inbox(kind text not null check(kind in ('request','approval')),source_id uuid not null,status text not null default 'Open' check(status in ('Open','In progress','Resolved')),notes text not null default '',updated_at timestamptz not null default now(),primary key(kind,source_id));
create table public.gmz_portal_announcements(id uuid primary key,scope text not null references public.gmz_operations_integrations(scope),title text not null,body text not null,kind text not null check(kind in ('Announcement','Promotion')),audience text not null check(audience in ('All clients','Garden clients','Project clients','Selected clients')),client_ids uuid[] not null default '{}',starts_on date not null,ends_on date,link_url text not null default '',link_label text not null default '',status text not null default 'Draft' check(status in ('Draft','Published','Archived')),version integer not null default 1,updated_at timestamptz not null default now(),check(ends_on is null or ends_on>=starts_on));
do $$ declare t text;begin foreach t in array array['gmz_operations_integrations','gmz_operations_workspaces','gmz_operations_clients','gmz_operations_properties','gmz_portal_reports','gmz_portal_inbox','gmz_portal_announcements'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
create function public.gmz_ops_fingerprint() returns text language sql stable security invoker set search_path='' as $$
select md5(jsonb_build_array(
(select coalesce(jsonb_agg(jsonb_build_array(id,name,email,kind) order by id),'[]') from public.portal_clients),
(select coalesce(jsonb_agg(to_jsonb(a) order by client_id),'[]') from public.admin_properties a)
)::text)
$$;
create function public.gmz_ops_snapshot(p_scope text) returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('workspace',(select jsonb_build_object('state',data,'version',version) from public.gmz_operations_workspaces where scope=p_scope),'fingerprint',public.gmz_ops_fingerprint(),'clients',(select coalesce(jsonb_agg(jsonb_build_object('localId',m.local_id,'id',c.id,'name',c.name,'email',c.email,'kind',c.kind)),'[]') from public.gmz_operations_clients m join public.portal_clients c on c.id=m.client_id where m.scope=p_scope),'properties',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'clientId',p.client_id,'data',p.data,'primary',p.legacy_primary,'legacy',to_jsonb(a))),'[]') from public.gmz_operations_properties p left join public.admin_properties a on a.client_id=p.client_id where p.scope=p_scope))
$$;
create function public.gmz_ops_commit(p_scope text,p_version bigint,p_fingerprint text,p_state jsonb,p_report jsonb default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.gmz_operations_workspaces; c jsonb; p jsonb; target uuid; is_primary boolean; linked record;
begin
if not exists(select 1 from public.gmz_operations_integrations where scope=p_scope and active) then raise exception 'Integration disabled'; end if;
insert into public.gmz_operations_workspaces(scope,data,version) values(p_scope,p_state,0) on conflict do nothing;
select * into strict w from public.gmz_operations_workspaces where scope=p_scope for update;
-- Also serialize legacy writes while comparing the canonical fingerprint.
lock table public.portal_clients,public.admin_properties in share row exclusive mode;
if w.version<>p_version or (p_version>0 and public.gmz_ops_fingerprint()<>p_fingerprint) then raise exception 'Workspace changed. Refresh before saving.';end if;
for c in select * from jsonb_array_elements(p_state->'clients') loop
 select client_id into target from public.gmz_operations_clients where scope=p_scope and local_id=c->>'id';
 if target is null then
  if c->>'id' ~ '^portal-[0-9a-f-]{36}$' then target:=substring(c->>'id' from 8)::uuid; if not exists(select 1 from public.portal_clients where id=target) then raise exception 'Portal client no longer exists';end if;
  else target:=gen_random_uuid();insert into public.portal_clients(id,name,email,kind) values(target,c->>'name',coalesce(nullif(c->>'email',''),target::text||'@pending.invalid'),'garden');end if;
  insert into public.gmz_operations_clients(scope,local_id,client_id) values(p_scope,c->>'id',target);
 end if;
 -- The initial snapshot never overwrites an existing portal name or email.
 if p_version>0 then update public.portal_clients set name=c->>'name',email=coalesce(nullif(c->>'email',''),target::text||'@pending.invalid') where id=target;end if;
end loop;
for p in select * from jsonb_array_elements(p_state->'properties') loop
 select client_id into strict target from public.gmz_operations_clients where scope=p_scope and local_id=p->>'clientId';
 select * into linked from public.gmz_operations_properties where scope=p_scope and id=p->>'id';
 if found and linked.client_id<>target then raise exception 'A linked property cannot be moved between client accounts';end if;
 is_primary:=coalesce(linked.legacy_primary,not exists(select 1 from public.gmz_operations_properties where scope=p_scope and client_id=target and legacy_primary));
 insert into public.gmz_operations_properties(scope,id,client_id,data,legacy_primary) values(p_scope,p->>'id',target,p,is_primary) on conflict(scope,id) do update set data=excluded.data;
 if is_primary then
  if p_version=0 then
   insert into public.admin_properties(client_id,address,town,truck,budget_minutes,monthly,internal,notes) values(target,p->>'address',p->>'city',p->>'truck',(p->>'budgetMinutes')::integer,(p->>'monthly')::numeric,coalesce((p->>'internal')::boolean,false),p->>'notes') on conflict do nothing;
  else
   insert into public.admin_properties(client_id,address,town,truck,budget_minutes,monthly,internal,notes) values(target,p->>'address',p->>'city',p->>'truck',(p->>'budgetMinutes')::integer,(p->>'monthly')::numeric,coalesce((p->>'internal')::boolean,false),p->>'notes') on conflict(client_id) do update set address=excluded.address,town=excluded.town,truck=excluded.truck,budget_minutes=excluded.budget_minutes,monthly=excluded.monthly,internal=excluded.internal,notes=excluded.notes,updated_at=now();
  end if;
 end if;
end loop;
if p_report is not null then
 select client_id into strict target from public.gmz_operations_properties where scope=p_scope and id=p_report->>'propertyId';
 if target::text<>p_report->>'clientId' then raise exception 'Report destination mismatch';end if;
 insert into public.gmz_portal_reports(scope,visit_id,property_id,client_id,revision,report) values(p_scope,p_report->>'visitId',p_report->>'propertyId',target,p_report->>'revision',p_report->'report') on conflict(scope,visit_id,revision) do nothing;
end if;
update public.gmz_operations_workspaces set data=p_state,version=w.version+1,updated_at=now() where scope=p_scope;
return public.gmz_ops_snapshot(p_scope);
end $$;
revoke all on function public.gmz_ops_fingerprint(),public.gmz_ops_snapshot(text),public.gmz_ops_commit(text,bigint,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.gmz_ops_fingerprint(),public.gmz_ops_snapshot(text),public.gmz_ops_commit(text,bigint,text,jsonb,jsonb) to service_role;
-- Keep the original single-property admin table and shared primary record aligned.
create function public.gmz_ops_legacy_property_changed() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 update public.gmz_operations_properties set data=data||jsonb_build_object('address',new.address,'city',new.town,'truck',new.truck,'budgetMinutes',new.budget_minutes,'monthly',new.monthly,'internal',new.internal,'notes',new.notes) where client_id=new.client_id and legacy_primary;
 return new;
end $$;
revoke all on function public.gmz_ops_legacy_property_changed() from public,anon,authenticated;
grant execute on function public.gmz_ops_legacy_property_changed() to service_role;
create trigger gmz_ops_legacy_property_sync after update on public.admin_properties for each row execute function public.gmz_ops_legacy_property_changed();
