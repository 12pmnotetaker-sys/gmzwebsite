import type { APIRoute } from 'astro';
import { searchIndexing, gatedPrefixes } from '@data/publication';
import { site } from '@data/site';

/**
 * robots.txt, generated so it cannot drift from the rest of the site.
 *
 * The gated portfolio is disallowed in both branches. It is not part of the
 * phase switch: those routes stay out of search whether or not the marketing
 * site is indexable.
 */
export const GET: APIRoute = ({ site: origin }) => {
  const base = origin ?? new URL(site.url);
  const gated = gatedPrefixes.map((prefix) => `Disallow: ${prefix}/`);

  const body = searchIndexing.enabled
    ? [
        '# The portfolio is private and stays out of search permanently.',
        'User-agent: *',
        ...gated,
        'Allow: /',
        '',
        `Sitemap: ${new URL('sitemap-index.xml', base).href}`,
        '',
      ].join('\n')
    : [
        `# ${searchIndexing.reason}`,
        '# The portfolio is private and stays out of search permanently.',
        'User-agent: *',
        'Disallow: /',
        '',
      ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
