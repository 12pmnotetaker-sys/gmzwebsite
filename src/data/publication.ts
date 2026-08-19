/**
 * Whether this site is ready to be found.
 *
 * Phase 0 is a scaffold: the routes exist, the design system works, the build
 * gate runs, and there is no content on any of it. A placeholder page that
 * Google indexes is worse than no page, because it ranks for the business's
 * own name and shows a visitor nothing.
 *
 * So indexing is off, and it is off in all three places that matter at once:
 * `noindex` on every page, `Disallow: /` in robots.txt, and no sitemap. Those
 * three have to agree. Dropping one while keeping the others is a
 * contradictory signal, which is the mistake the portfolio's config comments
 * warn about at length.
 *
 * Flip `enabled` to true in Phase 2, when there is a real site behind it. That
 * one change turns on all three.
 *
 * Imported by `astro.config.mjs`, so keep this dependency-free: no path
 * aliases, no Astro globals.
 */
export const searchIndexing = {
  enabled: false,
  /** Why it is off, surfaced in robots.txt so the reason is not lost. */
  reason: 'Scaffold. No content yet; nothing here is worth indexing.',
} as const;
