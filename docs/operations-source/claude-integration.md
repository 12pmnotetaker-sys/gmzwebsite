> This initial prototype handoff is historical. See [portal-integration.md](portal-integration.md) for the connected backend, publication, and access rules now in use.

# GMZ Operations prototype handoff

This is an independent private prototype, not a change to the public Astro website or the live client-portal database. It uses GMZ's Gabarito font and the existing design palette. The original seed is fictional. An authorized, owner-scoped portal snapshot now replaces untouched demo records on the next workspace load; client addresses and commercial amounts are delivered as private runtime values, never committed as source fixtures.

## Implemented

- Clients and multiple properties per client; editable contact, agreement, crew, truck, access and service-scope fields.
- Recurring service scheduling (1–12 visits at an explicit day interval), per-visit rescheduling and skipped statuses.
- Work orders with editable checklists, on-site time, crew size, optional cost inputs, private notes, client summary and before/after photos.
- Project stage board, ownership, due dates, checklist, cost budget, actual costs and HTTPS approval references.
- Draft → Reviewed → Published to preview service reports. Editing report contents resets review. The client-report endpoint is a whitelist projection that excludes costs, time, address, access and private notes.
- Maintenance person-hours and recorded direct costs by month; over-budget visit flags; project budget balance. Missing inputs are unknown, not zero. Maintenance agreement amounts are not treated as verified revenue or net profit.

## Prototype boundaries

- Sites owner-private policy and request identity protect all records and images. The database is keyed by authenticated owner; this is not a shared crew login system.
- The standalone host uses the Sites Vinext/React runtime, D1 and private R2. The Astro repository is untouched. This interface should be ported or mounted in the approved staff application, not pasted into the static marketing site.
- Portal client/property metadata was read with authorization for this one-time snapshot import. No portal credentials, website leads or Supabase tables were changed.
- Published to preview is an internal status. No live client publication, email, SMS, payroll, invoicing or accounting sync occurs.
- Uploads are resized and re-encoded by the browser; the upload endpoint accepts WebP only and rejects EXIF/XMP. Images are private to the authenticated workspace. Detached images remain stored; production needs an orphan cleanup policy.
- Each import is idempotent and keeps a transactional backup of the pre-import workspace. This is a snapshot, not a live synchronization.
- State is stored as a validated snapshot with optimistic version checks for this bounded prototype. Split into normalized operational tables before a multi-staff production rollout.
- Repeated schedules use explicit day intervals; they do not run a background scheduler or imply calendar-month recurrence.

## Connecting Claude's admin

Claude owns staff login, lead inbox and portfolio settings. Integrate operations only after its branch and database target are settled. Never use client sessions as staff authorization or a browser portfolio code as access control.

1. Reuse the existing staff authentication contract, and enforce roles server-side on every API. Office may view costs; crew may read assigned work and submit completion; clients receive only approved report projections for authorized properties.
2. Map existing portal client/property IDs to operations IDs. Import authorized data privately through a server operation, never through source fixtures.
3. Create operational tables in the agreed private backend for properties, agreements, visits, task items, time entries, projects, attachments and report revisions. Preserve existing portal tables and migrations.
4. Replace the isolated store adapter with parameterized queries and transaction/version controls in that backend. The model/command layer specifies the validated workflows.
5. Add a server-side publication adapter that transforms a reviewed snapshot to the existing portal schema. Record destination and revision. Make publication idempotent and preserve historical client-visible reports. Use a transactional outbox for optional notifications.
6. Add staff assignment enforcement, photo retention, client-identity isolation checks and a complete staff→crew→client test before enabling real data.

## Review path

Open Schedule, create a visit, complete its checklist and summary, enter actual minutes, save it as Completed. Open Client updates, preview it, mark reviewed, then publish to preview. Open Time & profitability to see its person-hours and cost coverage. Add a second property under the same client and create a project to exercise the remaining modules.

## Validation

The workflow test suite covers recurrence, duplicate prevention, completion rules, review invalidation, report field exclusion, person-hour costing, null costs, invalid references/dates and multiple properties per client. TypeScript and the production build are checked. Browser and WebMCP runtime verification are not performed in this session.
