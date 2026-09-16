/**
 * What a signed-in client is shown, read from the database.
 *
 * Every function takes the client from the session, never from a request,
 * and every query is scoped by that id. A record is parsed against the shape
 * in `src/data/portal/shapes.ts` on the way out, copy rules included, so a
 * screen never renders a document that does not fit or a sentence the house
 * style forbids; it renders the "could not be read" state instead, and the
 * error names what was wrong in the server log.
 */
import {
  gardenRecord,
  plantRecord,
  projectRecord,
  parseRecord,
  type GardenRecord,
  type Plant,
  type ProjectRecord,
} from '@data/portal/shapes';
import type { PortalClient } from './auth';
import { db } from './db';
import { latestOperationsReport, primaryOperationsProperty } from './operations';
import { company } from '@data/site';

/** Thrown when a record exists but cannot be shown. The message is for the log. */
export class RecordUnreadable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecordUnreadable';
  }
}

async function loadOne<T>(
  table: 'portal_gardens' | 'portal_projects',
  client: PortalClient,
  parse: (raw: unknown) => T,
): Promise<T | null> {
  const { data, error } = await db()
    .from(table)
    .select('record')
    .eq('client_id', client.id)
    .maybeSingle();
  if (error) throw new RecordUnreadable(`portal: ${table} read failed: ${error.message}`);
  if (!data) return null;
  try {
    return parse(data.record);
  } catch (cause) {
    throw new RecordUnreadable(
      `portal: ${table} for ${client.id}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }
}

/** The garden record, or null when this client has no garden. */
export const loadGarden = async (client: PortalClient): Promise<GardenRecord | null> => {
  const garden = await loadOne('portal_gardens', client, (raw) =>
    parseRecord(gardenRecord, raw, `garden record for ${client.name}`),
  );
  if (!garden) return null;
  const [report, property] = await Promise.all([
    latestOperationsReport(client),
    primaryOperationsProperty(client),
  ]);
  if (property) {
    if (property.city) garden.display.town = property.city;
    if (property.name) garden.display.property = property.name;
    garden.agreement = garden.agreement.map((row) =>
      row.label === 'Visits'
        ? { ...row, value: property.cadence === 'Not set' ? 'To be confirmed' : property.cadence }
        : row.label === 'Price'
          ? {
              ...row,
              value:
                property.monthly === null
                  ? 'To be confirmed'
                  : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                      property.monthly,
                    ) + ' a month',
            }
          : row,
    );
  }
  if (report) {
    garden.lastVisit = {
      ...garden.lastVisit,
      date: report.date,
      summary: report.summary,
      status: 'done',
      statusLabel: 'Complete',
    };
    garden.visitReport = {
      ...garden.visitReport,
      date: report.date,
      body: report.summary,
      noted: {
        kicker: 'Completed during your visit',
        body: report.tasks.length ? report.tasks.join('; ') : 'Your visit is complete.',
      },
      attribution: `Recorded by ${company.name}.`,
      photos: report.photos.map((p: { path: string; caption: string }) => ({
        path: p.path,
        caption: p.caption,
        alt: p.caption,
      })),
      earlier: 'See your published visit history.',
    };
  }
  return parseRecord(gardenRecord, garden, 'Garden report');
};

/** The project record, or null when this client has no project. */
export const loadProject = (client: PortalClient): Promise<ProjectRecord | null> =>
  loadOne('portal_projects', client, (raw) =>
    parseRecord(projectRecord, raw, `project record for ${client.name}`),
  );

/** Every plant on the client's record, in the order the record sets. */
export async function loadPlants(client: PortalClient): Promise<Plant[]> {
  const { data, error } = await db()
    .from('portal_plants')
    .select('slug, record, sort_order')
    .eq('client_id', client.id)
    .order('sort_order', { ascending: true });
  if (error) throw new RecordUnreadable(`portal: plants read failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    slug: String(row.slug),
    data: parseRecord(plantRecord, row.record, `plant ${row.slug} for ${client.name}`),
  }));
}

/** One plant by its slug, or null. Scoped to the client, so a guessed slug opens nothing. */
export async function loadPlant(client: PortalClient, slug: string): Promise<Plant | null> {
  const { data, error } = await db()
    .from('portal_plants')
    .select('slug, record')
    .eq('client_id', client.id)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new RecordUnreadable(`portal: plant read failed: ${error.message}`);
  if (!data) return null;
  return {
    slug: String(data.slug),
    data: parseRecord(plantRecord, data.record, `plant ${slug} for ${client.name}`),
  };
}

/** The plants the crew has flagged for a decision. */
export const flaggedPlants = (plants: Plant[]): Plant[] =>
  plants.filter((plant) => Boolean(plant.data.flag));

/** The short list on the garden landing: the ones marked for it. */
export const landingPlants = (plants: Plant[]): Plant[] =>
  plants.filter((plant) => plant.data.onLanding);

/* ---- What the client has sent ------------------------------------------ */

export interface RequestRecord {
  reference: string;
  kind: 'ask' | 'offer' | 'application';
  about: string;
  body: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

/** A request the client sent, by its reference. Null when it is not theirs. */
export async function loadRequest(
  client: PortalClient,
  reference: string,
): Promise<RequestRecord | null> {
  if (!/^R-\d{4}-\d{4,}$/.test(reference)) return null;
  const { data, error } = await db()
    .from('portal_requests')
    .select('reference, kind, about, body, details, created_at')
    .eq('client_id', client.id)
    .eq('reference', reference)
    .maybeSingle();
  if (error) throw new RecordUnreadable(`portal: request read failed: ${error.message}`);
  if (!data) return null;
  return {
    reference: String(data.reference),
    kind: data.kind as RequestRecord['kind'],
    about: String(data.about),
    body: String(data.body ?? ''),
    details: (data.details as Record<string, unknown>) ?? {},
    createdAt: new Date(data.created_at as string),
  };
}

/**
 * The client's answer to one application notice, if any. Keyed by the
 * notice's date, so a notice answered in September does not show a later
 * notice as already answered.
 */
export async function loadApplicationAnswer(
  client: PortalClient,
  noticeDate: string,
): Promise<{ decision: 'go-ahead' | 'skip'; createdAt: Date } | null> {
  const { data, error } = await db()
    .from('portal_requests')
    .select('details, created_at')
    .eq('client_id', client.id)
    .eq('kind', 'application')
    .eq('details->>date', noticeDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new RecordUnreadable(`portal: application answer read failed: ${error.message}`);
  if (!data) return null;
  const decision = (data.details as { decision?: string })?.decision;
  if (decision !== 'go-ahead' && decision !== 'skip') return null;
  return { decision, createdAt: new Date(data.created_at as string) };
}

export interface ApprovalRecord {
  subject: string;
  typedName: string;
  amount: string | null;
  createdAt: Date;
}

/** The client's recorded approval of a subject, or null if they have not approved it. */
export async function loadApproval(
  client: PortalClient,
  subject: string,
): Promise<ApprovalRecord | null> {
  const { data, error } = await db()
    .from('portal_approvals')
    .select('subject, typed_name, amount, created_at')
    .eq('client_id', client.id)
    .eq('subject', subject)
    .maybeSingle();
  if (error) throw new RecordUnreadable(`portal: approval read failed: ${error.message}`);
  if (!data) return null;
  return {
    subject: String(data.subject),
    typedName: String(data.typed_name),
    amount: (data.amount as string | null) ?? null,
    createdAt: new Date(data.created_at as string),
  };
}

/**
 * "Recorded Tuesday 1 September, 9:42 in the morning, by Julia Heron."
 *
 * Pacific time, because that is where the garden is, spelt out rather than
 * left to the reader's locale. "in the morning" and "in the afternoon" rather
 * than am and pm, which is how the design words it.
 */
export function recordedLine(approval: ApprovalRecord): string {
  const zone = 'America/Los_Angeles';
  const date = approval.createdAt.toLocaleDateString('en-US', {
    timeZone: zone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const [weekday, rest] = date.split(', ');
  const monthDay = rest ?? '';
  const [month, day] = monthDay.split(' ');
  const time = approval.createdAt.toLocaleTimeString('en-US', {
    timeZone: zone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const [clock] = time.split(' ');
  const hour = Number(
    approval.createdAt.toLocaleTimeString('en-US', {
      timeZone: zone,
      hour: 'numeric',
      hour12: false,
    }),
  );
  const when = hour < 12 ? 'in the morning' : hour < 18 ? 'in the afternoon' : 'in the evening';
  return `Recorded ${weekday} ${day} ${month}, ${clock} ${when}, by ${approval.typedName}.`;
}
