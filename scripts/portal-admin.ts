#!/usr/bin/env -S npx tsx
/**
 * The office's side of the client portal, from the command line.
 *
 * There is no admin screen yet. Until there is, this is how a client gets an
 * account, a record, a password or a link, and how the office checks that
 * nothing sent through the portal was missed. It talks to the same database
 * the site does, with the same service role, from the same two variables:
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run portal -- <command>
 *
 * Commands
 *
 *   seed [--garden-email a@b] [--project-email c@d]
 *       Write the brief's two example clients, Kate Games and Heron, with
 *       their records and plants. Safe to re-run: records are replaced.
 *
 *   add --email <email> --name "<name>" --kind garden|project
 *       Create a client with no record yet. The record is written with
 *       `record`.
 *
 *   record --email <email> --file <path.json>
 *       Replace the client's garden or project record with the JSON in the
 *       file, after checking it against the schema and the copy rules. A
 *       record that breaks house style is refused, with the sentence named.
 *
 *   plants --email <email> --file <path.json>
 *       Replace the client's plants with the array in the file
 *       ([{ slug, data }]), checked the same way.
 *
 *   password --email <email>
 *       Set a password, read from the terminal without echo. Only for
 *       accounts that hold more than one property; everyone else uses links.
 *
 *   link --email <email> [--origin https://www.gmzlandscape.com]
 *       Print a sign-in link for the client, without sending an email. For
 *       reading over the phone, or for testing.
 *
 *   requests [--all]
 *       List requests and approvals the office was not emailed about, so
 *       nothing is lost when the mail provider was down. --all lists every
 *       one from the last thirty days.
 *
 * Every write goes through `parseRecord`, so the schema and the copy rules
 * are the same here as on the way out of the database.
 */
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';
import { gardenSeed, plantsSeed } from '../src/data/portal/garden';
import { projectSeed } from '../src/data/portal/project';
import {
  gardenRecord,
  parseRecord,
  plantRecord,
  projectRecord,
  type PlantRecord,
} from '../src/data/portal/shapes';
import { hashPassword, hashToken, newToken } from '../src/server/crypto';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.');
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

/* ---- Arguments --------------------------------------------------------- */

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

/* ---- Helpers ----------------------------------------------------------- */

async function clientByEmail(email: string) {
  const { data, error } = await db
    .from('portal_clients')
    .select('id, email, name, kind')
    .eq('email', email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    console.error(`No client with the address ${email}.`);
    process.exit(1);
  }
  return data as { id: string; email: string; name: string; kind: 'garden' | 'project' };
}

async function upsertClient(email: string, name: string, kind: 'garden' | 'project') {
  const { data, error } = await db
    .from('portal_clients')
    .upsert({ email, name, kind }, { onConflict: 'email' })
    .select('id, email, name, kind')
    .single();
  if (error) throw new Error(error.message);
  return data as { id: string; email: string; name: string; kind: 'garden' | 'project' };
}

async function writeRecord(clientId: string, kind: 'garden' | 'project', raw: unknown) {
  const table = kind === 'garden' ? 'portal_gardens' : 'portal_projects';
  const record =
    kind === 'garden'
      ? parseRecord(gardenRecord, raw, 'the garden record')
      : parseRecord(projectRecord, raw, 'the project record');
  const { error } = await db
    .from(table)
    .upsert({ client_id: clientId, record, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

async function writePlants(clientId: string, plants: { slug: string; data: PlantRecord }[]) {
  const rows = plants.map((plant, index) => ({
    client_id: clientId,
    slug: plant.slug,
    record: parseRecord(plantRecord, plant.data, `plant ${plant.slug}`),
    sort_order: index,
    updated_at: new Date().toISOString(),
  }));
  const { error: cleared } = await db.from('portal_plants').delete().eq('client_id', clientId);
  if (cleared) throw new Error(cleared.message);
  if (rows.length === 0) return;
  const { error } = await db.from('portal_plants').insert(rows);
  if (error) throw new Error(error.message);
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

async function seed() {
  const gardenEmail = flag('garden-email') ?? 'kate.games@example.com';
  const projectEmail = flag('project-email') ?? 'heron@example.com';

  const kate = await upsertClient(gardenEmail, gardenSeed.display.name, 'garden');
  await writeRecord(kate.id, 'garden', gardenSeed);
  await writePlants(kate.id, plantsSeed);
  console.log(
    `Garden client ${kate.name} <${kate.email}>: record and ${plantsSeed.length} plants written.`,
  );

  const heron = await upsertClient(projectEmail, projectSeed.display.name, 'project');
  await writeRecord(heron.id, 'project', projectSeed);
  console.log(`Project client ${heron.name} <${heron.email}>: record written.`);
}

async function add() {
  const kind = need('kind');
  if (kind !== 'garden' && kind !== 'project') {
    console.error('--kind must be garden or project.');
    process.exit(2);
  }
  const client = await upsertClient(need('email'), need('name'), kind);
  console.log(`${client.name} <${client.email}> is a ${client.kind} client. Now write a record.`);
}

async function record() {
  const client = await clientByEmail(need('email'));
  const raw = JSON.parse(await readFile(need('file'), 'utf8')) as unknown;
  await writeRecord(client.id, client.kind, raw);
  console.log(`${client.kind} record for ${client.name} written.`);
}

async function plants() {
  const client = await clientByEmail(need('email'));
  if (client.kind !== 'garden') {
    console.error('Only a garden client has plants.');
    process.exit(1);
  }
  const raw = JSON.parse(await readFile(need('file'), 'utf8')) as {
    slug: string;
    data: PlantRecord;
  }[];
  await writePlants(client.id, raw);
  console.log(`${raw.length} plants written for ${client.name}.`);
}

async function password() {
  const client = await clientByEmail(need('email'));
  const typed = await ask(`New password for ${client.email}: `);
  if (typed.length < 12) {
    console.error('Twelve characters at least.');
    process.exit(1);
  }
  const { error } = await db
    .from('portal_clients')
    .update({ password_hash: await hashPassword(typed) })
    .eq('id', client.id);
  if (error) throw new Error(error.message);
  console.log('Password set.');
}

async function link() {
  const client = await clientByEmail(need('email'));
  const origin = flag('origin') ?? 'https://www.gmzlandscape.com';
  const token = newToken();
  const { error } = await db.from('portal_sign_in_tokens').insert({
    client_id: client.id,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);
  console.log(new URL(`/portal/auth/${token}`, origin).href);
}

async function requests() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const all = flags.get('all') === true;
  const query = db
    .from('portal_requests')
    .select('reference, kind, about, body, notified, created_at, portal_clients ( name, email )')
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  const { data, error } = all ? await query : await query.eq('notified', false);
  if (error) throw new Error(error.message);
  const approvals = db
    .from('portal_approvals')
    .select('subject, typed_name, amount, notified, created_at, portal_clients ( name, email )')
    .gte('created_at', since)
    .order('created_at', { ascending: false });
  const { data: approved, error: approvedError } = all
    ? await approvals
    : await approvals.eq('notified', false);
  if (approvedError) throw new Error(approvedError.message);

  if ((data ?? []).length === 0 && (approved ?? []).length === 0) {
    console.log(
      all ? 'Nothing in the last thirty days.' : 'Nothing the office was not told about.',
    );
    return;
  }
  for (const row of data ?? []) {
    const who = row.portal_clients as unknown as { name: string; email: string } | null;
    console.log(
      `${row.created_at}  ${row.reference}  ${row.kind.padEnd(11)} ${who?.name ?? '?'} <${who?.email ?? '?'}>` +
        `${row.notified ? '' : '  NOT NOTIFIED'}\n    ${row.about}: ${String(row.body).slice(0, 120)}`,
    );
  }
  for (const row of approved ?? []) {
    const who = row.portal_clients as unknown as { name: string; email: string } | null;
    console.log(
      `${row.created_at}  approval    ${row.subject.padEnd(11)} ${who?.name ?? '?'} <${who?.email ?? '?'}>` +
        `${row.notified ? '' : '  NOT NOTIFIED'}\n    ${row.amount ?? ''} by ${row.typed_name}`,
    );
  }
}

const commands: Record<string, () => Promise<void>> = {
  seed,
  add,
  record,
  plants,
  password,
  link,
  requests,
};

const run = commands[command];
if (!run) {
  console.error(`Unknown command "${command}". See the header of scripts/portal-admin.ts.`);
  process.exit(2);
}
run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
