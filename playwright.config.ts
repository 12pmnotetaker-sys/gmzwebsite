/**
 * The portal, switched on.
 *
 * `npm test` proves the on-demand routes are honest when nothing is
 * configured. This is the other half: a browser walking the portal against
 * a real database, the way a client would, with the mail provider replaced
 * by a directory so the sign-in link can be read back. Run: npm run test:portal
 *
 * It needs a database. Locally that is the Supabase CLI's stack, started
 * from this repository's migrations, so the same run proves the migrations
 * directory builds a working database from nothing:
 *
 *   npx supabase start
 *   eval "$(npx supabase status -o env)"
 *   npm run test:portal
 *
 * The two variables the portal reads, SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY, fall back to the names `supabase status`
 * prints, so the eval above is enough. Never point this at the live project:
 * the setup deletes the example clients' requests and approvals.
 */
import { defineConfig } from '@playwright/test';
import { MAIL_SINK, PORT, ORIGIN, portalEnv } from './tests/journey/env';

export default defineConfig({
  testDir: 'tests/journey',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  globalSetup: './tests/journey/setup.ts',
  use: {
    baseURL: ORIGIN,
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    // Astro's own entry rather than npx, as the smoke suite does, so the
    // process Playwright stops is the one holding the port.
    command: `node node_modules/astro/astro.js dev --port ${PORT} --host 127.0.0.1`,
    url: `${ORIGIN}/portal/sign-in`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      ...portalEnv(),
      PORTAL_MAIL_SINK: MAIL_SINK,
      SEARCH_INDEXING: 'off',
    },
  },
});
