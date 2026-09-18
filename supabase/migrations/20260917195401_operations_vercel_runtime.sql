create table if not exists public.gmz_operations_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 scope text not null references public.gmz_operations_integrations(scope),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.gmz_operations_config (
 scope text primary key references public.gmz_operations_integrations(scope),
 route_book jsonb,
 updated_at timestamptz not null default now()
);
alter table public.gmz_operations_admins enable row level security;
alter table public.gmz_operations_config enable row level security;
revoke all on public.gmz_operations_admins, public.gmz_operations_config from public, anon, authenticated;
grant select,insert,update,delete on public.gmz_operations_admins, public.gmz_operations_config to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('gmz-operations','gmz-operations',false,4000000,array['image/webp'])
 on conflict (id) do nothing;
-- No membership is granted automatically. Provision a verified Supabase Auth
-- user, then explicitly assign its UUID to the existing Operations scope.
