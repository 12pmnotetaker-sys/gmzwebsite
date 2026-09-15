/**
 * What the server has been told, and what it can therefore do.
 *
 * Every value is an environment variable on the Vercel project (or in a local
 * `.env` for `astro dev`). Nothing here is read in a browser: this module is
 * imported only by server code, and the service role key in particular must
 * never reach a client bundle.
 *
 *   SUPABASE_URL                 https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    server-side key, never shipped to a browser
 *   RESEND_API_KEY               the email provider
 *   PORTAL_FROM                  sender for portal mail; falls back to ENQUIRY_FROM
 *   PORTAL_OFFICE_TO             where requests and approvals land; falls back to
 *                                ENQUIRY_TO, then to the address in site.ts
 *
 * The rule from the intake form applies to the whole portal: an unconfigured
 * portal says so and offers the phone number, and never pretends. With no
 * database the sign-in screen refuses politely; with no mail the link cannot
 * be sent, so sign-in says that rather than "check your email".
 */
import { company } from '@data/site';

/*
 * `process.env` on Vercel and in a shell; `.env` files reach server code
 * through `import.meta.env` in `astro dev`, so that is the fallback.
 */
const read = (key: string): string | undefined => {
  const fromProcess = process.env[key];
  const fromMeta = (import.meta.env as Record<string, string | undefined>)[key];
  const value = fromProcess ?? fromMeta;
  return value && value.trim() !== '' ? value.trim() : undefined;
};

export const env = {
  supabaseUrl: read('SUPABASE_URL'),
  supabaseServiceKey: read('SUPABASE_SERVICE_ROLE_KEY'),
  resendKey: read('RESEND_API_KEY'),
  from: read('PORTAL_FROM') ?? read('ENQUIRY_FROM'),
  officeTo: read('PORTAL_OFFICE_TO') ?? read('ENQUIRY_TO') ?? company.email,
  enquiryTo: read('ENQUIRY_TO') ?? company.email,
  enquiryFrom: read('ENQUIRY_FROM'),
  /**
   * A directory to write mail into instead of sending it. For `astro dev`
   * and the tests, where a sign-in link has to be read back rather than
   * received. Never set on a deployment: a sink is not a provider, and the
   * screen would say "check your email" about a file on a disk.
   */
  mailSink: read('PORTAL_MAIL_SINK'),
};

/** The database is reachable, so records can be read and requests kept. */
export const portalConfigured = (): boolean => Boolean(env.supabaseUrl && env.supabaseServiceKey);

/** Mail can be sent, so a sign-in link can actually arrive. */
export const mailConfigured = (): boolean =>
  Boolean(env.mailSink) || Boolean(env.resendKey && env.from);
