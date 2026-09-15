/**
 * Every route in the client portal, once.
 *
 * The prototype was one component switching on a `screen` string, and every
 * button called `go('service')`. Here every screen is a real page under
 * `/portal`, and every link to one reads its path from this map, so renaming a
 * route is one edit rather than a search through eighteen files.
 *
 * Two entry points. A garden client arrives at `garden`; a project client with
 * a proposal waiting arrives at `project`. In production the link in the email
 * or the text carries a token that decides which; in this pass the sign-in
 * screen sends a demo visitor to the garden.
 *
 * The whole prefix is private: `/portal` is in `gatedPrefixes`, so robots.txt
 * disallows it and the sitemap never lists it, and PortalLayout sets noindex
 * on every page regardless of the marketing site's indexing state.
 */
export const PORTAL_PREFIX = '/portal';

export const routes = {
  /** The front door from the marketing site's nav. */
  signIn: `${PORTAL_PREFIX}/sign-in`,
  /** Recovery. A first-class screen, not an afterthought. */
  linkExpired: `${PORTAL_PREFIX}/link-expired`,

  /* The garden client */
  garden: `${PORTAL_PREFIX}/garden`,
  service: `${PORTAL_PREFIX}/garden/service`,
  visit: `${PORTAL_PREFIX}/garden/visits/latest`,
  plants: `${PORTAL_PREFIX}/garden/plants`,
  /** One page per plant on record; see `plantHref` in plants.ts. */
  plant: (slug: string) => `${PORTAL_PREFIX}/garden/plants/${slug}`,
  applicationNotice: `${PORTAL_PREFIX}/garden/applications/upcoming`,
  applicationRecord: `${PORTAL_PREFIX}/garden/applications/latest`,
  documents: `${PORTAL_PREFIX}/garden/documents`,
  ask: `${PORTAL_PREFIX}/garden/ask`,
  asked: `${PORTAL_PREFIX}/garden/ask/sent`,
  offer: `${PORTAL_PREFIX}/garden/offers/autumn-planting`,

  /* The project client */
  project: `${PORTAL_PREFIX}/project`,
  proposal: `${PORTAL_PREFIX}/project/proposal`,
  confirm: `${PORTAL_PREFIX}/project/proposal/approve`,
  approved: `${PORTAL_PREFIX}/project/proposal/approved`,
  change: `${PORTAL_PREFIX}/project/change-orders/1`,
  /** The project client's request form is the same form, entered from the project. */
  projectAsk: `${PORTAL_PREFIX}/project/ask`,
} as const;

/** What the nav calls it. */
export const portalNav = { label: 'Client portal', href: routes.signIn } as const;
