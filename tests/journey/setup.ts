/**
 * Before the browser opens: a clean mail sink, the two example clients
 * seeded the way the office would seed them, and their previous requests
 * and approvals gone so the walk starts from nothing every time.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { MAIL_SINK, SEED, portalEnv } from './env';

export default async function globalSetup(): Promise<void> {
  const env = portalEnv();

  rmSync(MAIL_SINK, { recursive: true, force: true });
  mkdirSync(MAIL_SINK, { recursive: true });

  // The office's own command, so the seed is the seed and not a copy of it.
  execFileSync(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'scripts/portal-admin.ts', 'seed'],
    {
      env: { ...process.env, ...env },
      stdio: 'inherit',
    },
  );

  const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: clients, error } = await db
    .from('portal_clients')
    .select('id, email')
    .in('email', [SEED.garden.email, SEED.project.email]);
  if (error) throw new Error(`setup: could not read the example clients: ${error.message}`);
  const ids = (clients ?? []).map((row) => String(row.id));
  if (ids.length !== 2) throw new Error('setup: the seed did not leave two example clients');

  for (const table of [
    'portal_requests',
    'portal_approvals',
    'portal_sessions',
    'portal_sign_in_tokens',
  ]) {
    const { error: cleared } = await db.from(table).delete().in('client_id', ids);
    if (cleared) throw new Error(`setup: could not clear ${table}: ${cleared.message}`);
  }
}
