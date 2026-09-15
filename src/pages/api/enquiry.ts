/**
 * The intake endpoint, at /api/enquiry.
 *
 * Rendered on demand by the same function as the client portal. It used to
 * be a stand-alone Vercel Function in a top-level `api/` directory; now the
 * site has an adapter it is an Astro endpoint like any other, which means it
 * runs in `astro dev` and `astro preview` and can be tested without a deploy.
 *
 * ## The rule this file exists to enforce
 *
 * A plain static host answers `200` to a form POST whether or not anything is
 * listening. That is the highest-cost failure available to this project: the
 * thank-you panel reports success, the client believes GMZ has their enquiry,
 * and nobody finds out for weeks. No client-side check can tell the difference,
 * which is why the check lives here.
 *
 * So: **this endpoint returns 200 only when a delivery channel accepted the
 * enquiry.** Not when it validated, not when it parsed. If nothing is
 * configured, it says so with a 503 and the form shows the phone number
 * instead of a thank-you. An unconfigured form that admits it is broken is
 * recoverable; one that lies is not.
 *
 * ## Configuration
 *
 * Every value is an environment variable on the Vercel project. Set at least
 * one channel or the endpoint will refuse every submission on purpose.
 *
 *   Email, via Resend:
 *     RESEND_API_KEY    an API key
 *     ENQUIRY_FROM      a sender on a domain verified with the provider
 *     ENQUIRY_TO        where enquiries land; defaults to the address in site.ts
 *
 *   Database, via Supabase REST:
 *     SUPABASE_URL                 https://<ref>.supabase.co
 *     SUPABASE_SERVICE_ROLE_KEY    server-side key, never shipped to a browser
 *
 * Nothing internal to GMZ passes through here, and nothing is logged except a
 * channel name and a status code. The submission itself is a client's words
 * and their address; it goes to the inbox and the database and nowhere else.
 */
import type { APIRoute } from 'astro';
import {
  budgetBands,
  heardVia,
  honeypotField,
  labelFor,
  projectTypes,
  propertyTypes,
  timelines,
  validate,
  type Enquiry,
} from '@data/enquiry';
import { env, portalConfigured } from '../../server/env';

export const prerender = false;

/** Largest body we will read. A person's enquiry is nowhere near this. */
const MAX_BODY_BYTES = 64 * 1024;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

/** The enquiry as a person reads it, for the body of the email. */
function asText(enquiry: Enquiry): string {
  const lines = [
    `Name       ${enquiry.name}`,
    `Email      ${enquiry.email || 'not given'}`,
    `Phone      ${enquiry.phone || 'not given'}`,
    `Town       ${enquiry.town}`,
    `Property   ${labelFor(propertyTypes, enquiry.propertyType)}`,
    `Project    ${labelFor(projectTypes, enquiry.projectType)}`,
    `Timeline   ${labelFor(timelines, enquiry.timeline)}`,
    `Budget     ${enquiry.budget ? labelFor(budgetBands, enquiry.budget) : 'not given'}`,
    `Found via  ${enquiry.heardVia ? labelFor(heardVia, enquiry.heardVia) : 'not given'}`,
    `Portfolio  ${enquiry.portfolio ? 'asked to see it' : 'did not ask'}`,
    '',
    'In their words',
    '--------------',
    enquiry.description,
  ];
  return lines.join('\n');
}

async function sendEmail(enquiry: Enquiry): Promise<boolean> {
  const key = env.resendKey;
  const from = env.enquiryFrom;
  const to = env.enquiryTo;
  if (!key || !from || !to) return false;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      /*
       * Reply goes to the client, not to the sending domain, so answering the
       * enquiry is one keystroke rather than a copy and paste out of the body.
       */
      reply_to: enquiry.email || undefined,
      subject: `Website enquiry: ${enquiry.name}, ${enquiry.town}`,
      text: asText(enquiry),
    }),
  });

  if (!response.ok) {
    console.error(`enquiry: email channel returned ${response.status}`);
    return false;
  }
  return true;
}

async function saveLead(enquiry: Enquiry): Promise<boolean> {
  if (!portalConfigured()) return false;
  const url = env.supabaseUrl!;
  const key = env.supabaseServiceKey!;

  /*
   * The column names here have to match `website_leads`. A mismatch shows up
   * as a 400 in the runtime log and, on its own, does not fail a submission
   * that also reached the inbox. Confirm them against the table before
   * relying on this channel.
   */
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/website_leads`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      name: enquiry.name,
      email: enquiry.email || null,
      phone: enquiry.phone || null,
      town: enquiry.town,
      property_type: enquiry.propertyType,
      project_type: enquiry.projectType,
      timeline: enquiry.timeline,
      budget_band: enquiry.budget || null,
      heard_via: enquiry.heardVia || null,
      message: enquiry.description,
      wants_portfolio: enquiry.portfolio,
      source: 'website',
    }),
  });

  if (!response.ok) {
    console.error(`enquiry: lead store returned ${response.status}`);
    return false;
  }
  return true;
}

export const POST: APIRoute = async ({ request }) => {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) return json(413, { error: 'too-large' });

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'too-large' });
    body = raw.trim() === '' ? {} : JSON.parse(raw);
  } catch {
    return json(400, { error: 'unreadable' });
  }

  if (typeof body !== 'object' || body === null) return json(400, { error: 'unreadable' });

  const input = body as Record<string, unknown>;

  /*
   * A filled honeypot is answered with the same 200 a person gets. Telling a
   * script why it was rejected is how it learns to pass next time, and there
   * is nothing to gain from arguing with it.
   */
  const trap = input[honeypotField];
  if (typeof trap === 'string' && trap.trim() !== '') return json(200, { ok: true });

  const result = validate(input);
  if (!result.ok) return json(422, { error: 'invalid', fields: result.errors });

  const channels = await Promise.allSettled([sendEmail(result.enquiry), saveLead(result.enquiry)]);
  const delivered = channels.some(
    (channel) => channel.status === 'fulfilled' && channel.value === true,
  );
  if (delivered) return json(200, { ok: true });

  /*
   * Nothing accepted it. Distinguish "nobody has wired this up yet" from "the
   * provider is having a bad morning", because the fixes are different and the
   * first one is a deployment mistake rather than an outage.
   */
  const configured = Boolean((env.resendKey && env.enquiryFrom) || portalConfigured());
  for (const channel of channels) {
    if (channel.status === 'rejected') console.error('enquiry: channel threw', channel.reason);
  }
  console.error(`enquiry: not delivered (configured=${configured})`);
  return json(configured ? 502 : 503, { error: configured ? 'undelivered' : 'unconfigured' });
};

export const ALL: APIRoute = () =>
  new Response(JSON.stringify({ error: 'method-not-allowed' }), {
    status: 405,
    headers: { Allow: 'POST', 'Content-Type': 'application/json; charset=utf-8' },
  });
