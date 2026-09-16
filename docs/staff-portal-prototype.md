# Staff portal prototype

The main website now has `/admin` and `/staff`, linked from its footer.

- `/admin` opens the deployed GMZ Operations workspace at https://gmz-operations.gmzhavi.chatgpt.site/. Existing owner-only access remains required. This is an entry point, not a migration of the private Operations runtime or its database credentials into the public website.
- `/staff` is an interactive prototype. All route names and instructions are sample data. The browser stores demo shifts, stop notes/completion and attendance requests under `gmz-staff-prototype-v1`. No real employee, client, address, access code, payroll data or server credentials are bundled.
- The prototype never submits to Operations, the client portal, payroll, mail or a staff backend. A demo submission locks the local entries; Reset demo clears them.
- Both routes are noindex and excluded from the sitemap. Noindex is not access control; only non-sensitive prototype data belongs here.

## Supported prototype flows

Clock in → start/end break → clock out → review a draft → submit demo week.

Manual daily entries reject invalid times, overlapping entries and breaks that consume the shift. Date grouping uses Pacific time. Live clock entries may cross midnight, up to 24 elapsed hours; manual entries cover one day.

Routes show ordered stops, office instructions, local field notes, and completion/reopen controls. Attendance includes sick day, missed day, and time off with a valid date range.

## Production connection later

1. Add authenticated staff sessions and server-owned employee IDs. Do not trust an employee ID or role supplied by the browser or editable user metadata. Do not reuse legacy GMZ Hub deterministic/PIN passwords.
2. Replace the demo store with a scoped staff API. Return only the signed-in employee's assigned routes/work orders and necessary service/access instructions, never client billing or margins.
3. Translate completed shifts into the Operations `timesheetSchema`: employee identity from the session, `clockIn`/`clockOut` with explicit offsets, break minutes, property link where applicable, source `GMZ Staff`, status `pending`. Do not use prototype local-storage data as trusted payroll input.
4. Map attendance to `absenceSchema` with server identity and pending status. Only Admin can approve/reject and record review timestamps.
5. Use request IDs and version checks for duplicate/retry protection. Define cross-midnight shifts and paid/unpaid break rules with GMZ before payroll integration.
6. Sync stop completion and field notes through authorized work-order commands. Client reports still require office review and explicit publication.

Validation: production build including Astro checks/content/photo gates; time calculation and date tests in `tests/staff-prototype.mjs`; rendered-bundle DOM checks for route completion, clock/break states, time-entry calculations, timesheet submission/locking, attendance, and local persistence. Browser automation could not start and its browser download timed out; desktop/mobile visual rendering was not verified.

