/**
 * Every route in the client portal, once.
 *
 * The prototype was one component switching on a `screen` string, and every
 * button called `go('service')`. Here every screen is a real page under
 * `/portal`, and every link to one reads its path from this map, so renaming a
 * route is one edit rather than a search through eighteen files.
 *
 * Two entry points. A garden client arrives at `garden`; a project client with
 * a proposal waiting arrives at `project`. The link in the email carries a
 * token that decides which, through `auth`; the sign-in screen is where a
 * client without a link starts.
 *
 * The whole prefix is private: `/portal` is in `gatedPrefixes`, so robots.txt
 * disallows it and the sitemap never lists it, and PortalLayout sets noindex
 * on every page regardless of the marketing site's indexing state. Every
 * page here is rendered on demand for the signed-in client; see
 * `src/middleware.ts`.
 */
export const PORTAL_PREFIX = '/portal';

export const routes = {
  /** The front door from the marketing site's nav. */
  signIn: `${PORTAL_PREFIX}/sign-in`,
  /** Recovery. A first-class screen, not an afterthought. */
  linkExpired: `${PORTAL_PREFIX}/link-expired`,
  /** Where an emailed link lands. The token is exchanged for a session here. */
  auth: (token: string) => `${PORTAL_PREFIX}/auth/${token}`,
  /** Ends the session. A POST, from the footer. */
  signOut: `${PORTAL_PREFIX}/sign-out`,
  /** Where a screen goes when its record cannot be read. A rewrite, never a link. */
  unavailable: `${PORTAL_PREFIX}/unavailable`,

  /* The garden client */
  garden: `${PORTAL_PREFIX}/garden`,
  service: `${PORTAL_PREFIX}/garden/service`,
  visit: `${PORTAL_PREFIX}/garden/visits/latest`,
  plants: `${PORTAL_PREFIX}/garden/plants`,
  /** One page per plant on record. */
  plant: (slug: string) => `${PORTAL_PREFIX}/garden/plants/${slug}`,
  applicationNotice: `${PORTAL_PREFIX}/garden/applications/upcoming`,
  applicationRecord: `${PORTAL_PREFIX}/garden/applications/latest`,
  documents: `${PORTAL_PREFIX}/garden/documents`,
  /** Opens the nth document on the shelf, when it is a file in storage. */
  document: (index: number) => `${PORTAL_PREFIX}/garden/documents/${index}`,
  ask: `${PORTAL_PREFIX}/garden/ask`,
  /** The receipt, by the reference the client was given. */
  asked: (reference: string) => `${PORTAL_PREFIX}/garden/ask/sent/${reference}`,
  offer: (slug: string) => `${PORTAL_PREFIX}/garden/offers/${slug}`,

  /* The project client */
  project: `${PORTAL_PREFIX}/project`,
  proposal: `${PORTAL_PREFIX}/project/proposal`,
  confirm: `${PORTAL_PREFIX}/project/proposal/approve`,
  approved: `${PORTAL_PREFIX}/project/proposal/approved`,
  change: (id: number) => `${PORTAL_PREFIX}/project/change-orders/${id}`,
  changeConfirm: (id: number) => `${PORTAL_PREFIX}/project/change-orders/${id}/approve`,
  changeApproved: (id: number) => `${PORTAL_PREFIX}/project/change-orders/${id}/approved`,
  /** The project client's request form is the same form, entered from the project. */
  projectAsk: `${PORTAL_PREFIX}/project/ask`,
  /** And its receipt, in the project's own chrome. */
  projectAsked: (reference: string) => `${PORTAL_PREFIX}/project/ask/sent/${reference}`,
} as const;

/**
 * The screens a person can reach without a session. Everything else under
 * the prefix needs one, and the middleware sends anyone without one here.
 */
export const publicPortalPaths = [routes.signIn, routes.linkExpired, routes.signOut] as const;
export const publicPortalPrefixes = [`${PORTAL_PREFIX}/auth/`] as const;

/** What the nav calls it. */
export const portalNav = { label: 'Client portal', href: routes.signIn } as const;
