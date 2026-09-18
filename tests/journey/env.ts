/**
 * What the journey needs from its surroundings, resolved once.
 *
 * The database comes from the environment: `SUPABASE_URL` and
 * `SUPABASE_SERVICE_ROLE_KEY` as the portal itself reads them, or the names
 * the Supabase CLI prints from `supabase status -o env`. The mail sink is a
 * directory under the repository that the dev server writes into and the
 * tests read from, so a sign-in link can be followed without a mailbox.
 */
import path from 'node:path';

export const PORT = 4400;
export const ORIGIN = `http://127.0.0.1:${PORT}`;
export const MAIL_SINK = path.resolve('.playwright/mail');

export const SEED = {
  garden: { email: 'kate.games@example.com', name: 'Kate Games' },
  project: { email: 'heron@example.com', name: 'Heron' },
} as const;

/** The two variables, or a message that says exactly what is missing. */
export function portalEnv(): { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string } {
  const url = process.env.SUPABASE_URL ?? process.env.API_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'The portal journey needs a database. Start the local stack with `npx supabase start`, ' +
        'then `eval "$(npx supabase status -o env)"`, and run again.',
    );
  }
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) {
    throw new Error(
      `The portal journey only runs against a local database, and ${new URL(url).host} is not one. ` +
        'Its setup deletes the example clients’ requests and approvals.',
    );
  }
  return { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key };
}
