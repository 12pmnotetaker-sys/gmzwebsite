// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { searchIndexing, isGatedPath } from './src/data/publication.ts';
import { canonicalPath } from './src/data/canonical.ts';

/**
 * The canonical production origin. Drives canonical link tags, Open Graph
 * tags and the sitemap. Nothing else in the repo hardcodes an origin.
 */
const SITE = process.env.SITE_URL ?? 'https://www.gmzlandscape.com';

/**
 * The sitemap is only generated once the site is worth finding. See
 * src/data/publication.ts: robots.txt, the noindex meta tag and this
 * integration are the three signals that have to agree with each other. The
 * gated portfolio is excluded here regardless, because it is never indexable.
 *
 * `serialize` runs every URL through the same canonical helper the <link
 * rel="canonical"> tag uses, so the sitemap cannot offer `/about/` while the
 * page itself disavows it in favour of `/about`.
 */
export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'ignore',
  integrations: searchIndexing.enabled
    ? [
        sitemap({
          // The gated portfolio never appears in the sitemap, whatever the
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
