# Build gate coverage audit

What `content-lint.mjs`, `photo-intake.mjs` and the content schemas actually
enforce, measured against the rules in CLAUDE.md, and where a rule can be broken
today without the build going red.

Every finding below was tested, not read off. The method was to inject a
violation into a copy of `dist/` or into a throwaway content entry, run the real
scripts, and record the exit code. Positive controls were run first to confirm
the harness could fail at all: an em-dash in a `<p>`, an internal term in a
`<p>`, an `<img>` with no alt, and a geotagged JPEG under `src/assets` were all
caught, correctly. The fixtures used invented placeholder values, never GMZ
figures, and none of them remain in the tree.

State at the time of the audit: `npm run build` passes, 33 pages, 84 images
scanned, nothing to report. The findings were first taken against `243d5b9`,
then re-verified after merging `e21e358` ("Towns, hero, Contact, and an intake
form that cannot lie"), which landed the enquiry form and endpoint. Every
finding below still holds on the merged head, and the intake form added one
more, recorded in section 3.

**Three of these have since been fixed**, in the follow-up that accompanies
this document: `lint:photos` now runs in CI, `site.title` no longer carries an
em-dash, and content-lint now reads the writing that ships inside a script.
The findings are left as they were written, because the record of what the gate
did and did not catch is the point of the document; each is marked below and in
the closing list. Everything else stands open.

## What holds

Worth stating first, because it is the load-bearing half and it is sound.

**The Phase 2 switch works.** Flipping `searchIndexing.enabled` to true and
rebuilding: all 9 gated pages keep their `noindex`, robots.txt keeps
`Disallow: /portfolio/` while opening the rest of the site, the sitemap is
generated and contains no portfolio URL, and content-lint passes. The specific
failure CLAUDE.md fears most, turning the marketing site on and dragging private
client work into a search result with it, is genuinely prevented.

**Gated status is derived, not passed.** `BaseLayout` calls `isGatedPath()`, so
a new page under `/portfolio` is gated by where it lives. There is no prop to
forget.

**Alt text is enforced.** Both `missing-alt` and `empty-alt` fire. Two escapes
exist and are deliberate: `role="presentation"` and `data-alt-set-by-script`.

**The EXIF GPS reader is good**, including the `Exif\0\0` offset that would
otherwise make a coordinate-laden photograph report as clean.

**Draft and publication filtering is real**, implemented in the `src/data/*.ts`
accessors, with a deliberate absence of a dev bypass for towns and reviews.

**The duplicate town note check works** and is the right kind of check: it tests
something a schema structurally cannot.

## 1. The photo scan does not run in CI

**Fixed.** A `lint:photos` step now runs in the workflow, ahead of the build,
since it reads committed source and needs nothing built.

The highest-impact finding.

`npm run build` chains `lint:photos`. `.github/workflows/build.yml` does not run
`npm run build`. It runs `check`, then `build:fast` (which is `astro build`
alone), then `lint:content`, then `format:check`. `lint:photos` is never
invoked.

Tested by committing a JPEG carrying GPS coordinates to `src/assets/` and
running the CI job's four steps in order:

| step                   | exit                    |
| ---------------------- | ----------------------- |
| `npm run format:check` | 0                       |
| `npm run check`        | 0                       |
| `npm run build:fast`   | 0                       |
| `npm run lint:content` | 0                       |
| `npm run lint:photos`  | 1, and CI never runs it |

CLAUDE.md says the location scan "is wired into `npm run build`" and that the
rule "is no longer a matter of remembering". In CI it still is.

Vercel's `buildCommand` is `npm run build`, so the deploy would fail. That is
too late by the rule's own reasoning: the point of the rule is that git history
is permanent and a later deletion does not undo the commit. Catching it at
deploy means the file has already been pushed and merged, and the remedy is
history rewriting, not a revert. It also means the first symptom is a blocked
production deploy.

**Fix:** add a `lint:photos` step to the workflow, or change the CI build step
to `npm run build`.

## 2. Photo scan coverage holes

All five confirmed by fixture.

**Video is never scanned.** `IMAGE_EXTENSIONS` has no video types, and sharp
could not read them anyway. There are 14 `.mp4` files and 1 `.webm` under
`public/media/`, all handed over as footage, and phone video routinely carries
an ISO 6709 location atom. A fixture MP4 with a location atom in
`public/media/` produced "84 committed image(s) checked, none carrying a
location", exit 0. The committed files were checked by hand for `©xyz`,
`ISO6709` and the Apple location key and are clean, but nothing keeps them that
way.

**XMP-only geotags pass.** `locates()` reads only the EXIF GPS IFD.
`carriesMetadata()` does notice an XMP block, but `scan` fails only on
`locates`. A JPEG whose sole geotag is `exif:GPSLatitude` inside an XMP packet
scanned clean, exit 0.

**SVG is not scanned and not even counted.** An SVG embedding a base64 JPEG that
carries GPS walked straight through; the file count did not move. `.gif` and
`.bmp` are the same class of omission.

**Unreadable files warn and pass.** A corrupt file with a `.jpg` extension
printed "Could not read ..." and returned 0. The same applies to
`exifUnparsed`. The script's own header says an unreadable block is "unknown
rather than safe"; `scan` treats both as safe.

**Only two directories are scanned.** `DEFAULT_SCAN_DIRS` is `src/assets` and
`public`. The same geotagged JPEG placed in `src/content/` scanned clean.

## 3. content-lint blind spots

content-lint reads `dist/`, which is the right choice. Within that, the reach is
narrower than the rules it is standing in for. Each row was injected into a copy
of the built homepage.

| injected                                                  | result |
| --------------------------------------------------------- | ------ |
| internal term in an `alt` attribute                       | passes |
| internal term in the meta description                     | passes |
| internal term and an hourly rate inside the JSON-LD block | passes |
| em-dash in `<td>`, `<h5>`, `<div>`, `<summary>`, `<dt>`   | passes |
| brand name in `<td>`                                      | passes |
| em-dash after a nested list inside `<li>`                 | passes |

Three mechanisms explain all of it.

**Attributes are discarded before the scan.** `text()` strips whole tags,
attributes included, so alt text, `title`, `aria-label` and every `<meta>`
content value are gone before `INTERNAL_TERMS` and `HOURLY_RATE` ever run.

**`stripCode` removes `<script>` bodies**, which includes the
`application/ld+json` block `SEO.astro` emits on every page. Structured data is
entirely unlinted.

**`PROSE_ELEMENTS` is a fixed list**: `p`, `li`, `blockquote`, `h1` to `h4`,
`figcaption`, `dd`. Not `h5`, `h6`, `td`, `th`, `dt`, `summary`, `caption`, or
text in a bare `div` or `span`. The regex is also non-nesting, so an `<li>`
containing a nested list ends its match at the inner `</li>` and everything
after it in that item goes unread.

### A house style violation shipping today

**Fixed.** `site.title` now uses a colon. What follows is what was found.

`site.title` in `src/data/site.ts` is:

    GMZ Landscaping — Design · Build · Maintenance

That em-dash renders into `<title>`, `og:title` and `twitter:title` on the
homepage right now. content-lint reports nothing, because none of the three is a
prose element and two of them are attributes. The single source of truth is
breaking the no-em-dash rule, and the check written to catch that rule cannot
see it.

### The intake form's copy is never linted

**Fixed.** content-lint now reads string literals out of bundled and inline
scripts, the JSON-LD block included, and applies the prose rules to them.

The enquiry form that arrived with `e21e358` puts real client-facing prose in
the one place content-lint cannot reach. The messages a visitor reads after
submitting, the success line and both failure lines among them, live in
`EnquiryForm.astro`'s client script. Astro bundles that to
`dist/_astro/EnquiryForm.astro_astro_type_script_index_0_lang.*.js`, and
content-lint filters to `.html`, so the copy is never read at all. Neither the
house style rules nor the internal-terms scan apply to it.

The copy as written is clean; it was checked by hand and carries no em-dash, no
brand name and no internal term. The point is that nothing keeps it that way,
and this is now the largest body of client-facing prose on the site sitting
outside the gate. It is the "script bodies are stripped" blind spot above, no
longer hypothetical.

`api/enquiry.ts` is in better shape. It is type-checked, since `tsconfig.json`
includes `**/*.ts`, and it returns machine-readable error codes rather than
prose, so there is no client-facing wording in it to lint. It is not in `dist/`
and therefore outside content-lint, which matters only if prose is added to it
later. Neither it nor `src/data/enquiry.ts` nor `EnquiryForm.astro` retypes a
company fact.

## 4. CLAUDE.md rules with no check at all

**One fact, one home.** Nothing prevents a phone number, the CSLB number, the
mailing address or the tagline being retyped into a component. Grepping the tree
for the phone patterns, the license number, the email and the P.O. box finds
nothing outside `src/data/site.ts`, so the rule holds today, by care. This is
the rule CLAUDE.md says exists because the estimating system got it wrong in
three places at once.

**`claims.licensedAndInsured`.** The flag is false and no check reads it. The
sentence "GMZ is licensed and insured." in a `<p>` builds and ships green.

**No raw quantities.** "We planted about 165 shrubs and 40 perennials." ships
green.

**Scope in shape, never figures.** A precise contract value in prose ships
green.

**Accessibility floor.** No check exists for the skip link, `:focus-visible`
rings, `aria-current`, the `prefers-reduced-motion` block, or one `h1` per page.
All are correct today: all 30 built pages carry exactly one `h1`. A redesign
dropping one would be invisible to the build, which is exactly the regression
CLAUDE.md names.

**The manufacturer list is a blocklist of ten names**, with Hunter, Vista and
Toro deliberately excluded as ambiguous. Anything not on the list passes. This
is inherent to the approach and worth knowing rather than fixing.

## 5. Schema gaps

**`townOnly` rejects only a leading digit.** The refinement is
`!/^\s*\d/.test(value)`.

| value                            | verdict           |
| -------------------------------- | ----------------- |
| `Atherton, CA`                   | accepted, correct |
| `480 Marlowe Road, Atherton, CA` | rejected, correct |
| `Marlowe Road, Atherton, CA`     | **accepted**      |
| `Fox Hill Road, Woodside`        | **accepted**      |
| `Castle Lane`                    | **accepted**      |

All seven gated portfolio entries are indexed by street name. The schema comment
says this refinement is what stops one being copied across into `projects`; in
practice it stops the house-number form and nothing else. A `projects` entry
with `location: 'Marlowe Road, Atherton, CA'` passes `astro check` and a full
`npm run build` with zero errors.

**`reference('testimonials')` points at a collection that does not exist.** The
`collections` export is `projects, services, reviews, faqs, portfolio, articles,
towns`. There is no `testimonials`. A project entry with `testimonial:
some-client` passed both `astro check` and a full build. `src/content/projects/`
is empty, so nothing exercises it; it will surface the first time a real project
uses the field.

**`budgetBand` and `duration` are unvalidated strings.** A precise contract
figure in `budgetBand` with `showBudgetBand: true`, and `duration: '412
crew-days'`, both build green. The schema comment says "coarse range only"; the
CLAUDE.md rule says scope in shape, never in figures. Neither is enforced. Note
that both halves of the gate miss this: `/work` is still a `Placeholder` and no
page renders the `projects` collection, so content-lint never sees the string
either. When the Phase 1 `/work` split lands, these become live.

**`faqs` allows `published: true` with `needsDecision: true`.** The `towns`
collection got exactly the treatment this needs, a `superRefine` tying
`published` to its preconditions. `faqs` did not. The collection is also
currently read by no page.

**`seo.noindex` is dead.** It is defined on every collection's `seo` object and
never read. `SEO.astro` takes `noindex` from `BaseLayout`'s computed
`hideFromSearch`, and no page passes `entry.data.seo.noindex` through. A content
author who sets it gets nothing.

**`gate.enabled` is dead.** Exported from `site.ts`, read by neither
`Gate.astro` nor `GateFlag.astro`. Setting it false would not disable or lift
the veil. It reads as a kill switch and is not one.

## 6. One structural note

`checkIndexingConsistency` derives the gated prefix set from pages that rendered
the veil, rather than from `gatedPrefixes`. Two consequences.

A `/portfolio` page that somehow lost its veil is classified as public. Because
`BaseLayout` derives `noindex` from `isGatedPath` rather than from the veil, it
would still carry `noindex`, so in the published state content-lint fails with
"robots.txt allows crawling but this public page still carries noindex". It
fails, which is what matters, but it names the wrong problem.

If the portfolio collection were ever empty or entirely drafts, no gated page
builds, the derived prefix set is empty, and the robots.txt `Disallow` check
silently becomes a no-op. Not a risk today with seven live entries.

## Suggested order

1. ~~Add `lint:photos` to CI.~~ Done. One line, and it closed the gap between a
   rule described as automatic and a rule that was still manual.
2. Fail `scan` on unreadable files and unparsed EXIF, and add XMP geotag
   detection. Small changes inside logic that already exists.
3. Scan video, or state in CLAUDE.md that video intake is manual and give it a
   route. Fifteen files are currently outside the net.
4. Tighten `townOnly` past the leading-digit test, before `/work` ships.
5. ~~Fix `site.title`.~~ Done. Linting `<title>` and the meta description for
   house style is still open: attributes are still outside every rule, so the
   next em-dash written into one ships the same way.
6. Register `testimonials` or drop the reference.
7. ~~Lint the JSON-LD block and the bundled client scripts.~~ Done, and inline
   scripts with them. Image alt text is still unlinted, along with every other
   attribute.
8. Decide whether the unenforced CLAUDE.md rules should be checks or should be
   marked in the document as held by review. Either is defensible. What is not
   is a document that reads as if they are all enforced.
