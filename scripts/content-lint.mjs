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
    const alt = tag[0].match(/\salt\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const value = alt?.[1] ?? alt?.[2];
    if (value === undefined)
      report(file, 'missing-alt', `<img> with no alt attribute: ${tag[0].slice(0, 90)}`);
    else if (value.trim() === '' && !/\brole\s*=\s*["']presentation["']/i.test(tag[0]))
      report(
        file,
        'empty-alt',
        `<img> with empty alt and no presentation role: ${tag[0].slice(0, 90)}`,
      );
  }
}

/**
 * The three search signals have to agree.
 *
 * robots.txt, the noindex meta tag and the sitemap are one decision expressed
 * three times. Turning one on and leaving the others behind tells a crawler two
 * different things at once, which is the failure the portfolio's config
 * comments warn about at length. This asserts they match.
 */
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
  const allowed = /^\s*Disallow:\s*$/m.test(robots) || /^\s*Allow:\s*\/\s*$/m.test(robots);
  const disallowed = /^\s*Disallow:\s*\/\s*$/m.test(robots);
  const hasSitemap = existsSync(path.join(DIST, 'sitemap-index.xml'));

  const html = files.filter((f) => f.endsWith('.html'));
  const noindexed = [];
  for (const file of html) {
    const source = await readFile(file, 'utf8');
    if (/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(source)) noindexed.push(file);
  }
  const allNoindexed = html.length > 0 && noindexed.length === html.length;
  const noneNoindexed = noindexed.length === 0;

  if (disallowed && !allNoindexed) {
    problems.push({
      file: 'dist/',
      rule: 'indexing',
      detail: `robots.txt disallows everything but ${html.length - noindexed.length} page(s) lack a noindex tag.`,
    });
  }
  if (disallowed && hasSitemap) {
    problems.push({
      file: 'dist/sitemap-index.xml',
      rule: 'indexing',
      detail: 'A sitemap was generated while robots.txt disallows the whole site.',
    });
  }
  if (allowed && !disallowed && !noneNoindexed) {
    problems.push({
      file: 'dist/',
      rule: 'indexing',
      detail: `robots.txt allows crawling but ${noindexed.length} page(s) still carry noindex.`,
    });
  }
  if (allowed && !disallowed && !hasSitemap) {
    problems.push({
      file: 'dist/',
      rule: 'indexing',
      detail: 'robots.txt allows crawling but no sitemap was generated.',
    });
  }
}

/* ---- Run --------------------------------------------------------------- */

if (!existsSync(DIST)) {
  console.error('content-lint: dist/ not found. Run `astro build` first.');
  process.exit(1);
}

const files = await walk(DIST);
const pages = files.filter((f) => f.endsWith('.html'));

for (const file of pages) {
  checkDocument(file, await readFile(file, 'utf8'));
}
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
