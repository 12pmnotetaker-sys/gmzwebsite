# Operations on GitHub and Vercel

## Runtime

The existing Astro/Vercel project now includes the Operations UI at `/admin/operations` and server endpoints under `/api/admin/`. Source was ported from Sites version 18, commit `15790a9ba0fd0cee09975735f9fc48d285e578ea`.

The shared Supabase workspace, client/property mappings, requests, reports and announcements remain the system of record. Vercel calls the same snapshot/commit RPCs and ports the bridge business logic into a server-only module. No second seed workspace is created. Existing version/fingerprint conflict checks are retained. Sites remains available during the transition.

`src/operations` contains the UI and models; `src/server/operations-admin` contains the protected backend. `docs/operations-source` records historical Sites behavior and must not be mistaken for the Vercel setup instructions. The original bridge schema is included in migrations; it was already applied to the existing database and must not be rerun there.

## Access

Uses the existing Vercel `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables. No integration token or service key reaches the browser. Supabase Auth verifies the password; every request validates the token with Auth, checks a confirmed email, an active `gmz_operations_admins` UUID membership, and an active workspace integration. Client sessions and spoofed Sites identity headers are not accepted.

The HttpOnly, SameSite=Strict cookie expires within one hour. Sign in again after expiration. POST requests require matching Origin. The API returns 401 without a valid Admin identity and does not cache private responses.

No user or password was provisioned by this migration. Before office use, create/confirm the intended user in Supabase Auth and insert that exact user's UUID into `gmz_operations_admins` with the existing Operations scope. Do not authorize by editable user metadata or by email supplied in a request. Revoking membership immediately blocks subsequent API requests.

## Remaining cutover steps

1. Enable the intended Admin account and exercise a complete authenticated request → service note/proposal → reviewed report flow on Vercel.
2. Transfer the current `GMZ_FIELD_ROUTE_BOOK` JSON from its authorized source into `gmz_operations_config.route_book` for the existing scope. Sites masks this secret when read through the connector; it was not reconstructed or exposed in Git. The Vercel field feed explicitly reports a pending transfer. Scheduled visits already in the shared database continue to use their existing records.
3. If live telemetry is desired, configure a server-only `BOUNCIE_API_KEY` in Vercel. No token was configured in the source Sites environment at inspection.
4. New Admin uploads use the private `gmz-operations` Supabase bucket. The shared workspace contained zero visits and zero visit-photo references at inspection, so no referenced R2 photo transfer was needed. Recheck immediately before final cutover if Sites receives new uploads. Do not run mixed photo-upload workflows across both hosts after rollout.
5. Update `/admin` and the Staff live-route entry to the new authenticated destination only after those checks pass. Staff authentication and employee-scoped access remain separate work; the current Staff timesheet prototype is not payroll-connected.

Do not disable Sites or delete its D1/R2 resources during this transition. Client-facing announcement publication and report publication remain explicit admin actions.

## Database protections

The runtime migration adds admin membership and per-workspace route configuration with RLS enabled, no anon/authenticated grants, and service-role-only access. The photo bucket is private, limited to WebP and 4 MB. No membership is automatically granted. Existing Supabase security advisor warnings about `portal_next_reference` search_path and the `citext` extension predate this port; the two added tables intentionally have no client RLS policies because only the verified server can access them.

## Validation

- Astro type check and production build passed; content and photo checks passed.
- Bridge tests passed for missing-workspace rejection and stale-write conflict handling.
- Local HTTP checks: six Admin API routes returned 401 with forged Sites headers; sign-in rendered; cross-origin login returned 403.
- Database checks confirmed RLS enabled and no anon/authenticated reads on the added tables; the upload bucket is private.
- Visual browser verification was unavailable in this environment. Authenticated end-to-end verification remains blocked on Admin-account provisioning.
