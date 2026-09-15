/**
 * What a client sends: a request, an answer to a notice, an approval.
 *
 * The rule from the intake form, applied here: a receipt is shown only when
 * something accepted the submission. For the portal the thing that accepts
 * it is the database row, which is the record GMZ keeps; the email to the
 * office is the notification, and if the provider is down the row still
 * exists, `notified` stays false, and `npm run portal -- requests` lists it
 * so nothing is lost. A row that could not be written is a failure the
 * screen reports, with the phone number, and never a receipt.
 *
 * Photographs go into the private bucket under the client's own prefix, re-
 * encoded on the way in. Re-encoding drops every byte of metadata, so a
 * photograph from a phone arrives without the coordinates of the client's
 * home in it. The same rule the committed photographs live by.
 */
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { company } from '@data/site';
import type { PortalClient } from './auth';
import { BUCKET, db } from './db';
import { env } from './env';
import { sendMail } from './mail';

/** The most a client can attach: two slots on the form, and a sane ceiling each. */
export const MAX_PHOTOS = 2;
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
/** What a person writes, at most. Generous for a person, mean for a script. */
export const MAX_BODY_CHARS = 4000;

export class RequestRejected extends Error {
  constructor(
    public readonly reason: 'photo-too-large' | 'photo-unreadable' | 'too-many-photos' | 'storage',
    message: string,
  ) {
    super(message);
    this.name = 'RequestRejected';
  }
}

/**
 * Re-encode a photograph and store it under the client's prefix. Returns the
 * storage path. The output carries no metadata, because sharp writes none
 * unless asked to, and it is never asked to.
 */
async function storePhoto(client: PortalClient, file: File): Promise<string> {
  if (file.size > MAX_PHOTO_BYTES) {
    throw new RequestRejected('photo-too-large', 'A photo is larger than the portal accepts.');
  }
  let encoded: Buffer;
  try {
    encoded = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate() // apply the orientation to the pixels, then drop the tag with everything else
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new RequestRejected('photo-unreadable', 'A file attached was not a readable photo.');
  }
  const path = `${client.id}/requests/${randomUUID()}.webp`;
  const { error } = await db()
    .storage.from(BUCKET)
    .upload(path, encoded, { contentType: 'image/webp', upsert: false });
  if (error) throw new RequestRejected('storage', `Could not store a photo: ${error.message}`);
  return path;
}

export interface NewRequest {
  kind: 'ask' | 'offer' | 'application';
  about: string;
  body: string;
  details?: Record<string, unknown>;
  photos?: File[];
}

export interface StoredRequest {
  reference: string;
  notified: boolean;
}

/** Keep the request, then tell the office. The reference comes from the database. */
export async function createRequest(
  client: PortalClient,
  request: NewRequest,
): Promise<StoredRequest> {
  const photos = (request.photos ?? []).filter((file) => file.size > 0);
  if (photos.length > MAX_PHOTOS) {
    throw new RequestRejected('too-many-photos', 'Too many photos were attached.');
  }
  const paths: string[] = [];
  for (const photo of photos) paths.push(await storePhoto(client, photo));

  const { data, error } = await db()
    .from('portal_requests')
    .insert({
      client_id: client.id,
      kind: request.kind,
      about: request.about.slice(0, 120),
      body: request.body.slice(0, MAX_BODY_CHARS),
      details: request.details ?? {},
      photo_paths: paths,
    })
    .select('reference')
    .single();
  if (error || !data) {
    throw new RequestRejected(
      'storage',
      `Could not keep the request: ${error?.message ?? 'no row'}`,
    );
  }
  const reference = String(data.reference);

  const notified = await sendMail({
    to: env.officeTo,
    replyTo: client.email,
    subject: `Portal ${request.kind}: ${client.name}, ${reference}`,
    text: [
      `${client.name} sent this through the portal.`,
      '',
      `Reference  ${reference}`,
      `About      ${request.about}`,
      ...Object.entries(request.details ?? {}).map(
        ([key, value]) => `${key.padEnd(10)} ${String(value)}`,
      ),
      `Photos     ${paths.length === 0 ? 'none' : `${paths.length}, in the portal bucket under ${client.id}/requests/`}`,
      '',
      'In their words',
      '--------------',
      request.body || '(nothing written)',
      '',
      `Reply to this email to answer ${client.name} directly.`,
    ].join('\n'),
  });
  if (notified) {
    await db().from('portal_requests').update({ notified: true }).eq('reference', reference);
  } else {
    console.error(`portal: request ${reference} kept, office not notified`);
  }
  return { reference, notified };
}

export interface NewApproval {
  /** 'proposal', or 'change-order:1'. */
  subject: string;
  typedName: string;
  /** The figure on the sheet when they approved it. */
  amount: string;
  /** One line for the office: what was approved. */
  summary: string;
}

/**
 * Record that the client wants to proceed. Approving twice is not an error:
 * the first record stands and the second is a no-op, because a double tap on
 * a phone must not make two rows or lose the first timestamp.
 */
export async function recordApproval(
  client: PortalClient,
  approval: NewApproval,
): Promise<{ createdAt: Date; notified: boolean; alreadyRecorded: boolean }> {
  const { data: existing } = await db()
    .from('portal_approvals')
    .select('created_at, notified')
    .eq('client_id', client.id)
    .eq('subject', approval.subject)
    .maybeSingle();
  if (existing) {
    return {
      createdAt: new Date(existing.created_at as string),
      notified: Boolean(existing.notified),
      alreadyRecorded: true,
    };
  }

  const { data, error } = await db()
    .from('portal_approvals')
    .insert({
      client_id: client.id,
      subject: approval.subject,
      typed_name: approval.typedName.slice(0, 120),
      amount: approval.amount,
    })
    .select('created_at')
    .single();
  if (error || !data) {
    throw new RequestRejected('storage', `Could not record the approval: ${error?.message}`);
  }

  const notified = await sendMail({
    to: env.officeTo,
    replyTo: client.email,
    subject: `Portal approval: ${client.name}, ${approval.summary}`,
    text: [
      `${client.name} approved this in the portal.`,
      '',
      `What       ${approval.summary}`,
      `Amount     ${approval.amount}`,
      `Typed name ${approval.typedName}`,
      '',
      'This records their intent to proceed. The contract still goes to them for signature, and nothing is due until they have signed it.',
      '',
      company.legalName,
    ].join('\n'),
  });
  if (notified) {
    await db()
      .from('portal_approvals')
      .update({ notified: true })
      .eq('client_id', client.id)
      .eq('subject', approval.subject);
  } else {
    console.error(
      `portal: approval ${approval.subject} for ${client.id} kept, office not notified`,
    );
  }
  return { createdAt: new Date(data.created_at as string), notified, alreadyRecorded: false };
}
