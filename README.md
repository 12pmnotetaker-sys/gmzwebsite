# gmzwebsite

The public marketing site for **GMZ Landscaping Inc.** — Astro, static output,
deployed to Vercel at `gmzlandscape.com`.

This repo is at **Phase 0**: the scaffold exists, the design system works, the
build gate runs, and there is no content on any of it. Every route is a
placeholder and the whole site is `noindex`.

## Running it

```sh
npm ci
npm run dev        # http://localhost:4321
```

Node 22 (see `.nvmrc`).

## The build gate

```sh
npm run check          # types, content schemas, broken image paths
npm run build          # check + build + content lint
npm run lint:content   # the written rules, against dist/
npm run format:check   # prettier
```

`npm run build` is the gate. It fails on a broken photo path, absent alt text, a
schema violation, or a sentence that breaks house style. CI runs all four on
every push.

## What is where

```
src/
  data/site.ts           every company fact, once
  data/publication.ts    the search-indexing switch
  data/canonical.ts      the canonical URL form
  styles/tokens.css      the palette; names stable, values swappable
  styles/global.css      fonts, reset, and the repeated design patterns
  content.config.ts      schemas for projects, services, testimonials, faqs
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
