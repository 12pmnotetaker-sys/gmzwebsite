/**
 * Who is asking, on every portal request.
 *
 * Runs for the on-demand routes, which is everything under /portal. Reads
 * the session cookie, looks the session up, and puts the client on
 * `locals.client` for the page. Anyone without a session is sent to the
 * sign-in screen, except on the handful of screens that exist for people
 * who are not signed in yet.
 *
 * Two things it refuses outright. A POST whose Origin is another site, so a
 * page elsewhere cannot submit a request or an approval on a signed-in
 * client's behalf. And any request for a portal page when the portal has no
 * database, which is answered by the sign-in screen saying so rather than by
 * a page pretending.
 *
 * The marketing site never comes through here. Its pages are prerendered,
 * and this returns immediately for anything outside the prefix.
 */
import { defineMiddleware } from 'astro:middleware';
import {
  PORTAL_PREFIX,
  publicPortalPaths,
  publicPortalPrefixes,
  routes,
} from '@data/portal/routes';
import { SESSION_COOKIE, readSession } from './server/auth';
import { portalConfigured } from './server/env';

const trimmed = (pathname: string) => pathname.replace(/\/+$/, '') || '/';

const isPublic = (pathname: string) =>
  publicPortalPaths.some((path) => path === pathname) ||
  publicPortalPrefixes.some((prefix) => pathname.startsWith(prefix));

/** True when a POST plainly came from another origin. */
function crossSite(request: Request, url: URL): boolean {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).host !== url.host;
    } catch {
      return true;
    }
  }
  const site = request.headers.get('sec-fetch-site');
  return site !== null && site !== 'same-origin' && site !== 'none';
}

export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = trimmed(context.url.pathname);
  if (pathname !== PORTAL_PREFIX && !pathname.startsWith(`${PORTAL_PREFIX}/`)) {
    return next();
  }

  context.locals.client = null;

  if (context.request.method === 'POST' && crossSite(context.request, context.url)) {
    return new Response('Cross-site request refused.', { status: 403 });
  }

  // The bare prefix is not a screen. Send it where a client would start.
  if (pathname === PORTAL_PREFIX) return context.redirect(routes.signIn, 302);

  if (portalConfigured()) {
    const token = context.cookies.get(SESSION_COOKIE)?.value;
    if (token) context.locals.client = await readSession(token);
  }

  if (isPublic(pathname)) return next();
  if (!context.locals.client) return context.redirect(routes.signIn, 302);

  const response = await next();
  // A signed-in page is for one person. Nothing between here and them may keep a copy.
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
});
