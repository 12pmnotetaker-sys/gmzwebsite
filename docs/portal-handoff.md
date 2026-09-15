# The client portal: design handoff

**Status: landed, with a server behind it.** The portal design from Claude
Design (`GMZ Portal Prototype.dc.html`, with `GMZ Client Portal.dc.html` as
the board it was lifted from) is implemented under `/portal`, rendered on
demand for a signed-in client from a record in the `gmz-client-portal`
database. This document is the record of where each part of it went, the
places the prototype was deliberately not copied, how the server side works,
and what is still to come before a client is sent a link.

## What the design was, and what it became

The design was a single-file prototype: one component holding every screen,
switching on a `screen` string, with all styling inline, a left-hand harness
for theme and device, and the copy written straight into the markup.

None of that structure survived, and none of it should have. What was recreated
is the visual output, at phone, tablet and desktop, in light and dark. The
mapping:

| In the prototype                          | In this repo                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| `screen` state, `isGarden`/`isProposal`/… | Real routes under `src/pages/portal/`, one file per screen                 |
| `go_x` click handlers                     | Real `<a href>` from the one route map in `src/data/portal/routes.ts`      |
| Copy written into the markup              | A record per client in the database, shaped by `src/data/portal/shapes.ts` |
| The plant rows, all pointing at the oak   | One row per plant in `portal_plants`, `/portal/garden/plants/[slug]`       |
| Inline `style="..."` on every node        | Tokens, `portal.css` primitives, scoped `<style>` per screen               |
| The `narrowFlex` blocks and the `<aside>` | `column-only` in the column plus `<Fragment slot="rail">`                  |
| The theme switch in the harness           | `prefers-color-scheme`, both palettes defined in full                      |
| The device switch in the harness          | One responsive layout; the phone, tablet and desktop widths are viewports  |
| `<image-slot>` drop targets               | `Plate` for a photograph or its stated absence; `PhotoField` for an upload |
| The phone status bar and bezel            | Nothing. They were the mockup's hardware.                                  |

## Where the design's parts live

| Part of the design                                                                                                        | File                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Status colours, the contrast-corrected green, tap target                                                                  | the "client portal" block at the end of `src/styles/tokens.css`                              |
| Kicker variants, rules, panels, rows, chips, buttons, fields, stage bar                                                   | `src/styles/portal.css`                                                                      |
| Top bar, footer, the centred column and the rail                                                                          | `src/layouts/PortalLayout.astro`, `src/components/portal/TopBar.astro`, `PortalFooter.astro` |
| Screen head, status chip, row, fact rows, priced lines, draw schedule, stage bar, notice plate, photo plate, photo upload | `src/components/portal/*.astro`                                                              |
| The shape of a garden record, a project record and a plant                                                                | `src/data/portal/shapes.ts`                                                                  |
| The garden client's content, as seed data                                                                                 | `src/data/portal/garden.ts`                                                                  |
| The project client's content, as seed data                                                                                | `src/data/portal/project.ts`                                                                 |
| Who is signed in: links, passwords, sessions, cookies                                                                     | `src/server/auth.ts`, `src/middleware.ts`                                                    |
| What a client is shown, read from the database                                                                            | `src/server/records.ts`, `src/server/screen.ts`                                              |
| What a client sends: requests, photographs, approvals                                                                     | `src/server/requests.ts`                                                                     |
| The tables                                                                                                                | `supabase/migrations/0001_portal.sql`                                                        |
| The office's command line                                                                                                 | `scripts/portal-admin.ts`                                                                    |
| Every route, once                                                                                                         | `src/data/portal/routes.ts`                                                                  |
| The nav link                                                                                                              | `portalNav` in `routes.ts`, rendered by `Header.astro`                                       |

### The screens

| Screen                | Route                                                                         |
| --------------------- | ----------------------------------------------------------------------------- |
| Sign in               | `/portal/sign-in`                                                             |
| Expired link          | `/portal/link-expired`                                                        |
| Garden landing        | `/portal/garden`                                                              |
| Your service          | `/portal/garden/service`                                                      |
| Visit report          | `/portal/garden/visits/latest`                                                |
| Plants in your garden | `/portal/garden/plants`                                                       |
| Plant record          | `/portal/garden/plants/[slug]`                                                |
| Application notice    | `/portal/garden/applications/upcoming`                                        |
| Application record    | `/portal/garden/applications/latest`                                          |
| Documents             | `/portal/garden/documents`                                                    |
| Ask for something     | `/portal/garden/ask`, `/portal/project/ask`                                   |
| Request sent          | `/portal/garden/ask/sent/[reference]`, `/portal/project/ask/sent/[reference]` |
| The seasonal offer    | `/portal/garden/offers/[slug]`                                                |
| Project landing       | `/portal/project`                                                             |
| Proposal              | `/portal/project/proposal`                                                    |
| Approve, confirm      | `/portal/project/proposal/approve`                                            |
| Approved              | `/portal/project/proposal/approved`                                           |
| Change order          | `/portal/project/change-orders/[id]`                                          |
| Change order, approve | `/portal/project/change-orders/[id]/approve`, `.../approved`                  |
| The emailed link      | `/portal/auth/[token]`                                                        |
| Sign out              | `/portal/sign-out` (a POST)                                                   |
| Record unreadable     | `/portal/unavailable` (a rewrite, never a link)                               |

## The palette, and the one correction

The four colours do the same four jobs as the rest of the site: teal is chrome,
green is action, amber is the accent rule and the attention fill, blue is
structure. The portal adds three status states derived from them (done,
scheduled, needs you) and one correction: `#008C41` measures 4.35:1 on white,
under AA, and in the portal it carries text twice, as a link and as a button
fill. `--portal-action` is `#00883F` at 4.57:1, visually indistinguishable. The
uncorrected green stays for the mark, the rules and the active stage marker.

Amber is a fill with teal text, never amber text. Every status shows its word
as well as its colour.

## The layout, and the fix the prototype needed

The portal is one column at every width. On desktop the column is centred on
the page and the secondary panel hangs in the right-hand gutter beside it. The
prototype laid the column and the panel out as one centred pair, which pushed
the column left of centre, and the last note in the design conversation was a
complaint about exactly that. `.screen` in `portal.css` is a three-track grid
with equal outer tracks, so the column sits in the same place whether or not a
screen has a rail.

## Deliberate departures from the prototype

**Every plant has a record.** The prototype had one record screen, the oak's,
and every other plant row pointed at it. Plants are a content collection now,
so each row opens its own page. Where the design gave a plant facts (the oak's
permit, the maple's planting date, the clematis tied in on 26 August) the
record shows them; where it gave none, the record shows no care history rather
than an invented one. The crew's notes under each record are new content and
should be read by GMZ before a client sees them.

**The site's logo, not a text mark.** The prototype set "GMZ" in Gabarito in
the top bar. The portal uses the same lockup as the masthead, so a client
moving from the marketing site into the portal sees one company.

**Dark mode follows the system.** The prototype's theme switch was a review
tool. The portal reads `prefers-color-scheme`, as the rest of the site does,
with the dark values the brief specified.

**Forms post and redirect.** Every form posts to its own route, which keeps
the row and redirects to the next screen, with JavaScript or without it.
Nothing typed ever lands in a URL. If the row could not be written the form
comes back with the reason above it and everything typed still in it, and the
phone number is on the screen. The choice chips are real radio groups. The
photo slots are real file inputs; what they carry is re-encoded on the server
so no metadata survives, then kept in a private bucket under the client's own
prefix.

**The client router does the one motion.** The rule is that nothing moves
except to confirm a tap; the short cross-fade between screens is that
confirmation, and `prefers-reduced-motion` removes it. The portal opts out of
the marketing site's rise-in.

**The documents shelf opens the record.** The prototype's "Application records"
row led to the pending notice, which is an approval prompt rather than an
archive. It opens the completed record now; the visit report's own
"Applications on this visit" row still leads to the notice, which is the only
application it has to show.

**Each client gets their own receipt.** The prototype had one "Sent" screen,
the garden client's. A project client who asks a question about their
proposal now lands on a receipt in the project's chrome, with the project's
own words and a way back to the project, rather than on another client's
garden.

**A document that is not on file says so.** The prototype's documents shelf
sent three rows back to the shelf itself. Those rows read "To come" and are
not links until the record names a file in storage, at which point the row
opens it through a signed URL that lives for two minutes.

**A change order has its own approve sheet.** The prototype's "Review and
approve" on a change order landed on the proposal's approved screen. Each
change order now carries its own approval lines, its own sheet and its own
approved screen, and the approval is recorded against that change order.

**A notice is answered once.** "That works, go ahead" and "Skip it this visit"
record the answer, tell the office, and the screen shows which answer was
given; the buttons do not come back.

**The approved screen says when, and by whom.** "Recorded Tuesday 1 September,
9:42 in the morning, by Julia Heron" is generated from the approval row, in
Pacific time, in the design's own words.

**Semantics were added everywhere.** One `h1` per screen; `<nav>` around row
lists; `<dl>` for fact rows; the stage bar is an image with the stage caption
as its name; every chevron is `aria-hidden` because the words beside it are the
link; every photo plate says in words what it stands for.

## What must survive any redesign

- **The allowance line says on screen that the number will move and what
  happens when it does.** The brief called it the single most important detail
  on the canvas.
- **The draw schedule is dollars and cents, one row per milestone, each naming
  its trigger.** Never a percentage. "Deposit" is the word, and the statutory
  cap is stated beside it.
- **A change order shows the effect on the payment schedule**, as an amber
  panel, not a footnote. California requires it.
- **The application record says when it is safe for children and pets**, and
  that line is the 26px answer on the screen.
- **A protected tree shows its permit and the jurisdiction.** The schema will
  not accept one without both.
- **The expired-link screen is a first-class screen** with the phone number on
  it. It is the screen that decides whether a client gives up.
- **No time on site, no visit duration, no ETA, no map, no progress
  percentage, no bottom tab bar.**
- **The copy rules**: no em dashes, no product names, no raw quantities, scope
  in shape never in figures, nothing credited toward a later stage, never
  "design/build" to a client. `content-lint` checks what it can, and since the
  portal sets most of its sentences in spans, links, labels and definition
  terms, its prose net reads those elements too.
- **Green text is the corrected green.** `--portal-action` on white, and the
  deep done-state green inside a calm panel, where the corrected green alone
  measures under AA.
- **`/portal` stays in `gatedPrefixes`** and `PortalLayout` keeps `noindex`
  unconditionally. `content-lint` treats a `data-portal` page as gated in every
  indexing state.

## The server side

**Who is signed in.** A client types their address and a link arrives by
email; the link carries a token, once, and `/portal/auth/[token]` exchanges it
for a session row and an HttpOnly cookie scoped to `/portal`. Links last seven
days, as the recovery screen promises, and keep working for ten minutes after
first use so a mail scanner that opens one first cannot spend it. An address
that is not on file, or has asked for too many links in an hour, gets the same
"a link is on its way" screen as one that is, because the alternative tells a
stranger which addresses are clients. Accounts that hold more than one
property can carry a password (scrypt, set from the command line); everyone
else uses links. Only hashes of tokens and sessions are stored.

**What a client is shown.** `src/middleware.ts` puts the signed-in client on
`locals`; a screen helper loads that client's record and refuses to render
anyone else's. A garden client asking for `/portal/project` is sent to their
garden. A client with no record yet sees a landing that says so. A record that
does not fit its shape, or breaks house style, is logged and the screen
becomes `/portal/unavailable`, with the phone number.

**What a client sends.** A request, an answer to a notice and an approval are
rows first and emails second. The receipt is shown only once the row exists;
the email to the office is a notification, with reply-to set to the client,
and if the provider refused it the row is marked and `npm run portal --
requests` lists it. The reference on the receipt comes from a database
sequence, so it is never reused.

**The tables.** `supabase/migrations/0001_portal.sql`, applied to the
`gmz-client-portal` project. Row level security is on for every table with no
policies, so only the service role can read a row, and the service role key
lives in a server environment variable. The private `portal` storage bucket
holds photographs and documents under each client's id.

**The office.** `npm run portal -- add | record | plants | password | link |
requests`. Every write goes through the same schema and copy rules as every
read.

## What is still to come

1. **An office screen.** The command line is the admin surface. A screen for
   the crew lead to write a visit report and flag a plant from a phone is the
   next differentiator, and the tables are shaped for it.
2. **Photographs and documents on real records.** Every plate names the
   photograph it stands for; a record that names a file in storage renders it.
   The statutory notices render as the PDF on file once `proposal.notices.path`
   names it.
3. **Texts as well as emails.** Links go by email. A text needs a provider
   and a phone number on the client record.
4. **Real clients.** The two seeded clients are the brief's examples, under
   example.com addresses. Add a real one with the command line and walk the
   portal as them before sending a link.

## Bringing in the next revision

Same seams as the rest of the site:

1. Colours, type, spacing → `src/styles/tokens.css`, keep the names.
2. A repeated pattern → `src/styles/portal.css` once, every screen follows.
3. One screen's layout → that page's scoped `<style>`.
4. Copy → the client's record, written with the command line; the seed
   records in `src/data/portal/*.ts` are the worked examples.
5. A new field on a record or a plant → `src/data/portal/shapes.ts` first,
   then the seed, then the screen.
6. `npm run build`, which fails loudly on a schema violation, a missing alt or
   an em dash, and `parseRecord`, which refuses a record that would.
