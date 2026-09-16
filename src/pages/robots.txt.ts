import type { APIRoute } from 'astro';
import { searchIndexing, gatedPrefixes, adminPrefixes } from '@data/publication';
import { site } from '@data/site';

/**
 * robots.txt, generated so it cannot drift from the rest of the site.
 *
 * The gated portfolio and the admin tool are disallowed in both branches.
 * Neither is part of the phase switch: those routes stay out of search
 * whether or not the marketing site is indexable.
 */
export const GET: APIRoute = ({ site: origin }) => {
  const base = origin ?? new URL(site.url);
  const neverIndexed = [...gatedPrefixes, ...adminPrefixes].map((prefix) => `Disallow: ${prefix}/`);

  const body = searchIndexing.enabled
    ? [
        '# The portfolio is private and the admin tool is staff-only; both stay out of search permanently.',
        'User-agent: *',
        ...neverIndexed,
        'Allow: /',
        '',
        `Sitemap: ${new URL('sitemap-index.xml', base).href}`,
        '',
      ].join('\n')
    : [
        `# ${searchIndexing.reason}`,
        '# The portfolio is private and the admin tool is staff-only; both stay out of search permanently.',
        'User-agent: *',
        'Disallow: /',
        '',
      ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
