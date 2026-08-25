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

const DIST = path.resolve('dist');

/* ---- Rules ------------------------------------------------------------- */

/**
 * Internal figures. Cost, margin, overhead, burdened rates and crew-day counts
 * are internal to GMZ and must never reach a client.
 *
 * Published prices are NOT this. The consultation fee, the maintenance walk and
 * the travel charge are prices to a client and belong on the site; what is
 * forbidden is the cost structure behind them. So this looks for the vocabulary
 * of internal costing, not for dollar signs.
 */
const INTERNAL_TERMS =
  /\b(crew[-\s]?days?|truck[-\s]?days?|burdened|PMM|gross margin|profit margin|margin per day|overhead (?:rate|percent|percentage)|markup|cost[-\s]?plus|build[-\s]?up factor)\b/gi;

/** An hourly rate for labour. "$40/hr", "$45 per hour". */
const HOURLY_RATE = /\$\s?\d{1,4}(?:\.\d{2})?\s*(?:\/\s*(?:hr|hour)|per\s+hour)\b/gi;

/**
 * Manufacturer and model names, which house style keeps out of prose: describe
 * the thing, not the SKU. A supplier logo strip is a deliberate, separate
 * exception and lives in markup rather than in a sentence.
 *
 * Deliberately excluded as too ambiguous to match on: Hunter, Vista, Toro.
 * They are ordinary words and a regex cannot tell which sense is meant.
 */
const MANUFACTURERS =
  /\b(Belgard|Calstone|Rain\s?Bird|Netafim|Rachio|Irritrol|FX\s?Luminaire|Unilock|Techo-?Bloc|Smart\s?Rain)\b/g;

/** Em-dash. House style uses a comma, a semicolon or a colon instead. */
const EM_DASH = /—/g;

/** Prose elements. The rules about writing apply to writing, not to markup. */
const PROSE_ELEMENTS = /<(p|li|blockquote|h1|h2|h3|h4|figcaption|dd)\b[^>]*>([\s\S]*?)<\/\1>/gi;

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
  ]) {
    pattern.lastIndex = 0;
    for (const match of visible.matchAll(pattern)) {
      report(file, rule, `"${match[0]}" in: ...${excerpt(visible, match.index)}...`);
    }
  }

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
  }
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
 * A page counts as gated because it rendered the veil, not because of its
 * path, so a gated page that somehow lost its veil is caught here rather than
 * assumed safe.
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
    (source.includes('data-gate-veil') ? gated : open).push(entry);
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
    ...new Set(gated.map((p) => `/${p.route.split('/').filter(Boolean)[0] ?? ''}`)),
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
checkTownPagesDiffer(pages, bodies);
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
