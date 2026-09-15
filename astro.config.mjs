// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import { searchIndexing, isGatedPath } from './src/data/publication.ts';
import { canonicalPath } from './src/data/canonical.ts';

/**
 * The canonical production origin. Drives canonical link tags, Open Graph
 * tags and the sitemap. Portal emails use the origin of the request that
 * asked for the link, so a preview deployment sends links to itself.
 */
const SITE = process.env.SITE_URL ?? 'https://www.gmzlandscape.com';

/**
 * Two kinds of page, one build.
 *
 * The marketing site and the portfolio are prerendered: `output: 'static'`
 * is the default for every page, and they ship as files. The client portal
 * is rendered on demand, one request at a time, for the signed-in client:
 * every page under `src/pages/portal/` and the intake endpoint declare
 * `prerender = false`, and the Vercel adapter turns those into one function.
 *
 * The sitemap is only generated once the site is worth finding. See
 * src/data/publication.ts: robots.txt, the noindex meta tag and this
 * integration are the three signals that have to agree with each other. The
 * gated portfolio and the portal are excluded here regardless, because they
 * are never indexable.
 *
 * `serialize` runs every URL through the same canonical helper the <link
 * rel="canonical"> tag uses, so the sitemap cannot offer `/about/` while the
 * page itself disavows it in favour of `/about`.
 */
export default defineConfig({
  site: SITE,
  output: 'static',
  // Trust only this site's hosts when Vercel forwards requests to the function.
  // Keep Astro's origin check enabled for form submissions.
  security: {
    checkOrigin: true,
    allowedDomains: [
      ...new Set(
        [
          new URL(SITE).hostname,
          process.env.VERCEL_URL,
          process.env.VERCEL_BRANCH_URL,
          'gmzwebsite-git-codex-homepa-8a3419-12pmnotetaker-7527s-projects.vercel.app',
        ].filter((host) => typeof host === 'string' && host.length > 0),
      ),
    ].map((hostname) => ({ hostname })),
  },
  adapter: vercel({
    // Sharp at build time for the prerendered pages, and in the function for
    // anything rendered on demand. Vercel's own image service is not used, so
    // the portfolio's derivatives are the same files in every environment.
    imageService: false,
  }),
  trailingSlash: 'ignore',
  integrations: searchIndexing.enabled
    ? [
        sitemap({
          // The private routes never appear in the sitemap, whatever the
          // marketing site's indexing state.
          filter: (page) => !isGatedPath(new URL(page).pathname),
          serialize: (item) => ({
            ...item,
            url: new URL(canonicalPath(new URL(item.url).pathname), SITE).href,
          }),
        }),
      ]
    : [],
  image: {
    // Project photography is the whole point of the /work section, so keep the
    // optimizer on and let Astro emit responsive AVIF/WebP at build time.
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
  build: {
    format: 'directory',
  },
});
