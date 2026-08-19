/**
 * Whether this site is ready to be found, and which parts never are.
 *
 * Two separate decisions live here, and they must not be conflated.
 *
 * `searchIndexing.enabled` covers the PUBLIC marketing site. It is off while
 * that site is a scaffold: a placeholder page Google indexes ranks for the
 * business's own name and shows a visitor nothing. Phase 2 turns it on.
 *
 * `gatedPrefixes` covers the PRIVATE portfolio, and is not a phase. Those
 * routes are never indexable, never in the sitemap, and always disallowed in
 * robots.txt, whatever `searchIndexing.enabled` says. Turning the marketing
 * site on must not drag the portfolio into a search result with it, which is
 * exactly the mistake this file exists to make impossible.
 *
 * Three signals read these values and have to agree: the `noindex` meta tag in
 * BaseLayout, robots.txt, and the sitemap integration. `scripts/content-lint.mjs`
 * fails the build if they ever disagree.
 *
 * Imported by `astro.config.mjs`, so keep this dependency-free: no path
 * aliases, no Astro globals.
 */
export const searchIndexing = {
  enabled: false,
  /** Why it is off, surfaced in robots.txt so the reason is not lost. */
  reason: 'Scaffold. No content yet; nothing here is worth indexing.',
} as const;

/**
 * Route prefixes that sit behind the unlock veil.
 *
 * The veil itself is a courtesy screen, not access control: the code ships in
 * the client bundle and every page stays fetchable by URL. What actually keeps
 * this work out of a search result is the three signals below. Keep them
 * together; dropping one while keeping the others is a contradictory signal.
 */
export const gatedPrefixes = ['/portfolio'] as const;

/** True when a path sits behind the veil. Used by BaseLayout and the sitemap. */
export function isGatedPath(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/';
  return gatedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
