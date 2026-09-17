#!/usr/bin/env -S npx tsx
/**
 * The office's side of GMZ Staff accounts, from the command line.
 *
 * Trimmed down from scripts/portal-admin.ts: staff has no record, no plants,
 * no emailed link, just an account and a password.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run staff -- <command>
 *
 * Commands
 *
 *   add --email <email> --name "<name>"
 *       Create a staff account with no password yet. Safe to re-run: the
 *       name is updated if the address already exists.
 *
 *   password --email <email>
 *       Set a password, read from the terminal without echo.
 *
 *   deactivate --email <email>
 *       Turn an account off without deleting it. Sign-in refuses it either
 *       way; deactivating keeps the row so its sessions can still be found.
 *
 *   list
 *       Every staff account and whether it is active.
 */
import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';
import { hashPassword } from '../src/server/crypto';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.');
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const [command = 'help', ...rest] = process.argv.slice(2);
const flags = new Map<string, string | true>();
for (let i = 0; i < rest.length; i += 1) {
  const arg = rest[i]!;
  if (!arg.startsWith('--')) continue;
  const next = rest[i + 1];
  if (next && !next.startsWith('--')) {
    flags.set(arg.slice(2), next);
    i += 1;
  } else {
    flags.set(arg.slice(2), true);
  }
}
const flag = (name: string): string | undefined => {
  const value = flags.get(name);
  return typeof value === 'string' ? value : undefined;
};
const need = (name: string): string => {
  const value = flag(name);
  if (!value) {
    console.error(`--${name} is required.`);
    process.exit(2);
  }
  return value;
};

async function staffByEmail(email: string) {
  const { data, error } = await db
    .from('gmz_staff_accounts')
    .select('id, email, name, active')
    .eq('email', email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    console.error(`No staff account with the address ${email}.`);
    process.exit(1);
  }
  return data as { id: string; email: string; name: string; active: boolean };
}

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise((resolve) => {
    const anyRl = rl as unknown as {
      _writeToOutput?: (s: string) => void;
      output: NodeJS.WritableStream;
    };
    // Do not echo what is typed after the prompt.
    anyRl._writeToOutput = (s: string) => {
      if (s.startsWith(question)) anyRl.output.write(question);
    };
    rl.question(question, (answer) => {
      anyRl.output.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

/* ---- Commands ---------------------------------------------------------- */

async function add() {
  const email = need('email');
  const name = need('name');
  const { data, error } = await db
    .from('gmz_staff_accounts')
    .upsert({ email, name, active: true }, { onConflict: 'email' })
    .select('id, email, name')
    .single();
  if (error) throw new Error(error.message);
  console.log(`${data.name} <${data.email}> can now be given a password.`);
}

async function password() {
  const staff = await staffByEmail(need('email'));
  const typed = await ask(`New password for ${staff.email}: `);
  if (typed.length < 12) {
    console.error('Twelve characters at least.');
    process.exit(1);
  }
  const { error } = await db
    .from('gmz_staff_accounts')
    .update({ password_hash: await hashPassword(typed) })
    .eq('id', staff.id);
  if (error) throw new Error(error.message);
  console.log('Password set.');
}

async function deactivate() {
  const staff = await staffByEmail(need('email'));
  const { error } = await db
    .from('gmz_staff_accounts')
    .update({ active: false })
    .eq('id', staff.id);
  if (error) throw new Error(error.message);
  console.log(`${staff.email} deactivated.`);
}

async function list() {
  const { data, error } = await db
    .from('gmz_staff_accounts')
    .select('email, name, active, created_at')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    console.log('No staff accounts yet.');
    return;
  }
  for (const row of data) {
    console.log(`${row.active ? '  ' : 'off'}  ${row.name.padEnd(24)} <${row.email}>`);
  }
}

const commands: Record<string, () => Promise<void>> = { add, password, deactivate, list };

const run = commands[command];
if (!run) {
  console.error(`Unknown command "${command}". See the header of scripts/staff-admin.ts.`);
  process.exit(2);
}
run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
