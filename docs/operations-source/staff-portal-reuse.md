# GMZ Staff and Timesheets readiness

Reviewed GMZ Hub master commit 9e805ad817e05f12bc635a6e00b49b4d072e9a8e on 2026-09-16.

## Existing work worth adapting

- `src/app/portal/page.tsx`, `api/portal/auth/login`, and callback: staff PIN sign-in and Supabase session flow.
- `src/app/portal/dashboard/page.tsx`, `portal/entry/[date]`, `portal/week`: employee daily entry, personal totals, and week review.
- `src/app/api/portal/time-logs/route.ts`: personal time-log submission; locks approved entries; recalculates weekly summaries.
- `src/app/crew/timesheets/page.tsx` and `api/timesheets`: office review filters, notes, approval/return workflow.
- `src/lib/portalWeeks.ts`: existing payroll-cycle conventions. Preserve these in a future adapter; do not assume every employee uses a Monday-start week.
- `src/app/routes/page.tsx`, `schedule/routes/page.tsx`, `dispatch/page.tsx`: existing route-management surfaces. The inspected staff dashboard loads hours, not assigned routes.

## Implemented now

Operations has a Timesheets tab with date/staff/status filters and a review surface, using an empty validated `timesheets` collection in the shared workspace. No fake staff, hours, payroll import, staff accounts, or login endpoint is created. An explicit disconnected state remains until the integration is implemented. Clock times require offsets; display uses America/Los_Angeles. Review uses the existing workspace concurrency check. Returning an entry requires a reason; approval requires clock-out. There is no payroll calculation or export.

This is an office-side foundation, not a functioning staff submission connector. Existing work-order durations and Bouncie trips must never be converted to employee time entries automatically.

## Before activating GMZ Staff

1. Resolve the authoritative Hub/payroll database and existing staff IDs; map employee IDs to trusted auth identities and assigned crews/properties. Avoid duplicating payroll records.
2. Replace the legacy synthetic-password handoff and user-editable `user_metadata.gmz_user_id` authorization with trusted server-side mappings. Do not copy those authentication patterns into the new portal.
3. Enforce office and employee roles on every API. The reviewed office timesheet endpoints primarily check a signed-in email; that alone is not an office authorization rule.
4. Scope employee routes to assigned work. Exclude costs, other employees' time records, and unassigned property access information.
5. Adapt the existing daily/weekly forms to normalized time-log storage with immutable submission IDs, audited corrections, concurrency control, approved-record locking, and tested timezone handling. The current owner-workspace snapshot must not become a multi-staff write API.
6. Confirm break calculations and weekly summary triggers before syncing or exporting payroll. Do not write to old payroll tables as part of this UI update.

The route access requirement and trusted identity mapping remain implementation work, not verified live behavior.

## Office attendance additions

Visible per-entry Approve actions and a Review & approve entry point are available when completed submissions exist. Empty state explains why approval is disabled. Sick day, missed day, and other time-off records can be entered manually now using staff names, date ranges, and office notes, then approved or reopened. These records remain separate from submitted time and do not calculate pay, sick balances, or deductions. Staff account matching remains future integration work. Do not collect diagnoses in office attendance notes.
