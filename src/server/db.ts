/**
 * The one database client, server side, with the service role.
 *
 * The service role bypasses row level security, which is the point: every
 * portal table has RLS on and no policies, so nothing but this client can
 * read a row. That puts the whole burden of "whose data is this" on the
 * server code, and every query in `src/server/` scopes by the signed-in
 * client's id for that reason. Never pass a client id in from a request.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, portalConfigured } from './env';

let cached: SupabaseClient | undefined;

/** Thrown when the portal has no database to talk to. Screens catch it and say so. */
export class PortalUnconfigured extends Error {
  constructor() {
    super('The portal is not configured: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are unset.');
    this.name = 'PortalUnconfigured';
  }
}

export function db(): SupabaseClient {
  if (!portalConfigured()) throw new PortalUnconfigured();
  if (!cached) {
    cached = createClient(env.supabaseUrl!, env.supabaseServiceKey!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { 'X-Client-Info': 'gmzwebsite-portal' } },
    });
  }
  return cached;
}

/** The private bucket. Every file in it belongs to one client, by path prefix. */
export const BUCKET = 'portal';

/**
 * A short-lived URL for a file in the private bucket, or undefined when the
 * file is not there. Pages call this at render time; the URL lives about as
 * long as the page view does.
 */
export async function signedUrl(path: string, seconds = 300): Promise<string | undefined> {
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(path, seconds);
  if (error || !data) {
    console.error(`portal: could not sign ${path}: ${error?.message ?? 'no data'}`);
    return undefined;
  }
  return data.signedUrl;
}
