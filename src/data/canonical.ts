/**
 * The canonical URL form for this site, in one place.
 *
 * Pages are built with `build.format: 'directory'`, so Astro emits
 * `/about/index.html` and a page's own pathname arrives with a trailing
 * slash. The form we advertise has no trailing slash, which is what the
 * hosts serve (`cleanUrls` on Vercel) and what the canonical tag claims.
 *
 * This lives here rather than inline because two places need it: the
 * `<link rel="canonical">` tag in `SEO.astro` and the sitemap entries in
 * `astro.config.mjs`. Written twice they drift, and a sitemap that offers
 * `/about/` while the page's canonical tag disavows it in favour of
 * `/about` is the site arguing with itself in front of a crawler.
 *
 * Imported by `astro.config.mjs`, so keep it dependency-free: no path
 * aliases, no Astro globals, nothing that needs the app to be running.
 */

/** Strip the trailing slash from a path, leaving the site root as `/`. */
export function canonicalPath(pathname: string): string {
  return pathname.replace(/\/$/, '') || '/';
}

/** The canonical absolute URL for a path, against a given origin. */
export function canonicalUrl(pathname: string, origin: string | URL): URL {
  return new URL(canonicalPath(pathname), origin);
}
