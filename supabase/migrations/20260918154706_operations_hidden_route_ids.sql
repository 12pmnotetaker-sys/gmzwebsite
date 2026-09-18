-- Route-book rows the office keeps out of the staff feed. They were three
-- identifiers written into the server code; identifiers that name a client
-- belong in the database beside the route book, never in a source file.
alter table public.gmz_operations_config
  add column if not exists hidden_route_ids text[] not null default '{}';

-- One row per active integration, so the column has a home before the route
-- book itself is transferred. The values that were in the code are not
-- repeated here: they are already in the row, and this file is public.
insert into public.gmz_operations_config (scope, hidden_route_ids)
select scope, '{}'
from public.gmz_operations_integrations
on conflict (scope) do nothing;
