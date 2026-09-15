/**
 * Where an emailed link lands.
 *
 * The token in the path is exchanged for a session and the client is sent to
 * their garden or their project. An expired or spent link goes to the
 * recovery screen with a note saying which address it was for, so the screen
 * can offer a new link without asking; a link that was never issued goes to
 * the same screen with no note, and the screen asks.
 *
 * Nothing is rendered here, so there is nothing for a mail scanner to read
 * and nothing for a browser to keep in history but a redirect.
 */
import type { APIRoute } from 'astro';
import { routes } from '@data/portal/routes';
import {
  consumeSignInToken,
  createSession,
  landingFor,
  maskEmail,
  setNotice,
  setSessionCookie,
} from '../../../server/auth';
import { portalConfigured } from '../../../server/env';

export const prerender = false;

export const GET: APIRoute = async ({ params, cookies, url, redirect }) => {
  if (!portalConfigured()) return redirect(routes.signIn, 302);

  const outcome = await consumeSignInToken(params.token ?? '');

  if (outcome.state === 'ok') {
    const session = await createSession(outcome.client.id);
    setSessionCookie(cookies, url, session);
    return redirect(landingFor(outcome.client), 303);
  }

  if (outcome.state === 'expired') {
    setNotice(cookies, url, {
      kind: 'link-expired',
      masked: maskEmail(outcome.client.email),
      token: params.token,
    });
  }
  return redirect(routes.linkExpired, 303);
};
