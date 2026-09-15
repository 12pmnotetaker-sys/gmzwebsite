# gmzwebsite

The public marketing site for **GMZ Landscaping Inc.** — Astro, static output,
deployed to Vercel at `gmzlandscape.com`.

This repo carries all three of GMZ's surfaces in one site: the public marketing
pages, the private portfolio under `/portfolio` behind its veil, and the client
portal under `/portal` with its sign-in in the nav. The marketing routes are
still being written and the whole site is `noindex` until Phase 2; the portal
is the design built for real, with the brief's example clients as content,
ahead of the server side that will sign a client in.

The live `gmz-portfolio` deployment is untouched and still serving prospects.
Nothing switches over until the Phase 3 cutover.

**The unlock code and its storage key are preserved byte-for-byte**, so anyone
who has already entered the code stays through the veil. Changing the storage
key locks every existing prospect out; see `CLAUDE.md` before touching it.

## Running it

```sh
npm ci
npm run dev        # http://localhost:4321
```

Node 22 (see `.nvmrc`).

## The build gate

```sh
npm run check          # types, content schemas, broken image paths
npm run build          # check + build + content lint + photo metadata scan
npm run lint:content   # the written rules, against dist/
npm run lint:photos    # no committed image carries a location
npm run format:check   # prettier
```

`npm run build` is the gate. It fails on a broken photo path, absent alt text, a
schema violation, a sentence that breaks house style, or a committed photograph
that still carries GPS coordinates. CI runs it on every push.

Before a new photograph goes anywhere near `git add`:

```sh
npm run photo:audit -- original.jpg
npm run photo:clean -- original.jpg src/assets/projects/<slug>/<name>.webp
```

Commit the cleaned output, not the original. Git history is permanent, so a file
committed with coordinates in it stays that way even after it is deleted.

## The intake form

`/start` posts to `api/enquiry.ts`, a Vercel Function. It is the one part of
this site that can fail silently, so it is built not to.

**A static host answers `200` to a form POST whether or not anything is
listening.** The thank-you panel would report success, the client would believe
GMZ had their enquiry, and nobody would find out for weeks. No client-side check
can tell the difference. So the endpoint returns `200` **only when a delivery
channel accepted the enquiry** — not when it validated, not when it parsed — and
the form shows a thank-you only on that `200`. With nothing configured it
answers `503` and the page offers the phone number instead.

That means **the form is deliberately inert until these are set** on the Vercel
project. Set at least one channel:

| Variable                    | What it is                                                 |
| --------------------------- | ---------------------------------------------------------- |
| `RESEND_API_KEY`            | API key for the email provider                             |
| `ENQUIRY_FROM`              | sender on a domain verified with that provider             |
| `ENQUIRY_TO`                | where enquiries land; defaults to the address in `site.ts` |
| `SUPABASE_URL`              | `https://<ref>.supabase.co`                                |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side key; never goes near a browser                 |

Then **send one real submission and confirm it arrives** in an inbox somebody
opens. A `200` in the network tab is not the test; an email someone reads is.

The field lists and the validation live in `src/data/enquiry.ts` and are
imported by both the form and the function, so the browser and the server cannot
disagree about what a valid answer is.

## What is where

```
src/
  pages/portal/          the client portal, one route per screen
  layouts/PortalLayout.astro
  styles/portal.css      the portal's repeated patterns, on top of global.css
  data/portal/           the portal's copy, routes and status states
  content/plants/        one record per plant in a client's garden
  data/site.ts           every company fact, once
  data/publication.ts    the search-indexing switch
  data/canonical.ts      the canonical URL form
  styles/tokens.css      the palette; names stable, values swappable
  styles/global.css      fonts, reset, and the repeated design patterns
  content.config.ts      schemas: projects (town only), services, testimonials,
                         faqs, and portfolio (gated, street names)
  content/portfolio/     the seven gated project entries
  pages/portfolio/       the gated index, project pages and walkthroughs
  layouts/               BaseLayout
  data/enquiry.ts        the intake form's fields, and the shared validation
  components/            Header, Footer, Logo, SEO, PageHeader, EnquiryForm, Gate
  pages/                 the routes
api/enquiry.ts           the intake endpoint; see "The intake form" above
scripts/content-lint.mjs the written rules, checked against built HTML
```

## Design

The palette and typeface are GMZ's own, ported from the portfolio and verified
against the brand manual: Evergreen `#008C41`, Sunshine `#F6A400`, Blueprint
`#0062B9`, Deep Forest `#002B37`, Text Black `#222222`, Stone Grey `#E9E9E9`, on
white. Gabarito throughout, self-hosted, weights 400 to 800. Square corners.

Each colour has one job: teal is chrome, green is action, amber is the accent
rule, blue is structure. Keep the jobs straight and the design holds together.

## Read next

`CLAUDE.md` carries the rules that are not style preferences: one fact one home,
nothing internal reaches the site, town not street, undecided policy stays
unpublished, and the accessibility floor. `docs/portal-handoff.md` is the record
of the client portal design: where each part went, what was deliberately not
copied, and what is still to come.
