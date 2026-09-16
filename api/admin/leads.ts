/**
 * The admin leads endpoint.
 *
 * Serves and updates rows in `website_leads` for the staff-only `/admin`
 * panel. Like `api/enquiry.ts`, this is a plain Vercel Function outside
 * `src/`, bundled by Vercel rather than by Astro, reachable at
 * `/api/admin/leads`, and deliberately dependency-free.
 *
 * ## Authorization
 *
 * Two checks, both required on every request:
 *
 *   1. The bearer token is a real, current Supabase session. It is verified
 *      against Supabase Auth on every call, not decoded or trusted locally.
 *   2. The signed-in email is on the `ADMIN_ALLOWED_EMAILS` allowlist.
 *
 * Staff accounts are created in the Supabase dashboard (Authentication ->
 * Users), not by this endpoint, and the allowlist is a Vercel environment
 * variable, not a table anything here can write to. There is no sign-up path.
 *
 * ## Configuration
 *
 * Every value is an environment variable on the Vercel project.
 *
 *   SUPABASE_URL                 already required by api/enquiry.ts
 *   SUPABASE_SERVICE_ROLE_KEY    already required by api/enquiry.ts
 *   ADMIN_ALLOWED_EMAILS         comma-separated staff emails, case-insensitive
 *
 * With any of these unset, the endpoint refuses every request with a 503
 * rather than quietly serving nothing or accepting everyone: an unconfigured
 * admin endpoint that appears to work is a much worse failure than one that
 * says plainly that it is not set up yet.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { leadStatuses } from '../../src/data/leadStatus.js';

/** Largest PATCH body we will read. A status change and a note are nowhere near this. */
const MAX_BODY_BYTES = 16 * 1024;

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(json);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error('body too large');
    chunks.push(buffer);
  }
  if (size === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/**
 * The staff member behind a bearer token, or null if it does not check out.
 *
 * Calls Supabase Auth's own `/auth/v1/user` rather than decoding the JWT
 * locally, so a revoked or expired session is rejected the same request it
 * would be rejected by Supabase itself, with no separate expiry logic to keep
 * in sync here.
 */
async function staffEmail(
  token: string,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<string | null> {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const user = (await response.json()) as { email?: string };
  return user.email ?? null;
}

function isAllowed(email: string, allowlist: string): boolean {
  const allowed = allowlist
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const allowlist = process.env.ADMIN_ALLOWED_EMAILS;

  if (!supabaseUrl || !serviceRoleKey || !allowlist) {
    send(res, 503, { error: 'unconfigured' });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH');
    send(res, 405, { error: 'method-not-allowed' });
    return;
  }

  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
  if (!token) {
    send(res, 401, { error: 'unauthenticated' });
    return;
  }

  const email = await staffEmail(token, supabaseUrl, serviceRoleKey);
  if (!email || !isAllowed(email, allowlist)) {
    send(res, 403, { error: 'forbidden' });
    return;
  }

  const rest = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/website_leads`;
  const storeHeaders = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  if (req.method === 'GET') {
    const response = await fetch(`${rest}?select=*&order=created_at.desc`, {
      headers: storeHeaders,
    });
    if (!response.ok) {
      console.error(`admin/leads: store returned ${response.status} on read`);
      send(res, 502, { error: 'lead-store-unreachable' });
      return;
    }
    send(res, 200, { leads: await response.json() });
    return;
  }

  // PATCH: update one lead's status and/or staff notes. Nothing else on the
  // row is writable from here; a client's own words are not staff's to edit.
  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    send(res, 400, { error: 'unreadable' });
    return;
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const id = typeof input.id === 'string' ? input.id : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    send(res, 422, { error: 'invalid-id' });
    return;
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ('status' in input) {
    if (typeof input.status !== 'string' || !leadStatuses.some((s) => s.value === input.status)) {
      send(res, 422, { error: 'invalid-status' });
      return;
    }
    patch.status = input.status;
  }

  if ('staffNotes' in input) {
    if (typeof input.staffNotes !== 'string') {
      send(res, 422, { error: 'invalid-notes' });
      return;
    }
    patch.staff_notes = input.staffNotes.slice(0, 4000);
  }

  if (Object.keys(patch).length === 1) {
    // Only updated_at; nothing was actually asked to change.
    send(res, 422, { error: 'nothing-to-update' });
    return;
  }

  const response = await fetch(`${rest}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...storeHeaders, Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    console.error(`admin/leads: store returned ${response.status} on update`);
    send(res, 502, { error: 'lead-store-unreachable' });
    return;
  }

  const updated = (await response.json()) as unknown[];
  if (updated.length === 0) {
    send(res, 404, { error: 'not-found' });
    return;
  }

  send(res, 200, { lead: updated[0] });
}
