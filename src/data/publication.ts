/**
 * Whether this site is ready to be found, and which parts never are.
 *
 * Two separate decisions live here, and they must not be conflated.
 *
 * `searchIndexing.enabled` covers the PUBLIC marketing site. It follows one
 * environment variable, `SEARCH_INDEXING`, and is on only when that is set to
 * `on`. Nothing in the repository turns it on: the flip belongs to the
 * production environment on the day the domain moves, so that a preview
 * deployment, a branch build and a local build all stay `noindex`, and the
 * live site opens to search the moment it is the live site and not before.
 * `docs/go-live.md` is the runbook.
 *
 * `gatedPrefixes` covers the PRIVATE portfolio and the client portal, and is
 * not a phase. Those routes are never indexable, never in the sitemap, and
 * always disallowed in robots.txt, whatever `searchIndexing.enabled` says.
 * Turning the marketing site on must not drag the portfolio into a search
 * result with it, which is exactly the mistake this file exists to make
 * impossible.
 *
 * Three signals read these values and have to agree: the `noindex` meta tag in
 * BaseLayout, robots.txt, and the sitemap integration. `scripts/content-lint.mjs`
 * fails the build if they ever disagree, and CI builds the site in both states
 * so the published state is checked on every push, not only on launch day.
 *
 * Imported by `astro.config.mjs`, so keep this dependency-free: no path
 * aliases, no Astro globals.
 */
const flag = (typeof process !== 'undefined' ? process.env.SEARCH_INDEXING : undefined) ?? '';

export const searchIndexing = {
  enabled: flag.trim().toLowerCase() === 'on',
  /** Why it is off, surfaced in robots.txt so the reason is not lost. */
  reason:
    'Not yet live. Indexing opens when SEARCH_INDEXING=on is set on the production deployment; see docs/go-live.md.',
} as const;

/**
 * Route prefixes that are private.
 *
 * The veil itself is a courtesy screen, not access control: the code ships in
 * the client bundle and every page stays fetchable by URL. What actually keeps
 * this work out of a search result is the three signals below. Keep them
 * together; dropping one while keeping the others is a contradictory signal.
 */
export const gatedPrefixes = ['/portfolio', '/portal', '/admin', '/staff'] as const;

/**
 * Of the gated prefixes, the ones BaseLayout draws the unlock veil over.
 *
 * `/portfolio` is a courtesy screen over a public build. `/portal` is not: it
 * is the client portal, with its own sign-in screen, its own layout and a
 * session behind every page, and it never renders the veil. It is in
 * `gatedPrefixes` so that robots.txt disallows it and the sitemap never lists
 * it, and PortalLayout sets noindex on every page itself. Nothing under
 * /portal uses BaseLayout, so this list only matters if someone later does.
 */
export const veiledPrefixes = ['/portfolio'] as const;

/** True when a path is one the veil belongs over. */
export function isVeiledPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/';
  return veiledPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** True when a path is private. Used by BaseLayout and the sitemap. */
export function isGatedPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/';
  return gatedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
