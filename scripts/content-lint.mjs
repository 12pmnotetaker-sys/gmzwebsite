#!/usr/bin/env node
/**
 * The reviewer of last resort.
 *
 * Astro's content schemas already fail the build on a broken image path, a
 * missing alt attribute in content, or an undecided FAQ answer. They cannot
 * catch a sentence. This does.
 *
 * It runs over `dist/`, not `src/`, on purpose. The rules below are about what
 * a reader sees, and a source file is full of code comments that discuss the
 * very words the rules forbid: this file itself talks about margins and
 * crew-days. Linting the built HTML asks the only question that matters, which
 * is whether the thing shipped.
 *
 * Nobody edits this site through a CMS, so there is no human editor between a
 * change and the public. That makes this script the last check before a
 * mistake is live, rather than a nicety.
 *
 * Run: npm run lint:content   (wired into `npm run build`, after `astro build`)
 */

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { EM_DASH, HOURLY_RATE, INTERNAL_TERMS, MANUFACTURERS } from './lib/copy-rules.mjs';

/*
 * The adapter lays the build out as dist/client (the files that ship as
 * files) and a function bundle under .vercel/output (the pages rendered on
 * demand). Without the adapter everything is in dist/. Read whichever is there.
 */
const DIST = existsSync(path.resolve('dist/client'))
  ? path.resolve('dist/client')
  : path.resolve('dist');

/*
 * Where the on-demand pages' templates end up. The portal's screens are not
 * HTML in dist/, they are compiled templates in the function, so the writing
 * they carry is read from the string literals there; see checkScriptProse.
 * The traced node_modules beside it are not read: they are not our words.
 */
const SERVER_BUNDLE = path.resolve('.vercel/output/functions/_render.func/dist/server');

/* ---- Rules ------------------------------------------------------------- */

/**
 * A count of plants. House style describes scope in shape, never in figures:
 * "shrubs, perennials and grasses", not "about 165 shrubs". Plant nouns only,
 * on purpose. Areas and lengths are left alone because an ordinance article
 * legitimately says "500 square feet", and that is a rule, not a scope.
 */
const RAW_QUANTITY =
  /\b\d{2,}\s+(?:shrubs?|perennials?|grasses|trees|plants|flats|boulders|pavers|bulbs)\b/gi;

/**
 * The claim the site is not yet allowed to make. `claims.licensedAndInsured`
 * in src/data/site.ts is false until someone confirms a carrier and a coverage
 * amount, and until then the words must not ship, in any order.
 */
const LICENSED_AND_INSURED =
  /\b(?:licen[cs]ed\s+(?:and|&)\s+insured|insured\s+(?:and|&)\s+licen[cs]ed|fully\s+insured)\b/gi;

/**
 * Prose elements. The rules about writing apply to writing, not to markup.
 *
 * The list is wider than a paragraph because the client portal sets most of
 * its sentences in spans, links, definition terms, labels and buttons: a row's
 * note, a chip's word, a draw's trigger. A brand name in a row note is as
 * shipped as one in a paragraph, so those elements are read too.
 */
const PROSE_ELEMENTS =
  /<(p|li|blockquote|h1|h2|h3|h4|figcaption|dd|dt|span|a|legend|label|button|summary)\b[^>]*>([\s\S]*?)<\/\1>/gi;

/* ---- Helpers ----------------------------------------------------------- */

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

/** Drop script and style bodies; their contents are not read by anyone. */
const stripCode = (html) =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&mdash;': '—',
  '&#8212;': '—',
  '&#x2014;': '—',
};

const decode = (s) =>
  s.replace(
    /&(?:amp|lt|gt|quot|#39|nbsp|mdash|#8212|#x2014);/gi,
    (m) => ENTITIES[m.toLowerCase()] ?? m,
  );

const text = (html) =>
  decode(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

/** A short window around a match, so the report shows the offending sentence. */
const excerpt = (haystack, index, width = 70) =>
  haystack
    .slice(Math.max(0, index - width), index + width)
    .replace(/\s+/g, ' ')
    .trim();

/* ---- Checks ------------------------------------------------------------ */

const problems = [];
const report = (file, rule, detail) =>
  problems.push({ file: path.relative(process.cwd(), file), rule, detail });

function checkDocument(file, html) {
  const body = stripCode(html);
  const visible = text(body);

  for (const [rule, pattern] of [
    ['internal-figures', INTERNAL_TERMS],
    ['hourly-rate', HOURLY_RATE],
    ['raw-quantity', RAW_QUANTITY],
    ...(insuranceClaimAllowed ? [] : [['unconfirmed-claim', LICENSED_AND_INSURED]]),
  ]) {
    pattern.lastIndex = 0;
    for (const match of visible.matchAll(pattern)) {
      report(file, rule, `"${match[0]}" in: ...${excerpt(visible, match.index)}...`);
    }
  }

  checkAccessibilityFloor(file, body);
  checkHeadProse(file, body);

  // Writing rules apply only to writing.
  PROSE_ELEMENTS.lastIndex = 0;
  for (const block of body.matchAll(PROSE_ELEMENTS)) {
    const prose = text(block[2]);
    if (!prose) continue;

    EM_DASH.lastIndex = 0;
    for (const match of prose.matchAll(EM_DASH)) {
      report(
        file,
        'em-dash',
        `use a comma, semicolon or colon: ...${excerpt(prose, match.index)}...`,
      );
    }

    MANUFACTURERS.lastIndex = 0;
    for (const match of prose.matchAll(MANUFACTURERS)) {
      report(
        file,
        'manufacturer-in-prose',
        `"${match[0]}" — describe the thing, not the brand: ...${excerpt(prose, match.index)}...`,
      );
    }
  }

  // Every image needs alt text. The content schema enforces this for images
  // that come from Markdown; this catches the ones written by hand.
  for (const tag of body.matchAll(/<img\b[^>]*>/gi)) {
    /*
     * Three forms mean three different things, and the difference matters:
     *
     *   alt="a dry-stacked wall"   named
     *   alt="" / alt               deliberately not named, ie decorative
     *   (no alt at all)            an oversight, and the only real failure
     *
     * The bare form is the one that bites. An HTML attribute written without
     * a value has the empty string as its value, so `<img alt>` IS `alt=""`,
     * and Astro's Image component serialises it that way. Matching only the
     * quoted form reported every decorative image on the site as missing its
     * alt text, which is both wrong and the more severe of the two findings.
     */
    const alt = tag[0].match(/\salt(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?(?=[\s>])/i);
    const value = alt ? (alt[1] ?? alt[2] ?? alt[3] ?? '') : undefined;
    if (value === undefined)
      report(file, 'missing-alt', `<img> with no alt attribute: ${tag[0].slice(0, 90)}`);
    else if (
      value.trim() === '' &&
      !/\brole\s*=\s*["']presentation["']/i.test(tag[0]) &&
      !/\bdata-alt-set-by-script\b/i.test(tag[0])
    )
      report(
        file,
        'empty-alt',
        `<img> with empty alt, no presentation role and no data-alt-set-by-script: ${tag[0].slice(0, 90)}`,
      );
    else if (value.trim()) {
      // Alt text is read aloud, so the writing rules reach it too. It is the
      // one attribute a reader meets; the audit found no rule saw any. The
      // manufacturer rule stays out of it: a supplier logo's alt text is the
      // supplier's name, and the logo strip is the exception house style names.
      const spoken = decode(value);
      for (const [rule, pattern] of ALT_RULES) {
        pattern.lastIndex = 0;
        for (const match of spoken.matchAll(pattern)) {
          report(file, `${rule}-in-alt`, `"${match[0]}" in alt text: ${spoken.slice(0, 90)}`);
        }
      }
    }
  }
}

/** The writing rules, as they apply to alt text. */
const ALT_RULES = [
  ['internal-figures', INTERNAL_TERMS],
  ['em-dash', EM_DASH],
];

/** The writing rules, as they apply to the title and the meta description. */
const ATTRIBUTE_RULES = [...ALT_RULES, ['manufacturer', MANUFACTURERS]];

/**
 * The title and the meta description are the most client-facing lines on the
 * site: a search result and a browser tab show nothing else. The audit found
 * an em-dash shipping in <title> with nothing to catch it, because neither is
 * a prose element and `text()` drops attributes before any rule runs.
 */
function checkHeadProse(file, body) {
  const title = body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const description = body.match(
    /<meta\b[^>]*\bname=["']description["'][^>]*\bcontent=["']([^"']*)["']/i,
  )?.[1];
  for (const [where, value] of [
    ['<title>', title],
    ['meta description', description],
  ]) {
    if (!value) continue;
    const spoken = decode(value);
    for (const [rule, pattern] of ATTRIBUTE_RULES) {
      pattern.lastIndex = 0;
      for (const match of spoken.matchAll(pattern)) {
        report(file, `${rule}-in-head`, `"${match[0]}" in ${where}: ${spoken.slice(0, 90)}`);
      }
    }
  }
}

/**
 * The accessibility floor, checked on every prerendered page.
 *
 * CLAUDE.md names five things a redesign must not drop: the skip link, visible
 * focus rings, `aria-current` on the active nav item, one h1 per page, and the
 * reduced-motion block. Until now all five were held by care. The first four
 * are visible in the HTML and are checked here; the two CSS rules are checked
 * once, over the built stylesheets, in `checkStylesheets`.
 *
 * A veiled page is not exempt: a prospect using a screen reader is still a
 * prospect. The on-demand pages (the portal, the admin screens) are not HTML
 * in dist/ and are not seen here; PortalLayout carries its own skip link.
 */
function checkAccessibilityFloor(file, body) {
  const h1s = body.match(/<h1\b/gi)?.length ?? 0;
  if (h1s !== 1) {
    report(file, 'heading-floor', `${h1s} <h1> elements; every page has exactly one.`);
  }

  if (!/<a\b[^>]*\bclass=["'][^"']*\bskip-link\b[^"']*["'][^>]*\bhref=["']#main["']/i.test(body)) {
    report(file, 'skip-link', 'No skip link to #main. BaseLayout renders one; this page lost it.');
  }
  if (!/<main\b[^>]*\bid=["']main["']/i.test(body)) {
    report(file, 'skip-link', 'No <main id="main"> for the skip link to land on.');
  }

  // One current item per nav, and every nav must be labelled. Two navs on a
  // page (the masthead and the drawer) may each mark the same item current.
  for (const nav of body.matchAll(/<nav\b([^>]*)>([\s\S]*?)<\/nav>/gi)) {
    const attrs = nav[1];
    if (!/\baria-label(?:ledby)?=/i.test(attrs)) {
      report(file, 'nav-label', `A <nav> without aria-label: <nav${attrs.slice(0, 60)}>`);
    }
    const current = nav[2].match(/\baria-current=["']page["']/gi)?.length ?? 0;
    if (current > 1) {
      report(file, 'aria-current', `${current} links marked aria-current="page" in one nav.`);
    }
  }
}

/**
 * The two halves of the accessibility floor that live in CSS.
 *
 * Astro bundles every stylesheet under dist, so the check is whether the
 * built CSS, taken together, still styles `:focus-visible` and still carries
 * a `prefers-reduced-motion` block. A redesign that drops either is a
 * regression, not a style change, and it should fail here.
 */
async function checkStylesheets(files) {
  const sheets = files.filter((f) => f.endsWith('.css'));
  let css = '';
  for (const file of sheets) css += await readFile(file, 'utf8');

  if (sheets.length === 0) {
    problems.push({ file: 'dist/', rule: 'stylesheets', detail: 'No CSS was built.' });
    return;
  }
  if (!/:focus-visible\b/.test(css)) {
    problems.push({
      file: 'dist/**/*.css',
      rule: 'focus-ring',
      detail: 'No :focus-visible rule in the built CSS. Keyboard users have lost the focus ring.',
    });
  }
  if (!/@media\s*\([^)]*prefers-reduced-motion\s*:\s*reduce/.test(css)) {
    problems.push({
      file: 'dist/**/*.css',
      rule: 'reduced-motion',
      detail: 'No prefers-reduced-motion block in the built CSS.',
    });
  }
}

/**
 * Whether the site may say "licensed and insured".
 *
 * The flag lives in src/data/site.ts, which this script cannot import: it is
 * TypeScript, and content-lint is plain Node on purpose so that it has no
 * build step of its own. Reading the flag off the source text is deliberate
 * and narrow, the same way `checkIndexingConsistency` reads `gatedPrefixes`:
 * the pattern matches the one assignment, and if the line moves or is
 * rewritten the read fails loudly rather than assuming either answer.
 */
async function readInsuranceClaimFlag() {
  const source = await readFile(path.resolve('src/data/site.ts'), 'utf8');
  const match = source.match(/\blicensedAndInsured:\s*(true|false)\b/);
  if (!match) {
    console.error(
      'content-lint: could not find `licensedAndInsured: true|false` in src/data/site.ts.',
    );
    process.exit(1);
  }
  return match[1] === 'true';
}

/**
 * Prose that ships inside a script.
 *
 * The rules above read the built HTML, and for nearly everything that is the
 * right place. It is not where all of the writing lives. A component's client
 * script is bundled to a .js asset, so the lines the intake form shows a
 * visitor after they press send never appear in a page at all. An `is:inline`
 * script keeps its text in the HTML, where `stripCode` drops it before any
 * rule runs. Either way the words reach a reader and nothing reads them back.
 *
 * A script is mostly code, and running the prose rules over code invents
 * problems rather than finding them: `markup` is an ordinary identifier, and
 * an em-dash never appears outside a string anyway. So only string literals
 * are read, and only the ones shaped like something a person reads.
 */
const STRING_LITERAL = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;

/** Two words or more. A selector, a path, a MIME type or a key is not prose. */
const READS_AS_PROSE = /[A-Za-z]{2,}[ ,.;:] ?[A-Za-z]/;

/** The rules that follow the writing wherever it ships. */
const SCRIPT_RULES = [
  ['internal-figures-in-script', INTERNAL_TERMS],
  ['hourly-rate-in-script', HOURLY_RATE],
  ['em-dash-in-script', EM_DASH],
  ['manufacturer-in-script', MANUFACTURERS],
];

function checkScriptProse(file, code) {
  for (const literal of code.matchAll(STRING_LITERAL)) {
    const value = (literal[1] ?? literal[2] ?? literal[3] ?? '').replace(/\\(.)/g, '$1').trim();
    if (value.length < 24 || !READS_AS_PROSE.test(value)) continue;
    if (value.includes('://') || /^[\w./-]+$/.test(value)) continue;

    for (const [rule, pattern] of SCRIPT_RULES) {
      pattern.lastIndex = 0;
      for (const match of value.matchAll(pattern)) {
        report(file, rule, `"${match[0]}" in: ...${excerpt(value, match.index)}...`);
      }
    }
  }
}

/**
 * The search signals have to agree, and the site now has two kinds of page.
 *
 * PUBLIC pages follow the phase switch: noindex and disallowed while the
 * marketing site is a scaffold, indexable and in the sitemap once it is not.
 *
 * GATED pages never move. They carry noindex, they are disallowed by prefix,
 * and they stay out of the sitemap whatever the public site is doing. The
 * failure this exists to prevent is turning the marketing site on in Phase 2
 * and dragging private client work into a search result with it.
 *
 * A page counts as gated because it rendered the veil or carries the portal
 * marker, not because of its path, so a gated page that somehow lost its veil
 * is caught here rather than assumed safe.
 */
/**
 * Ten town pages carrying the same paragraph with the name swapped is the
 * standard way this idea fails, and it is the reason the rest of the field's
 * location pages are worthless. A schema can insist the local note is long
 * enough; only a pass over the built site can tell whether two of them are the
 * same words.
 *
 * The note is marked in the markup rather than inferred from position, so this
 * keeps working when the page layout changes.
 */
function checkTownPagesDiffer(pages, bodies) {
  const seen = new Map();

  for (const file of pages) {
    const match = bodies.get(file)?.match(/<p\b[^>]*\bdata-town-note\b[^>]*>([\s\S]*?)<\/p>/i);
    if (!match) continue;

    const note = match[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (!note) continue;

    if (seen.has(note)) {
      report(
        file,
        'duplicate-town-note',
        `the same local note already ships on ${path.relative(process.cwd(), seen.get(note))}. ` +
          `A town page has to say ` +
          `something true of this town and not the next one, or it should not exist.`,
      );
      continue;
    }
    seen.set(note, file);
  }
}

async function checkIndexingConsistency(files) {
  const robotsPath = path.join(DIST, 'robots.txt');
  if (!existsSync(robotsPath)) {
    problems.push({
      file: 'dist/robots.txt',
      rule: 'indexing',
      detail: 'robots.txt was not generated.',
    });
    return;
  }

  const robots = await readFile(robotsPath, 'utf8');
  const hasSitemap = existsSync(path.join(DIST, 'sitemap-index.xml'));
  /** A bare `Disallow: /` closes the whole site: the scaffold state. */
  const scaffold = /^\s*Disallow:\s*\/\s*$/m.test(robots);

  /*
   * The prefixes to check against robots.txt and the sitemap come from
   * `gatedPrefixes` in src/data/publication.ts, read from its source, plus
   * whatever rendered as gated. Deriving them only from built pages would
   * miss /portal entirely, since its screens are rendered on demand and are
   * not HTML in dist/.
   */
  const declared = (
    (await readFile(path.resolve('src/data/publication.ts'), 'utf8')).match(
      /gatedPrefixes\s*=\s*\[([^\]]*)\]/,
    )?.[1] ?? ''
  )
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
  const underDeclaredPrefix = (route) =>
    declared.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));

  const gated = [];
  const open = [];
  for (const file of files.filter((f) => f.endsWith('.html'))) {
    const source = await readFile(file, 'utf8');
    const route =
      `/${path.relative(DIST, file).replace(/(?:^|\/)index\.html$/, '')}`.replace(/\/+$/, '') ||
      '/';
    const entry = {
      file,
      route,
      noindex: /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(source),
    };
    /*
     * Three kinds of gated page. The portfolio renders the veil; the client
     * portal marks its body with data-portal and never draws one, because it
     * has a sign-in screen of its own; and the admin and staff entry pages
     * sit under a declared prefix with a layout of their own and neither
     * marker. All are private in every state, and a page that is declared
     * gated but has lost its noindex is caught below rather than read as a
     * public page that should open up.
     */
    (source.includes('data-gate-veil') ||
    /<body\b[^>]*\bdata-portal\b/i.test(source) ||
    underDeclaredPrefix(route)
      ? gated
      : open
    ).push(entry);
  }

  const relative = (file) => path.relative(process.cwd(), file);

  // Gated pages, in every state, without exception.
  for (const page of gated.filter((p) => !p.noindex)) {
    problems.push({
      file: relative(page.file),
      rule: 'indexing',
      detail: 'Gated page is missing noindex. The veil is client-side and stops no crawler.',
    });
  }

  const gatedPrefixes = [
    ...new Set([
      ...declared,
      ...gated.map((p) => `/${p.route.split('/').filter(Boolean)[0] ?? ''}`),
    ]),
  ].filter((prefix) => prefix !== '/');

  if (scaffold) {
    for (const page of open.filter((p) => !p.noindex)) {
      problems.push({
        file: relative(page.file),
        rule: 'indexing',
        detail: 'robots.txt disallows the whole site but this page has no noindex tag.',
      });
    }
    if (hasSitemap) {
      problems.push({
        file: 'dist/sitemap-index.xml',
        rule: 'indexing',
        detail: 'A sitemap was generated while robots.txt disallows the whole site.',
      });
    }
    return;
  }

  // Published: the public half is open, the gated half is still shut.
  for (const prefix of gatedPrefixes) {
    if (!new RegExp(`^\\s*Disallow:\\s*${prefix}/?\\s*$`, 'm').test(robots)) {
      problems.push({
        file: 'dist/robots.txt',
        rule: 'indexing',
        detail: `Gated prefix ${prefix}/ is not disallowed in robots.txt.`,
      });
    }
  }
  for (const page of open.filter((p) => p.noindex)) {
    problems.push({
      file: relative(page.file),
      rule: 'indexing',
      detail: 'robots.txt allows crawling but this public page still carries noindex.',
    });
  }
  if (!hasSitemap) {
    problems.push({
      file: 'dist/',
      rule: 'indexing',
      detail: 'robots.txt allows crawling but no sitemap was generated.',
    });
    return;
  }
  for (const file of files.filter((f) => /sitemap.*\.xml$/.test(f))) {
    const xml = await readFile(file, 'utf8');
    for (const prefix of gatedPrefixes) {
      if (xml.includes(`${prefix}/`) || xml.includes(`${prefix}<`)) {
        problems.push({
          file: relative(file),
          rule: 'indexing',
          detail: `Sitemap lists a gated path under ${prefix}/.`,
        });
      }
    }
  }
}

/* ---- Run --------------------------------------------------------------- */

if (!existsSync(DIST)) {
  console.error('content-lint: dist/ not found. Run `astro build` first.');
  process.exit(1);
}

const files = await walk(DIST);
const pages = files.filter((f) => f.endsWith('.html'));
const insuranceClaimAllowed = await readInsuranceClaimFlag();

const bodies = new Map();
for (const file of pages) {
  const html = await readFile(file, 'utf8');
  bodies.set(file, html);
  checkDocument(file, html);
  // Inline scripts and the JSON-LD block, both of which stripCode removes
  // before the document rules run.
  for (const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    checkScriptProse(file, script[1]);
  }
}

// Bundled client scripts, which are not pages and so are not read above.
for (const file of files.filter((f) => f.endsWith('.js'))) {
  checkScriptProse(file, await readFile(file, 'utf8'));
}

// The on-demand pages: the portal's screens and the endpoints, compiled into
// the function. Their prose is string literals in the bundle, and it gets the
// same rules as prose in a page.
if (existsSync(SERVER_BUNDLE)) {
  for (const file of (await walk(SERVER_BUNDLE)).filter((f) => /\.m?js$/.test(f))) {
    checkScriptProse(file, await readFile(file, 'utf8'));
  }
}
checkTownPagesDiffer(pages, bodies);
await checkStylesheets(files);
await checkIndexingConsistency(files);

if (problems.length === 0) {
  console.log(`content-lint: ${pages.length} page(s) checked, nothing to report.`);
  process.exit(0);
}

const byRule = new Map();
for (const problem of problems) {
  if (!byRule.has(problem.rule)) byRule.set(problem.rule, []);
  byRule.get(problem.rule).push(problem);
}

console.error(`\ncontent-lint: ${problems.length} problem(s) across ${pages.length} page(s).\n`);
for (const [rule, list] of byRule) {
  console.error(`  ${rule}  (${list.length})`);
  for (const problem of list) console.error(`    ${problem.file}\n      ${problem.detail}`);
  console.error('');
}
process.exit(1);
