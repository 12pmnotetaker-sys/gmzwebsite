# gmzwebsite

The public marketing site for **GMZ Landscaping Inc.** — Astro, static output,
deployed to Vercel at `gmzlandscape.com`.

This repo is at **Phase 1**: the scaffold works and the private portfolio has
moved in under `/portfolio`, veil and all. The marketing routes are still
placeholders and the whole site is `noindex` until Phase 2.

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

## What is where

```
src/
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
  components/            Header, Footer, Logo, SEO, PageHeader, Placeholder
  pages/                 the route skeleton, all placeholders
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
unpublished, and the accessibility floor.
