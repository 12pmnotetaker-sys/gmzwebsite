/// <reference types="astro/client" />

/**
 * What the middleware hands every on-demand page.
 *
 * `client` is the signed-in portal client, or null. It is set from the
 * session cookie in `src/middleware.ts` and is the only thing a portal page
 * should trust about who is asking; every record load takes its id from
 * here and nowhere else.
 */
declare namespace App {
  interface Locals {
    client: import('./server/auth').PortalClient | null;
  }
}
