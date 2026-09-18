-- Two corrections after review.
--
-- 1. The reference generator padded with lpad(), which TRUNCATES a number
--    longer than the pad width: the ten-thousandth request would have got
--    the same four-digit reference as the first and failed the unique
--    constraint. Pad up to four digits and let longer numbers through.
create or replace function portal_next_reference() returns text
language sql volatile as $$
  select 'R-' || to_char(now(), 'YYYY') || '-' ||
    case when nextval('portal_request_seq') < 10000
      then lpad(currval('portal_request_seq')::text, 4, '0')
      else currval('portal_request_seq')::text
    end;
$$;

-- 2. Password sign-in is throttled. One row per failed try, keyed by the
--    address that was typed whether or not it is on file, so the throttle
--    tells nobody which addresses are clients.
create table if not exists portal_password_attempts (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  attempted_at timestamptz not null default now()
);
create index if not exists portal_password_attempts_email_idx
  on portal_password_attempts (email, attempted_at desc);
alter table portal_password_attempts enable row level security;
