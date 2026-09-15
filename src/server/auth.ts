/**
 * Who is signed in, and how they got there.
 *
 * Two ways in. The default is a link: a client types their address, and if it
 * is on file a link arrives that opens their garden or their project. The
 * other is a password, for accounts that were given one. Both end in the same
 * place, a session row and an HttpOnly cookie.
 *
 * What this never does:
 *
 *   * Say whether an address is on file. Asking for a link gets the same
 *     answer whether or not the address exists.
 *   * Put a token in a URL a person did not click. The link itself carries
 *     the token, once, and it is exchanged for a cookie on arrival.
 *   * Keep a token or a session secret in the database. Only hashes are
 *     stored, so a copy of the table opens nothing.
 */
import type { AstroCookies } from 'astro';
import { company, primaryPhone } from '@data/site';
import { routes } from '@data/portal/routes';
import { db } from './db';
import { hashPassword, hashToken, newToken, verifyPassword } from './crypto';
import { sendMail } from './mail';
import { mailConfigured } from './env';

export type ClientKind = 'garden' | 'project';

export interface PortalClient {
  id: string;
  email: string;
  name: string;
  kind: ClientKind;
}

/* ---- Constants, all in one place ------------------------------------- */

/** The link "stays live for seven days", as the expired-link screen promises. */
const LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * After first use a link keeps working for a few minutes. A mail scanner
 * that opens the link before the person does keeps no cookie, so it must not
 * be able to spend the link on their behalf.
 */
const LINK_GRACE_MS = 10 * 60 * 1000;
/**
 * How many links one address can ask for in a quarter of an hour before we
 * stop sending. The window is short on purpose: the throttle is there to stop
 * a stranger filling a client's inbox, and a stranger can trip it, so a
 * client it locks out is locked out for minutes rather than an hour.
 */
const LINKS_PER_WINDOW = 3;
const LINK_WINDOW_MS = 15 * 60 * 1000;
/** A session lasts a month of not signing in. */
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE = 'gmz_portal';
/**
 * A one-shot note from one screen to the next: which address a link went to,
 * or which expired token the recovery screen can reissue. Never in a URL.
 */
export const NOTICE_COOKIE = 'gmz_portal_notice';

/* ---- Lookups --------------------------------------------------------- */

const asClient = (row: Record<string, unknown>): PortalClient => ({
  id: String(row.id),
  email: String(row.email),
  name: String(row.name),
  kind: row.kind === 'project' ? 'project' : 'garden',
});

export async function findClientByEmail(
  email: string,
): Promise<(PortalClient & { passwordHash: string | null }) | null> {
  const { data, error } = await db()
    .from('portal_clients')
    .select('id, email, name, kind, password_hash')
    .eq('email', email.trim())
    .maybeSingle();
  if (error) throw new Error(`portal: client lookup failed: ${error.message}`);
  if (!data) return null;
  return { ...asClient(data), passwordHash: (data.password_hash as string | null) ?? null };
}

/** Where this client lands after signing in. */
export const landingFor = (client: Pick<PortalClient, 'kind'>): string =>
  client.kind === 'project' ? routes.project : routes.garden;

/** "k••••@gmail.com": enough to recognise, not enough to copy. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}••••@${domain}`;
}

/* ---- Links ----------------------------------------------------------- */

/**
 * Send a sign-in link to an address, if the address is on file and has not
 * asked for too many.
 *
 * Whatever happens, the screen shows the same "if that address is on file,
 * a link is on its way". An address that is not on file, one that has asked
 * too often, and one whose message the provider refused all come back
 * `silent`, because any difference tells a stranger which addresses are
 * clients. A refused message is logged for the office, and the sign-in
 * screen already says, from `mailConfigured()` alone and before any address
 * is typed, when links cannot be sent at all.
 *
 * What the screen cannot hide is time: an address on file costs a row and a
 * message, one that is not costs a lookup. The throttle bounds how often
 * anyone can measure it; it does not remove it.
 */
export type LinkIssue =
  /** A provider accepted the message. */
  | 'sent'
  /** Nothing was sent, and the screen must not say why. */
  | 'silent';

export async function issueSignInLink(
  email: string,
  origin: string,
): Promise<{ outcome: LinkIssue }> {
  const client = await findClientByEmail(email);
  if (!client) return { outcome: 'silent' };
  if (!mailConfigured()) {
    console.error('portal: a sign-in link was asked for with no mail provider configured');
    return { outcome: 'silent' };
  }

  const since = new Date(Date.now() - LINK_WINDOW_MS).toISOString();
  const { count } = await db()
    .from('portal_sign_in_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', client.id)
    .gte('created_at', since);
  if ((count ?? 0) >= LINKS_PER_WINDOW) return { outcome: 'silent' };

  const token = newToken();
  const { error } = await db()
    .from('portal_sign_in_tokens')
    .insert({
      client_id: client.id,
      token_hash: hashToken(token),
      expires_at: new Date(Date.now() + LINK_TTL_MS).toISOString(),
    });
  if (error) throw new Error(`portal: could not store a sign-in token: ${error.message}`);

  const link = new URL(routes.auth(token), origin).href;
  const sent = await sendMail({
    to: client.email,
    subject: `Your ${company.name} portal link`,
    text: [
      `Hello ${client.name},`,
      '',
      `Here is your link to the ${company.name} client portal:`,
      '',
      link,
      '',
      'It stays live for seven days. If you did not ask for it, you can ignore this email; nothing changes on your account.',
      '',
      `If the link does not work, call the office on ${primaryPhone.display} and we will read you anything the portal would show you.`,
      '',
      company.legalName,
    ].join('\n'),
  });
  if (!sent) console.error(`portal: the provider refused a sign-in link for client ${client.id}`);
  return { outcome: sent ? 'sent' : 'silent' };
}

export type LinkOutcome =
  | { state: 'ok'; client: PortalClient }
  | { state: 'expired'; client: PortalClient }
  | { state: 'invalid' };

/**
 * Exchange a link's token for the client it belongs to.
 *
 * Expired links still identify their client, so the recovery screen can offer
 * to send a new one to the same address without asking for it again.
 */
export async function consumeSignInToken(token: string): Promise<LinkOutcome> {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return { state: 'invalid' };

  const { data, error } = await db()
    .from('portal_sign_in_tokens')
    .select('id, expires_at, used_at, portal_clients ( id, email, name, kind )')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (error) throw new Error(`portal: token lookup failed: ${error.message}`);
  if (!data || !data.portal_clients) return { state: 'invalid' };

  const client = asClient(data.portal_clients as unknown as Record<string, unknown>);
  const now = Date.now();
  const expired = new Date(data.expires_at as string).getTime() < now;
  const usedAt = data.used_at ? new Date(data.used_at as string).getTime() : null;
  const spent = usedAt !== null && now > usedAt + LINK_GRACE_MS;
  if (expired || spent) return { state: 'expired', client };

  if (usedAt === null) {
    await db()
      .from('portal_sign_in_tokens')
      .update({ used_at: new Date(now).toISOString() })
      .eq('id', data.id);
  }
  return { state: 'ok', client };
}

/** Which client an expired or spent token was for, for the recovery screen. */
export async function clientForToken(token: string): Promise<PortalClient | null> {
  const outcome = await consumeSignInToken(token);
  return outcome.state === 'invalid' ? null : outcome.client;
}

/* ---- Passwords ------------------------------------------------------- */

/** How many wrong passwords one typed address gets in a quarter of an hour. */
const PASSWORD_TRIES = 10;
const PASSWORD_WINDOW_MS = 15 * 60 * 1000;

/**
 * A hash to check a guess against when the address is not on file or has no
 * password, so that a wrong guess takes the same time either way and the
 * clock does not say which addresses are clients. Made once, at startup,
 * from a password nobody has.
 */
const decoyHash: Promise<string> = hashPassword(newToken());

/**
 * The client, when the password matches one on file. Null otherwise, with
 * no reason given. Wrong guesses are counted against the typed address,
 * whether or not it is on file, and after too many in a quarter of an hour
 * every guess is refused until the window passes.
 */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<PortalClient | null> {
  const typed = email.trim();
  const since = new Date(Date.now() - PASSWORD_WINDOW_MS).toISOString();
  const { count } = await db()
    .from('portal_password_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('email', typed)
    .gte('attempted_at', since);
  if ((count ?? 0) >= PASSWORD_TRIES) return null;

  const client = await findClientByEmail(typed);
  const hash = client?.passwordHash ?? (await decoyHash);
  const ok = (await verifyPassword(password, hash)) && Boolean(client?.passwordHash);
  if (!ok || !client) {
    const { error } = await db().from('portal_password_attempts').insert({ email: typed });
    if (error) console.error(`portal: could not record a failed password try: ${error.message}`);
    return null;
  }
  const { passwordHash: _omit, ...rest } = client;
  return rest;
}

/* ---- Sessions -------------------------------------------------------- */

export async function createSession(clientId: string): Promise<string> {
  const token = newToken();
  const { error } = await db()
    .from('portal_sessions')
    .insert({
      client_id: clientId,
      token_hash: hashToken(token),
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    });
  if (error) throw new Error(`portal: could not create a session: ${error.message}`);
  return token;
}

export async function readSession(token: string): Promise<PortalClient | null> {
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  const { data, error } = await db()
    .from('portal_sessions')
    .select('id, expires_at, last_seen_at, portal_clients ( id, email, name, kind )')
    .eq('token_hash', hashToken(token))
    .maybeSingle();
  if (error) {
    console.error(`portal: session lookup failed: ${error.message}`);
    return null;
  }
  if (!data || !data.portal_clients) return null;
  if (new Date(data.expires_at as string).getTime() < Date.now()) return null;

  // Sliding expiry, written at most once an hour so a busy page is not a write per view.
  const lastSeen = new Date(data.last_seen_at as string).getTime();
  if (Date.now() - lastSeen > 60 * 60 * 1000) {
    await db()
      .from('portal_sessions')
      .update({
        last_seen_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      })
      .eq('id', data.id);
  }
  return asClient(data.portal_clients as unknown as Record<string, unknown>);
}

export async function destroySession(token: string): Promise<void> {
  await db().from('portal_sessions').delete().eq('token_hash', hashToken(token));
}

/* ---- Cookies --------------------------------------------------------- */

const secure = (url: URL) => url.protocol === 'https:';

export function setSessionCookie(cookies: AstroCookies, url: URL, token: string): void {
  cookies.set(SESSION_COOKIE, token, {
    path: '/portal',
    httpOnly: true,
    secure: secure(url),
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(cookies: AstroCookies, url: URL): void {
  cookies.delete(SESSION_COOKIE, { path: '/portal', secure: secure(url) });
}

export interface Notice {
  /** Which screen the note is for, so a stale one is ignored elsewhere. */
  kind: 'link-sent' | 'link-expired' | 'signed-out';
  /** The masked address, for "we sent it to k••••@gmail.com". */
  masked?: string;
  /** The expired token, so the recovery screen can reissue to the same address. */
  token?: string;
}

export function setNotice(cookies: AstroCookies, url: URL, notice: Notice): void {
  cookies.set(NOTICE_COOKIE, JSON.stringify(notice), {
    path: '/portal',
    httpOnly: true,
    secure: secure(url),
    sameSite: 'lax',
    maxAge: 15 * 60,
  });
}

/** Read the note and clear it, so a refresh does not show it twice. */
export function takeNotice(cookies: AstroCookies, url: URL): Notice | null {
  const raw = cookies.get(NOTICE_COOKIE)?.value;
  if (!raw) return null;
  cookies.delete(NOTICE_COOKIE, { path: '/portal', secure: secure(url) });
  try {
    const parsed = JSON.parse(raw) as Notice;
    return parsed && typeof parsed.kind === 'string' ? parsed : null;
  } catch {
    return null;
  }
}
