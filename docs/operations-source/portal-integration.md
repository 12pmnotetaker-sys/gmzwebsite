# Operations and client portal integration

The private Operations site authenticates its owner through Sites. The server checks that identity against the existing import owner before calling the Supabase bridge. A revocable random integration token is held only in Sites runtime secrets; Supabase stores its SHA-256 digest. The bridge exposes a bounded set of operations and runs with its built-in server credential. Neither token reaches browser code. RLS and revoked public grants protect the new tables. RPC functions use SECURITY INVOKER, fixed search paths, and service-role-only execute grants.

On the first connected load, the existing D1 workspace is copied to `gmz_operations_workspaces`; the D1 copy is retained as the pre-integration backup. Subsequent reads and saves use Supabase. No fallback writes to D1 occur while the bridge is configured. The central save transaction checks both workspace version and the legacy contact/property fingerprint. Existing portal names and emails win during initialization. Imported IDs are explicitly mapped; a linked property cannot change accounts and accidentally transfer published history.

Client names and emails use `portal_clients`. Existing primary properties remain compatible with `admin_properties`; a trigger propagates legacy changes to the shared property record. Additional properties use `gmz_operations_properties`. The website reads safe property projections scoped to the session client. Client portal contact emails are still placeholders until staff updates them. This integration sends no invitations, emails, or SMS.

## Publication

A completed visit must be Reviewed before the office selects Publish to client portal. Only selected photos are copied from private owner R2 to the client's private Supabase storage prefix. Each report is projected to date, property label, summary, completed tasks and selected photos. House-style validation runs before publication. A transaction saves the report revision and workspace status together. Content hashes prevent duplicate report revisions. Editing work returns its report to Draft without deleting the prior published copy.

The client website displays the latest published report for each visit, with account-scoped property filtering. The original primary-garden report also reads the latest Operations publication. Existing garden and project JSON, approval records and client sessions are preserved. The admin account preview reads the same published report and announcement records, never creates a client session, and never sends a sign-in link.

Portal inbox reads requests and approvals without changing their evidence. Office tracking is separate. A request from a not-yet-linked portal account offers Link existing account, preserving the portal ID. Approvals are displayed as received evidence; they do not silently approve an unrelated local proposal.

## Ads and announcements

Announcements and promotions have draft, published and archived states; start/end Pacific calendar dates; all/garden/project/selected-client audiences; and optional HTTPS links. Saving edits returns content to Draft. Publication is a separate action from the saved preview. Portal rendering enforces audience, date range and published status on the server. These are client-portal promotions, not an external paid-ad integration. Public marketing content remains managed through its existing repository.

## Validation

28 model/workflow tests cover existing flows plus publication review gates, field exclusion, selected-photo destination checks, review invalidation, canonical hydration, and announcement audiences/dates/links. An isolated live integration test verified rejected credentials, bootstrap, stale-write rejection, report publication and cross-client separation, multiple properties, hidden announcement drafts and selected audiences. Test records and credentials were removed afterward. Website checks include Astro typing, production build, house-style and photo-metadata gates. New tables deny direct anon/authenticated role access. No real client report or announcement was published during validation.

## Recovery

Disable the integration token to stop bridge access. Do not remove the Sites bridge settings to resume writing the old D1 snapshot: that would fork records after migration. Restore or repair the central workspace instead. The initial D1 snapshot is for recovery, not a second active backend. Edge source is generated from the model by `node scripts/prepare-portal-bridge.mjs` before deployment. Keep migrations and Edge source together with the Sites repository.

## Request follow-up update

Portal inbox now links directly to client profiles; each profile includes Requests & proposals. The owner can save internal follow-up notes and prepare one idempotent proposal per portal request, selecting only that client's properties. Request identity comes from the server record, not submitted client names. The proposal's client/source mapping is immutable through ordinary scope edits. Conversion to a project cannot switch clients.

The existing estimator opens the linked draft. Client-facing summary and item prices are separated from internal request notes, and the printable preview excludes internal notes and approval evidence. Delivery remains manual: print/save PDF, deliver using the office's channel, then record the actual sent date and reference. No email or digital approval was added. Changing previously sent scope requires clearing the sent date and resending. Approval still requires explicit evidence before conversion.

## Service-request handoff

The inbox can send an explicitly reviewed crew note to a property’s next scheduled/in-progress visit on or after the Pacific current date. If no visit exists, the request stays in a validated serviceRequests queue and attaches when a future work order is saved. One request is attached once; skipped linked visits return to the queue. The original request reference remains linked and the instructions are not copied into client-facing report projections. A full instructions field leaves the request queued for office attention. No request is marked completed by attaching it. GMZ Staff authentication remains disconnected.

Daily Dispatch now combines saved dated routes (preferred), source route plans, and actual work orders without duplicate properties. Skipped properties are omitted. Wednesday A/B must be explicitly selected for the date when no dated route exists. Route-plan rows are distinguished from work orders and do not create visits or record hours. CSV contains the same rows, with formula escaping and no access-code or cost fields.
