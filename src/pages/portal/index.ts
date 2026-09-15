/**
 * The bare prefix. Not a screen: a signed-in client goes to their garden or
 * project, anyone else to sign-in. It has to be a route of its own because
 * the platform answers a path with no route before the function is asked.
 */
import type { APIRoute } from 'astro';
import { routes } from '@data/portal/routes';
import { landingFor } from '../../server/auth';

export const prerender = false;

export const GET: APIRoute = ({ locals, redirect }) =>
  redirect(locals.client ? landingFor(locals.client) : routes.signIn, 302);
