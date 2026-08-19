# GMZ Landscaping website

The public marketing site for GMZ Landscaping Inc. Astro, static output, no CSS
framework, deployed to Vercel.

Read this before changing anything.

## Rules that are not style preferences

**One fact, one home.** Phone numbers, the mailing address, the CSLB number, the
hours, the tagline, the founding year, the founder's name, the domain and the
service area live in `src/data/site.ts` and nowhere else. Never retype one into a
component or a content file. This rule exists because the GMZ estimating system
had a contact block hardcoded in three places, and correcting one phone number
left two of them wrong.

**Nothing internal reaches the site.** Cost, margin, overhead, burdened labor
rates, crew-day counts, contingency and supplier pricing are internal to GMZ.
They must not appear in content, in code, in a comment or in a commit message.

Published prices are a different thing and are fine: the consultation fee, the
maintenance walk and the travel charge are prices to a client and live in `fees`
in `site.ts`. The rule protects GMZ's cost structure, not its rate card.

**Town only, never a street address.** Public project pages say "Atherton, CA".
The street name and number stay in the estimating system. This is enforced by the
`townOnly` schema in `src/content.config.ts`, so the way to break it is to delete
that refinement on purpose, in a diff someone reviews.

The gated portfolio indexes projects _by street name_, which GMZ agreed to
explicitly and which is conditioned on that site sitting behind a veil. When the
portfolio arrives here in Phase 1 it keeps its own collection and its own rule.
Do not let the two mix.

**Undecided policy does not get published.** An FAQ answer stays
`published: false` until the underlying decision is actually made. The site must
never state a warranty term, a lead time or a fee that nobody has agreed to,
because a client will hold GMZ to whatever it said.

The same applies to claims. `claims.licensedAndInsured` in `site.ts` is false:
the CSLB number is settled and publishable, the insurance half is not. Do not
write "licensed and insured" anywhere until that flag is true.

**Alt text is required** by the schema on every content image, and by
`scripts/content-lint.mjs` on every hand-written one. `caption` is the visible
text and `alt` is what a screen reader is told; they should usually differ. "The
stairs" is a fine caption and a useless alt.

**Strip metadata on anything new.** Photographs handed over by GMZ have carried
GPS coordinates identifying client home addresses. Astro strips metadata from the
derivatives it serves, but a committed source file keeps its own, and git history
is permanent: a later deletion does not remove it. Review before committing.

**Accessibility floor.** The skip link, visible `:focus-visible` rings (amber on
the teal chrome), `aria-current` on the active nav item, one `h1` per page, the
`prefers-reduced-motion` block, and real semantics on interactive pieces all
stay. A redesign that drops one is a regression, not a style change.

**House style for client-facing prose.**

- No em-dashes. Use a comma, a semicolon or a colon.
- No brand or manufacturer names. Describe the thing, not the SKU: "a smart
  Wi-Fi controller", not a named model. A supplier logo strip is a deliberate,
  separate exception and lives in markup, not in a sentence.
- No raw quantities the reader did not ask for. "shrubs, perennials and grasses",
  not "about 165 shrubs".
- Scope is described in shape, never in figures. "A full backyard rebuild, about
  four weeks" is publishable; the crew-days behind it are not.

## Where things are

| What                       | Where                          |
| -------------------------- | ------------------------------ |
| Company facts              | `src/data/site.ts`             |
| Claims not yet allowed     | `claims` in `src/data/site.ts` |
| Search indexing switch     | `src/data/publication.ts`      |
| Canonical URL form         | `src/data/canonical.ts`        |
| Design tokens              | `src/styles/tokens.css`        |
| Repeated patterns          | `src/styles/global.css`        |
| Content schemas            | `src/content.config.ts`        |
| The last check before live | `scripts/content-lint.mjs`     |

## Restyling

Token **names** are stable, token **values** change.

1. Colors, type, spacing changed → edit values in `src/styles/tokens.css`.
2. A repeated pattern changed (the amber rule, a button, a section head) → edit
   `src/styles/global.css` once and every page follows.
3. One component's layout changed → edit that component's scoped `<style>`.
4. Content changed → edit the Markdown, not the component.
5. A new content field is needed → add it to `src/content.config.ts` first. The
   schema is what makes a bad path fail the build.

Never put a literal colour in a component, and never define a colour only inside
the dark-mode block. Both themes are defined in full; leaving one half-updated
ships unreadable text to anyone with a dark preference.

## Search indexing

`searchIndexing.enabled` in `src/data/publication.ts` is one switch driving three
things that have to agree: the `noindex` meta tag in `BaseLayout.astro`,
`Disallow: /` in `src/pages/robots.txt.ts`, and whether a sitemap is generated at
all in `astro.config.mjs`.

It is **off**. This is a scaffold, and a placeholder page that Google indexes is
worse than no page because it ranks for the business's own name and shows a
visitor nothing. Flip it in Phase 2, when there is a site behind it.
`content-lint` fails the build if the three ever disagree.

## The build is the gate

```
npm run check          # types, schemas, broken image paths, content references
npm run build          # check + build + content lint
npm run lint:content   # the written rules, against dist/
npm run format:check   # prettier
```

`npm run build` fails loudly on a broken photo path, a missing video, absent alt
text or a schema violation, which is the point.

**Nobody edits this site through a CMS.** Changes go through a commit, so there
is no human editor standing between a mistake and the public. That makes the
build gate the only reviewer, and it is why `content-lint.mjs` exists rather than
a note in a style guide.

## Phases

- **Phase 0 (done).** Scaffold: tokens, facts, chrome, schemas, build gate, CI.
- **Phase 1.** The portfolio moves in. Public projects (town only) split from the
  gated portfolio (street names, veil, noindex).
- **Phase 2.** The marketing site: home, services, process, about, answers,
  intake. Indexing goes on.
- **Phase 3.** Cutover: redirects, DNS, then Wix.
- **Phase 4.** The client portal. Separate planning cycle.

## Open questions for GMZ

- **"Licensed and insured."** No document states a carrier, a coverage amount or
  a bond. Blocks the About page and `claims.licensedAndInsured`.
- **Which projects go fully public**, with client comfort confirmed. Public work
  is identifiable by town.
- **Domain mail.** `@gmzlandscape.com` points at two providers at once and nobody
  uses either; day-to-day mail runs through the Yahoo address. Check what has
  arrived before changing anything.
