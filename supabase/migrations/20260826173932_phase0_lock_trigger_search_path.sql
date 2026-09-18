-- Recorded from the live project's migration history; see
-- 20260826173624_phase0_identity_spine.sql.

create or replace function portal.touch_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;
