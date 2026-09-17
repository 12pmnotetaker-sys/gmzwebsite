# Private Staff route preview

`/staff` renders the bilingual Staff shell copied from gmzwebsite's Staff build. `/api/staff-route` requires the existing GMZ owner identity; this is an Admin preview, not deployed employee authentication.

The endpoint uses the existing shared workspace and GMZ route book. It excludes former route customers and returns only route display fields, service instructions, and Admin-added service requests for the same property and matching visit (or a pending request for the next service). It does not expose client billing, hourly costs, or access codes.

Wednesday A/B alternatives are explicitly marked until selected. Non-route days initially display the upcoming Monday date. Refresh reloads current notes; no GPS or live Bouncie positions are implied.

Language preferences and prototype data remain browser-local. English/Spanish UI labels use the website dictionary. Free-text notes use the browser's on-device Translator API when supported; the original remains visible. No note text is sent to a third-party translation endpoint. Unsupported browsers receive an explanation rather than an invented translation. Staff-specific authorization and reliable cross-browser note translation remain future production work.

Update the shell by rebuilding gmzwebsite, copying only staff/index.html and its referenced assets to public/staff-preview, rewriting /_astro paths to /staff-preview/assets, and retaining the authenticated route/API here.
