/**
 * The portal, walked the way a client walks it.
 *
 * A garden client asks for a link, follows it, sends a request with a
 * photograph and reads the receipt; the row is there, the photograph was
 * re-encoded on the way in and carries nothing the original did. A project
 * client approves the proposal, and a second approval changes nothing.
 * Signing out ends the session.
 *
 * The two example clients are the office's demo accounts, so the office is
 * deliberately not emailed about what they send; the rows still exist, and
 * that is what the tests read.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { MAIL_SINK, SEED, portalEnv } from './env';
import { mails, signInByLink } from './helpers';

test.describe.configure({ mode: 'serial' });

const env = portalEnv();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** A phrase that must not survive the upload: it is written into the photograph's metadata. */
const MARKER = 'GMZ-JOURNEY-METADATA-MARKER';
const PHOTO = path.resolve(MAIL_SINK, '..', 'photo.jpg');

test.beforeAll(async () => {
  mkdirSync(path.dirname(PHOTO), { recursive: true });
  const jpeg = await sharp({
    create: { width: 640, height: 480, channels: 3, background: { r: 60, g: 110, b: 70 } },
  })
    .jpeg({ quality: 80 })
    .withExif({ IFD0: { ImageDescription: MARKER, Artist: MARKER } })
    .toBuffer();
  expect(jpeg.includes(MARKER), 'the fixture must carry the marker before upload').toBe(true);
  writeFileSync(PHOTO, jpeg);
});

/** The chunks of a RIFF/WebP file, by four-letter tag. */
function webpChunks(bytes: Buffer): string[] {
  expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIFF');
  expect(bytes.subarray(8, 12).toString('latin1')).toBe('WEBP');
  const tags: string[] = [];
  for (let at = 12; at + 8 <= bytes.length;) {
    tags.push(bytes.subarray(at, at + 4).toString('latin1'));
    const size = bytes.readUInt32LE(at + 4);
    at += 8 + size + (size % 2);
  }
  return tags;
}

test('a garden client signs in by link, sends a request with a photograph, and gets a receipt', async ({
  page,
}) => {
  await signInByLink(page, SEED.garden.email, '/portal/garden');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(SEED.garden.name);

  await page.goto('/portal/garden/ask');
  // The radio sits under its chip; a client taps the words.
  await page.locator('label.choice', { hasText: 'A question' }).click();
  await expect(page.getByRole('radio', { name: 'A question' })).toBeChecked();
  const sentence = 'The hedge along the drive has grown over the path; could someone look at it?';
  await page.getByLabel('What would you like').fill(sentence);
  await page.locator('input[name="photos"]').first().setInputFiles(PHOTO);
  await page.getByRole('button', { name: 'Send it' }).first().click();

  await expect(page).toHaveURL(/\/portal\/garden\/ask\/sent\/R-\d{4}-\d{4,}$/);
  const reference = page.url().match(/R-\d{4}-\d{4,}$/)?.[0] ?? '';
  await expect(page.getByText(reference).first()).toBeVisible();
  await expect(page.getByText(sentence).first()).toBeVisible();

  const { data: row, error } = await db
    .from('portal_requests')
    .select('kind, about, body, photo_paths, notified, portal_clients ( email )')
    .eq('reference', reference)
    .single();
  expect(error).toBeNull();
  expect(row?.kind).toBe('ask');
  expect(row?.about).toBe('A question');
  expect(row?.body).toBe(sentence);
  expect((row?.portal_clients as unknown as { email: string })?.email).toBe(SEED.garden.email);
  // A demo client's request is kept but the office is not emailed about it.
  expect(row?.notified).toBe(false);
  expect(mails().filter((mail) => mail.subject.startsWith('Portal ask'))).toHaveLength(0);

  const paths = row?.photo_paths as string[];
  expect(paths).toHaveLength(1);
  const { data: stored, error: download } = await db.storage.from('portal').download(paths[0]!);
  expect(download).toBeNull();
  const bytes = Buffer.from(await stored!.arrayBuffer());
  const chunks = webpChunks(bytes);
  expect(chunks).toContain('VP8 ');
  expect(chunks).not.toContain('EXIF');
  expect(chunks).not.toContain('XMP ');
  expect(bytes.includes(MARKER), 'the metadata written into the original must not survive').toBe(
    false,
  );
});

test('a project client approves the proposal once, and a second approval changes nothing', async ({
  page,
}) => {
  await signInByLink(page, SEED.project.email, '/portal/project');

  await page.goto('/portal/project/proposal/approve');
  await page.getByLabel('Type your full name').fill('Julia Heron');
  await page.getByRole('button', { name: 'Approve this proposal' }).click();
  await expect(page).toHaveURL(/\/portal\/project\/proposal\/approved$/);
  // The line renders in the column and in the desktop rail; one of them shows.
  await expect(
    page
      .getByText(/Recorded .* by Julia Heron\./)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();

  const { data: first } = await db
    .from('portal_approvals')
    .select('created_at, typed_name, amount')
    .eq('subject', 'proposal')
    .single();
  expect(first?.typed_name).toBe('Julia Heron');
  expect(first?.amount).toBeTruthy();

  // The sheet is not shown again: an approval on file sends them to the record of it.
  await page.goto('/portal/project/proposal/approve');
  await expect(page).toHaveURL(/\/portal\/project\/proposal\/approved$/);
  const { data: rows } = await db
    .from('portal_approvals')
    .select('created_at')
    .eq('subject', 'proposal');
  expect(rows).toHaveLength(1);
  expect(rows?.[0]?.created_at).toBe(first?.created_at);
});

test('signing out ends the session', async ({ page }) => {
  await signInByLink(page, SEED.garden.email, '/portal/garden');
  const response = await page.request.post('/portal/sign-out', { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  await page.goto('/portal/garden');
  await expect(page).toHaveURL(/\/portal\/sign-in$/);
  await expect(page.getByText('You are signed out')).toBeVisible();
});
