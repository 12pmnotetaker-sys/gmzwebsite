#!/usr/bin/env node
/**
 * Does every old address still land somewhere?
 *
 * The cutover from the old site depends on a redirect map in vercel.json,
 * written by hand from the old site's page list. This checks that map
 * against a deployment: every old path is fetched, redirects are followed,
 * and anything that does not end on a 200 is reported.
 *
 *   node scripts/check-redirects.mjs https://<deployment>.vercel.app old-paths.txt
 *
 * `old-paths.txt` is one path per line, as they were on the old site:
 * `/services`, `/about-us`, `/contact-us`. Blank lines and lines starting
 * with # are ignored. Exit status is the number of paths that failed, so it
 * can gate a deploy.
 *
 * Pass `--allow-query` if the old site had query-string addresses; without
 * it a path carrying `?` is reported, because a redirect that only matches
 * the bare path would miss it.
 */
import { readFile } from 'node:fs/promises';

const [base, file, ...flags] = process.argv.slice(2);
if (!base || !file) {
  console.error('usage: node scripts/check-redirects.mjs <deployment-url> <old-paths.txt>');
  process.exit(2);
}
const allowQuery = flags.includes('--allow-query');

const lines = (await readFile(file, 'utf8'))
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

let failed = 0;
for (const oldPath of lines) {
  if (oldPath.includes('?') && !allowQuery) {
    console.log(`?    ${oldPath}  carries a query string; the map matches bare paths`);
    failed += 1;
    continue;
  }
  const url = new URL(oldPath, base).href;
  try {
    const response = await fetch(url, { redirect: 'follow' });
    const landed = new URL(response.url).pathname;
    const moved = landed !== new URL(url).pathname;
    if (response.ok) {
      console.log(`${moved ? '->' : 'ok'}   ${oldPath}${moved ? `  ->  ${landed}` : ''}`);
    } else {
      console.log(`${response.status}  ${oldPath}  landed on ${landed}`);
      failed += 1;
    }
  } catch (error) {
    console.log(`!!   ${oldPath}  ${error instanceof Error ? error.message : String(error)}`);
    failed += 1;
  }
}

console.log(`\n${lines.length - failed} of ${lines.length} old paths land on a page.`);
process.exit(failed);
