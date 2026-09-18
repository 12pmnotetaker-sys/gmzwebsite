/**
 * The on-demand routes, with nothing configured.
 *
 * CLAUDE.md promises that the portal, the intake endpoint and the admin API
 * are honest about being off: no database means the sign-in screen says so
 * and offers the phone number, the enquiry endpoint answers 503 rather than a
 * false thank-you, and the admin API refuses without a session. Those are
 * the behaviours a deployment mistake would break first, and they are
 * rendered on demand, so the static build gate never sees them. This does.
 *
 * It starts the dev server with every provider variable unset and reads the
 * routes over HTTP, the way a client would. Run: npm test
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PORT = 4399;
const ORIGIN = `http://127.0.0.1:${PORT}`;

/** The phone number the screens must offer, read from the one file that holds it. */
const primaryPhone = readFileSync('src/data/site.ts', 'utf8').match(
  /phones:\s*\[\s*\{[^}]*display:\s*'([^']+)'/,
)?.[1];

let server;

const unconfigured = { ...process.env };
for (const key of [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'ENQUIRY_FROM',
  'ENQUIRY_TO',
  'PORTAL_FROM',
  'PORTAL_OFFICE_TO',
  'PORTAL_MAIL_SINK',
]) {
  delete unconfigured[key];
}

async function ready(deadline = Date.now() + 90_000) {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${ORIGIN}/portal/sign-in`, { redirect: 'manual' });
      if (response.status < 500) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`astro dev did not answer on ${ORIGIN} in time`);
}

before(async () => {
  // Astro's own entry rather than npx, so the process that gets the signal
  // is the one holding the port; a wrapper would exit and leave it running.
  server = spawn(
    process.execPath,
    ['node_modules/astro/astro.js', 'dev', '--port', String(PORT), '--host', '127.0.0.1'],
    { env: unconfigured, stdio: ['ignore', 'pipe', 'pipe'], detached: true },
  );
  let log = '';
  server.stdout.on('data', (chunk) => (log += chunk));
  server.stderr.on('data', (chunk) => (log += chunk));
  server.on('exit', (code) => {
    if (code !== null && code !== 0) console.error(log.slice(-2000));
  });
  await ready();
});

after(() => {
  if (!server?.pid) return;
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    server.kill('SIGTERM');
  }
});

test('the portal sign-in screen says the portal is off and offers the phone', async () => {
  assert.ok(primaryPhone, 'could not read the primary phone from src/data/site.ts');
  const response = await fetch(`${ORIGIN}/portal/sign-in`, { redirect: 'manual' });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /not switched on yet/i);
  assert.ok(html.includes(primaryPhone), 'the phone number is not on the screen');
  assert.doesNotMatch(html, /<form\b/i, 'the sign-in form must not render while the portal is off');
  assert.match(html, /<meta[^>]+name="robots"[^>]+noindex/i);
});

test('a portal page without a session is not served', async () => {
  const response = await fetch(`${ORIGIN}/portal/garden`, { redirect: 'manual' });
  assert.ok(
    response.status === 302 || response.status === 303 || response.status === 200,
    `unexpected ${response.status}`,
  );
  const html = await response.text();
  assert.doesNotMatch(html, /data-portal[^>]*data-client/, 'a client record leaked');
  if (response.status === 200) assert.match(html, /not switched on yet|sign in/i);
});

test('the enquiry endpoint answers 503 unconfigured rather than a false thank-you', async () => {
  const response = await fetch(`${ORIGIN}/api/enquiry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({
      name: 'Smoke Test',
      email: 'smoke@example.com',
      town: 'Redwood City',
      propertyType: 'house',
      projectType: 'unsure',
      timeline: 'exploring',
      description: 'A smoke test submission, not a real enquiry.',
    }),
  });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error, 'unconfigured');
});

test('the enquiry endpoint refuses other methods', async () => {
  const response = await fetch(`${ORIGIN}/api/enquiry`);
  assert.equal(response.status, 405);
});

test('the admin API refuses without a session', async () => {
  const response = await fetch(`${ORIGIN}/api/admin/anything`);
  assert.ok(response.status === 401 || response.status === 503, `unexpected ${response.status}`);
  assert.equal(response.headers.get('cache-control')?.includes('no-store'), true);
});
