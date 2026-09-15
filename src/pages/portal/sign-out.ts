/**
 * Ends the session. A POST from the footer's "Sign out", never a GET, so a
 * link in an email or an image tag on another page cannot sign a client out.
 */
import type { APIRoute } from 'astro';
import { routes } from '@data/portal/routes';
import { SESSION_COOKIE, clearSessionCookie, destroySession, setNotice } from '../../server/auth';
import { portalConfigured } from '../../server/env';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, url, redirect }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token && portalConfigured()) await destroySession(token);
  clearSessionCookie(cookies, url);
  setNotice(cookies, url, { kind: 'signed-out' });
  return redirect(routes.signIn, 303);
};

export const GET: APIRoute = ({ redirect }) => redirect(routes.signIn, 302);
