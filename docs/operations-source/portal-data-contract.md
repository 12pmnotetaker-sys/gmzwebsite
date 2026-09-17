# GMZ portal integration baseline

Verified 2026-09-16. Operations layout is the accepted baseline.

## Ownership and data flow

| Data | Input / authority | Output |
| --- | --- | --- |
| Client name and email | Canonical `portal_clients` UUID | Operations local ID mapped through `gmz_operations_clients`; edits save to canonical record |
| Property | `gmz_operations_properties`, keyed by scope and property ID | Client property selector; primary property also mirrors legacy `admin_properties` |
| Requests | Client-session `portal_requests.client_id` | Admin inbox, client profile, linked scope draft or next-service instructions |
| Request photos | Client-prefixed private request storage | Admin selected-request viewer; validated paths, signed for five minutes, manual refresh |
| Existing portal approvals | `portal_approvals`, immutable client/subject evidence | Admin Approvals inbox; not interpreted as approval of an unrelated Operations draft |
| Reviewed reports | Completed work order plus explicit publication | Client-bound report history with completed tasks and selected photos only |
| Announcements | Admin draft plus explicit publication | Matching client audience during Pacific start/end dates |
| Office notes, rates, access codes, attendance, fleet, vendors | Operations only | No client publication |

## Translation rules

- Match accounts by canonical UUID and the stored local mapping, never by display name.
- Keep property ownership fixed. A report's property and client must agree.
- Money `0` is a real value; `null` means unrecorded. Do not convert either to the other.
- Store date-only values without timezone conversion. Audience windows use America/Los_Angeles.
- Primary property aliases: city ↔ town, budgetMinutes ↔ budget_minutes. Secondary properties remain distinct.
- Workspace version plus canonical fingerprint reject stale saves. Commit and report insertion are transactional.
- Republishing uses visit/revision identity; changing a report returns the editable work order to Draft while the previously published report stays available.
- Request-to-proposal and request-to-service mappings retain source request IDs and are idempotent.
- Request photo URLs never become public assets or client report photos automatically.
- Inbox refreshes every 30 seconds while visible and on window focus, pauses for actions and dialogs, and preserves unsaved office drafts. This is polling, not push delivery.

## Explicit workflow boundaries

Operations proposals currently create internal scope drafts. Delivery uses the existing manual channel; record its sent date/reference and acceptance evidence. There is no automatic Operations-draft-to-client-proposal publication or automatic approval-to-project conversion. Existing portal project approvals are received in the inbox, but are not mapped to an arbitrary draft by client name.

Office follow-up statuses and service instructions remain internal. They are not client messages. The GMZ Staff portal is not connected. No emails or invitations are sent by this integration audit.

## Verification

- Live snapshot: 15 client mappings, 15 properties, 1 linked request; no orphan properties or primary-property field drift.
- Integration tables have RLS enabled and no anon/authenticated grants.
- `node --experimental-strip-types --test tests/portal-bridge.mjs tests/service-requests.mjs`: 13 checks passed, including publication privacy, audience dates, attachment ownership, identity/idempotency, null/zero mapping and queued instructions.
- `tests/portal-roundtrip.sql`: isolated synthetic records inside a rollback-only transaction. Verified forward/reverse property translation, stale-write rejection, report client isolation and report destination persistence. No fixture data retained.
- TypeScript and production build pass. Bridge deployed with existing custom hashed integration-token authentication; no credentials are sent to the browser.

No real client submission, approval or report publication was performed for testing. The current database has no published Operations reports or client approvals; those paths are covered by contract tests, not a fabricated client transaction.
