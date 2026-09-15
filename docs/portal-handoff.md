# The client portal: design handoff

**Status: landed, as a static prototype with real routes.** The portal design
from Claude Design (`GMZ Portal Prototype.dc.html`, with `GMZ Client Portal
.dc.html` as the board it was lifted from) is implemented under `/portal`. This
document is the record of where each part of it went, the places the prototype
was deliberately not copied, and what is still to come before a client is sent
a link.

## What the design was, and what it became

The design was a single-file prototype: one component holding every screen,
switching on a `screen` string, with all styling inline, a left-hand harness
for theme and device, and the copy written straight into the markup.

None of that structure survived, and none of it should have. What was recreated
is the visual output, at phone, tablet and desktop, in light and dark. The
mapping:

| In the prototype                          | In this repo                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| `screen` state, `isGarden`/`isProposal`/… | Real routes under `src/pages/portal/`, one file per screen                      |
| `go_x` click handlers                     | Real `<a href>` from the one route map in `src/data/portal/routes.ts`           |
| Copy written into the markup              | `src/data/portal/garden.ts` and `project.ts`, imported by pages                 |
| The plant rows, all pointing at the oak   | `src/content/plants/*.md`, one record per plant, `/portal/garden/plants/[slug]` |
| Inline `style="..."` on every node        | Tokens, `portal.css` primitives, scoped `<style>` per screen                    |
| The `narrowFlex` blocks and the `<aside>` | `column-only` in the column plus `<Fragment slot="rail">`                       |
| The theme switch in the harness           | `prefers-color-scheme`, both palettes defined in full                           |
| The device switch in the harness          | One responsive layout; the phone, tablet and desktop widths are viewports       |
| `<image-slot>` drop targets               | `Plate` for a photograph or its stated absence; `PhotoField` for an upload      |
| The phone status bar and bezel            | Nothing. They were the mockup's hardware.                                       |

## Where the design's parts live

| Part of the design                                                                                                        | File                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Status colours, the contrast-corrected green, tap target                                                                  | the "client portal" block at the end of `src/styles/tokens.css`                              |
| Kicker variants, rules, panels, rows, chips, buttons, fields, stage bar                                                   | `src/styles/portal.css`                                                                      |
| Top bar, footer, the centred column and the rail                                                                          | `src/layouts/PortalLayout.astro`, `src/components/portal/TopBar.astro`, `PortalFooter.astro` |
| Screen head, status chip, row, fact rows, priced lines, draw schedule, stage bar, notice plate, photo plate, photo upload | `src/components/portal/*.astro`                                                              |
| The garden client's content                                                                                               | `src/data/portal/garden.ts`                                                                  |
| The project client's content                                                                                              | `src/data/portal/project.ts`                                                                 |
| The plant record schema                                                                                                   | `plants` in `src/content.config.ts`                                                          |
| Every route, once                                                                                                         | `src/data/portal/routes.ts`                                                                  |
| The nav link                                                                                                              | `portalNav` in `routes.ts`, rendered by `Header.astro`                                       |

### The screens

| Screen                | Route                                       |
| --------------------- | ------------------------------------------- |
| Sign in               | `/portal/sign-in`                           |
| Expired link          | `/portal/link-expired`                      |
| Garden landing        | `/portal/garden`                            |
| Your service          | `/portal/garden/service`                    |
| Visit report          | `/portal/garden/visits/latest`              |
| Plants in your garden | `/portal/garden/plants`                     |
| Plant record          | `/portal/garden/plants/[slug]`              |
| Application notice    | `/portal/garden/applications/upcoming`      |
| Application record    | `/portal/garden/applications/latest`        |
| Documents             | `/portal/garden/documents`                  |
| Ask for something     | `/portal/garden/ask`, `/portal/project/ask` |
| Request sent          | `/portal/garden/ask/sent`                   |
| Autumn planting offer | `/portal/garden/offers/autumn-planting`     |
| Project landing       | `/portal/project`                           |
| Proposal              | `/portal/project/proposal`                  |
| Approve, confirm      | `/portal/project/proposal/approve`          |
| Approved              | `/portal/project/proposal/approved`         |
| Change order          | `/portal/project/change-orders/1`           |

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

**Forms are honest about having no backend.** A form that "sends" navigates to
the next screen with a plain GET, and no text, email, password, textarea or
file input carries a `name`, so nothing a person types ever reaches a URL, a
request or a server log. The choice chips are real radio groups. The photo
slots are real file inputs with a local preview. See "What is still to come".

**The client router does the one motion.** The rule is that nothing moves
except to confirm a tap; the short cross-fade between screens is that
confirmation, and `prefers-reduced-motion` removes it. The portal opts out of
the marketing site's rise-in.

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
  "design/build" to a client. `content-lint` checks what it can.
- **`/portal` stays in `gatedPrefixes`** and `PortalLayout` keeps `noindex`
  unconditionally. `content-lint` treats a `data-portal` page as gated in every
  indexing state.

## What is still to come

This pass is the design, built for real, with the content the brief supplied.
Before a client is sent a link:

1. **Sign-in and links.** Magic links from an email or a text, sessions, and
   the expired-link recovery actually sending a new one. The screens are built;
   the server is not.
2. **Real records.** Kate Games and Heron are the brief's example clients. The
   data modules are the shape a real record needs to fill.
3. **Photographs.** Every plate names the photograph it stands for.
4. **The statutory notices as the PDF on file.** `NoticePages` renders the
   embed when given a `src`; until then it shows a plate that cannot be
   mistaken for the legal text.
5. **Requests, approvals and offers reaching the office.** The forms are
   built; they need an endpoint, and the same rule as the intake form applies:
   a thank-you shows only when something accepted the submission.

## Bringing in the next revision

Same seams as the rest of the site:

1. Colours, type, spacing → `src/styles/tokens.css`, keep the names.
2. A repeated pattern → `src/styles/portal.css` once, every screen follows.
3. One screen's layout → that page's scoped `<style>`.
4. Copy → `src/data/portal/*.ts` or the plant's Markdown, not the page.
5. A new plant field → `plants` in `src/content.config.ts` first.
6. `npm run build`, which fails loudly on a schema violation, a missing alt or
   an em dash.
