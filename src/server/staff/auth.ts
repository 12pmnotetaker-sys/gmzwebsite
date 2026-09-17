/**
 * Who is signed in as staff, and how they got there.
 *
 * Shaped exactly like the client portal's password path in
 * `src/server/auth.ts`, deliberately: one address, one password, a throttle
 * keyed by the typed address so a wrong guess costs the same time whether or
 * not that address is staff, and a session that is a hashed token in a
 * cookie, never a secret kept in the database.
 *
 * There is no staff email link, unlike the portal: a staff account either has
 * a password, set with `npm run staff -- password --email <email>`, or it
 * cannot sign in yet. Nothing here reaches the Admin operations tables; a
 * staff sign-in has no business there.
 */
import type { AstroCookies } from 'astro';
import { db } from '../db';
import { hashPassword, hashToken, newToken, verifyPassword } from '../crypto';

export interface StaffMember {
  id: string;
  email: string;
  name: string;
}

/** How many wrong passwords one typed address gets in a quarter of an hour. */
const PASSWORD_TRIES = 10;
const PASSWORD_WINDOW_MS = 15 * 60 * 1000;
/** A session lasts a month of not signing in. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const STAFF_COOKIE = 'gmz_staff';

const asStaff = (row: Record<string, unknown>): StaffMember => ({
  id: String(row.id),
  email: String(row.email),
  name: String(row.name),
});

async function findStaffByEmail(
  email: string,
): Promise<(StaffMember & { passwordHash: string | null }) | null> {
  const { data, error } = await db()
    .from('gmz_staff_accounts')
    .select('id, email, name, password_hash')
    .eq('email', email.trim())
    .eq('active', true)
    .maybeSingle();
  if (error) throw new Error(`staff: account lookup failed: ${error.message}`);
  if (!data) return null;
  return { ...asStaff(data), passwordHash: (data.password_hash as string | null) ?? null };
}

/**
 * A hash to check a guess against when the address is not staff or has no
 * password, so a wrong guess takes the same time either way. Made once, at
 * startup, from a password nobody has.
 */
const decoyHash: Promise<string> = hashPassword(newToken());

/**
 * The staff member, when the password matches one on file. Null otherwise,
 * with no reason given. Wrong guesses are counted against the typed address,
 * whether or not it is staff, and after too many in a quarter of an hour
 * every guess is refused until the window passes.
 */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<StaffMember | null> {
  const typed = email.trim();
  const since = new Date(Date.now() - PASSWORD_WINDOW_MS).toISOString();
  const { count } = await db()
    .from('gmz_staff_password_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('email', typed)
    .gte('attempted_at', since);
  if ((count ?? 0) >= PASSWORD_TRIES) return null;

  const staff = await findStaffByEmail(typed);
  const hash = staff?.passwordHash ?? (await decoyHash);
  const ok = (await verifyPassword(password, hash)) && Boolean(staff?.passwordHash);
  if (!ok || !staff) {
    const { error } = await db().from('gmz_staff_password_attempts').insert({ email: typed });
    if (error) console.error(`staff: could not record a failed password try: ${error.message}`);
    return null;
  }
  const { passwordHash: _omit, ...rest } = staff;
  return rest;
}

/* ---- Sessions -------------------------------------------------------- */

export async function createSession(staffId: string): Promise<string> {
  const token = newToken();
  const { error } = await db()
    .from('gmz_staff_sessions')
    .insert({
      staff_id: staffId,
      token_hash: hashToken(token),
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    });
  if (error) throw new Error(`staff: could not create a session: ${error.message}`);
  return token;
}

export async function readSession(token: string | undefined): Promise<StaffMember | null> {
  if (!token || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  const { data, error } = await db()
    .from('gmz_staff_sessions')
    .select('id, expires_at, last_seen_at, gmz_staff_accounts ( id, email, name, active )')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (error) {
    console.error(`staff: session lookup failed: ${error.message}`);
    return null;
  }
  const account = data?.gmz_staff_accounts as unknown as {
    id: string;
    email: string;
    name: string;
    active: boolean;
  } | null;
  if (!data || !account || !account.active) return null;
  if (new Date(data.expires_at as string).getTime() < Date.now()) return null;

  const lastSeen = new Date(data.last_seen_at as string).getTime();
  if (Date.now() - lastSeen > 60 * 60 * 1000) {
    await db()
      .from('gmz_staff_sessions')
      .update({
        last_seen_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      })
      .eq('id', data.id);
  }
  return asStaff(account);
}

export async function destroySession(token: string): Promise<void> {
  await db().from('gmz_staff_sessions').delete().eq('token_hash', hashToken(token));
}

/* ---- Cookies --------------------------------------------------------- */

const secure = (url: URL) => url.protocol === 'https:';

export function setSessionCookie(cookies: AstroCookies, url: URL, token: string): void {
  cookies.set(STAFF_COOKIE, token, {
    path: '/staff',
    httpOnly: true,
    secure: secure(url),
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(cookies: AstroCookies, url: URL): void {
  cookies.delete(STAFF_COOKIE, { path: '/staff', secure: secure(url) });
}
