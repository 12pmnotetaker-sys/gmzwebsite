# GMZ Hub workflow adaptation

Reviewed source: 12pmnotetaker-sys/gmz-hub, commit 9e805ad817e05f12bc635a6e00b49b4d072e9a8e.

This change adapts the reviewed business workflows to Operations' owner-scoped D1 workspace rather than copying Hub's NextAuth/Supabase endpoints.

## Implemented

- Procurement: material order status, expected deliveries, captured unit prices, arrival tracking, and duplicate-safe job cost posting. Based on Hub `src/app/api/jobs/materials` and its alerts endpoint.
- Fuel: equipment-linked fuel purchases and meter updates. Based on `src/app/api/equipment`.
- Office brief: deterministic counts for overdue work, reports awaiting review, delivery delays, project deadlines, and equipment service; owner-assigned follow-ups. Based on `src/lib/agents/eodBrief.ts` and Hub action-item workflows.
- Scheduling: explicit excluded dates for a generated service series; selectable general, hardscape, planting, and repair checklists. Inspired by `recurrence.ts` and `agents/field.ts`; no virtual jobs or time-zone-dependent weekly parity.
- Dispatch: downloadable CSV for the selected day and crew. Inspired by the dispatch-sheet endpoint, but does not require Google OAuth. Spreadsheet formula prefixes are neutralized; access codes, internal notes, and job costs are excluded.

## Preserved and deferred

- Existing client/property import and owner partitioning remain the source of workspace identity.
- Bouncie remains not connected unless the server-only integration credential is configured. The saved Jeff route book remains clearly identified as a snapshot.
- Google Calendar and direct Sheets sync, FreshBooks, and public lead intake are not activated.
- Crew timesheets/payroll are not duplicated. Identity mapping, approval concurrency, existing database triggers, and pay calculations require a separate migration.
- Hub's fixed pricing rates, automatic sample estimate fallback, irrigation audit tab, and AI-based driving-time claims are not imported.
- Fuel logs do not automatically add job expenses. A procurement cost must not also be entered as a manual material posting.

## Verification

TypeScript check and 21 workflow tests passed before publication, covering legacy behaviors plus service exceptions, procurement price snapshots and idempotency, fuel meter checks, office follow-ups, and dispatch privacy/formula escaping. This is not a live external-integration or browser test.
