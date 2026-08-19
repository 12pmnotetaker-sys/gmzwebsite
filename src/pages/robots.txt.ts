import type { APIRoute } from 'astro';
import { searchIndexing } from '@data/publication';
import { site } from '@data/site';

/**
 * robots.txt, generated so it cannot drift from the rest of the site.
 *
 * This is one of the three signals that have to agree with each other: the
 * `noindex` meta tag in BaseLayout, the sitemap integration in
 * astro.config.mjs, and this file. All three read `searchIndexing.enabled`, so
 * there is no way to turn one on and leave the others behind.
 */
export const GET: APIRoute = ({ site: origin }) => {
  const base = origin ?? new URL(site.url);

  const body = searchIndexing.enabled
    ? [
        'User-agent: *',
        'Allow: /',
        '',
        `Sitemap: ${new URL('sitemap-index.xml', base).href}`,
        '',
      ].join('\n')
    : [`# ${searchIndexing.reason}`, 'User-agent: *', 'Disallow: /', ''].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
