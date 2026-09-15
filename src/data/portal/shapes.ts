/**
 * The shape of everything a client is shown.
 *
 * A garden record and a project record are stored as one JSON document each,
 * and this file is the one place their shape is written down. The seed data
 * in `garden.ts` and `project.ts` is typed against it, the loaders in
 * `src/server/records.ts` parse against it on every read, and the admin
 * script parses against it on every write. A record that does not fit does
 * not reach a screen; the screen says the record could not be read instead.
 *
 * Two kinds of rule live here.
 *
 * The structural ones are ordinary zod: a draw needs a trigger, a protected
 * tree needs both a permit and a jurisdiction, a chip always carries its word.
 *
 * The copy rules are the house style, applied to every string in the record
 * by `checkRecordCopy`: no em dashes, no manufacturer names, no internal
 * figures, no hourly rates. They are the same regexes `content-lint` runs over
 * the built site, imported from the same file, so a sentence that would fail
 * the build fails a record too. The build gate cannot read a database; this
 * is how the same gate reaches it.
 *
 * Nothing here is a schedule code, a time on site, a duration, a percentage
 * or a crew-day count, and nothing should be added that is.
 */
import { z } from 'astro/zod';
import { proseProblems } from '../../../scripts/lib/copy-rules.mjs';

/* ---- Shared pieces --------------------------------------------------- */

export const statusKey = z.enum(['done', 'scheduled', 'needs']);
export type StatusKey = z.infer<typeof statusKey>;

/** A chip always shows its word as well as its colour. */
export const chip = z.object({ tone: statusKey, label: z.string().min(1) });
export type Chip = z.infer<typeof chip>;

const text = z.string().min(1);

/** A label and a value, as the fact rows render them. */
export const factRow = z.object({ label: text, value: text });
export type FactRow = z.infer<typeof factRow>;

/**
 * A photograph on a record. `path` is a location in the private storage
 * bucket; the server mints a signed URL for it when the page renders. With no
 * path the screen shows a plate that names the photograph it stands for.
 */
export const photo = z.object({
  caption: text,
  alt: z.string().optional(),
  path: z.string().optional(),
});
export type Photo = z.infer<typeof photo>;

/* ---- The garden record ------------------------------------------------ */

export const visitDay = z.object({
  label: text,
  note: z.string().optional(),
  status: statusKey,
  statusLabel: text,
});
export type VisitDay = z.infer<typeof visitDay>;

/**
 * A document on the shelf. Exactly one of three states: `route` opens a
 * screen in the portal, `path` opens a file from private storage, neither
 * means the document is not on file yet and the row says "To come".
 */
export const documentRow = z
  .object({
    title: text,
    note: text,
    route: z.string().optional(),
    path: z.string().optional(),
  })
  .refine((row) => !(row.route && row.path), 'A document opens a screen or a file, not both.');
export type DocumentRow = z.infer<typeof documentRow>;

export const applicationNotice = z.object({
  kicker: text,
  date: text,
  intent: text,
  facts: z.array(factRow).min(1),
  safety: z.object({ kicker: text, body: text }),
  deadline: text,
  deadlineLead: text,
  deadlineNote: text,
});

export const applicationRecord = z.object({
  kicker: text,
  answer: text,
  body: text,
  facts: z.array(factRow).min(1),
  retention: text,
});

export const offer = z.object({
  /** The route segment: /portal/garden/offers/<slug>. */
  slug: z.string().regex(/^[a-z0-9-]+$/),
  kicker: text,
  rowTitle: text,
  rowNote: text,
  rowChip: text,
  title: text,
  intro: text,
  price: text,
  priceKicker: text,
  includes: text,
  colours: z.array(z.object({ label: text, swatch: z.string().nullable() })).min(1),
  quantities: z.array(text).min(1),
  quantityNote: text,
  placeNote: text,
  recommendLabel: text,
  recommendNote: text,
  total: z.object({ kicker: text, line: text, body: text }),
  disclaimer: text,
  photoCaption: text,
});
export type Offer = z.infer<typeof offer>;

export const gardenRecord = z.object({
  display: z.object({
    name: text,
    /** What the top bar says. A town, not an address. */
    property: text,
    town: text,
    kicker: text,
    photoCaption: text,
  }),
  nextVisit: z.object({ date: text, window: text, status: statusKey, statusLabel: text }),
  service: z.object({ headline: text, rowNote: text }),
  lastVisit: z.object({
    date: text,
    kicker: text,
    summary: text,
    status: statusKey,
    statusLabel: text,
  }),
  visitReport: z.object({
    date: text,
    body: text,
    noted: z.object({ kicker: text, body: text }),
    attribution: text,
    photos: z.array(photo),
    earlier: text,
    applicationsNote: text,
  }),
  calendar: z.object({ month: text, days: z.array(visitDay).min(1) }),
  agreement: z.array(factRow).min(1),
  agreementNote: text,
  documents: z.array(documentRow),
  documentsAsk: z.object({ kicker: text, body: text, link: text }),
  application: z.object({
    before: applicationNotice.optional(),
    after: applicationRecord.optional(),
  }),
  offer: offer.optional(),
  request: z.object({
    categories: z.array(text).min(1),
    placeholder: text,
    disclaimer: text,
    urgent: text,
    /** The receipt: what we say once it is with us, and where it goes next. */
    ack: z.object({ body: text, next: text }),
  }),
  plantsWaiting: z.object({ kicker: text, headline: text, body: text, bodyRail: text }),
});
export type GardenRecord = z.infer<typeof gardenRecord>;

/* ---- A plant on the record -------------------------------------------- */

export const plantRecord = z.object({
  name: text,
  species: text,
  where: text,
  status: chip,
  summary: text,
  listName: z.string().optional(),
  onRecordSince: z.string().optional(),
  water: z.string().optional(),
  condition: chip.optional(),
  /** A protected tree shows its permit and the jurisdiction, or it is not protected. */
  protectedTree: z
    .object({ headline: text, jurisdiction: text, permit: text, body: text })
    .optional(),
  /** What the crew has flagged, and what they suggest. Words, never a price. */
  flag: z.object({ recommendation: text, action: text }).optional(),
  careHistory: z.array(z.object({ when: text, what: text })).optional(),
  photo: photo.optional(),
  onLanding: z.boolean().default(false),
  landingNote: z.string().optional(),
  /** The crew's notes, one paragraph per entry. */
  notes: z.array(text).default([]),
});
export type PlantRecord = z.infer<typeof plantRecord>;

/** A plant as a page sees it: the record plus its slug. */
export interface Plant {
  slug: string;
  data: PlantRecord;
}

/* ---- The project record ---------------------------------------------- */

export const lineItem = z.object({
  label: text,
  amount: text,
  /** Set on the one line held as an allowance, which must say so on screen. */
  allowance: z.boolean().optional(),
});
export type LineItem = z.infer<typeof lineItem>;

/** Dollars and cents, one row per milestone, each naming its trigger. */
export const draw = z.object({ label: text, amount: text, trigger: text });
export type Draw = z.infer<typeof draw>;

export const stage = z.object({
  done: z.number().int().min(0),
  now: z.number().int().min(1),
  caption: text,
});

export const approvalSheet = z.object({
  kicker: text,
  headline: text,
  lines: z.array(lineItem).min(1),
  body: text,
});

export const changeOrder = z.object({
  /** The number in the route: /portal/project/change-orders/<id>. */
  id: z.number().int().positive(),
  kicker: text,
  title: text,
  scope: text,
  amount: text,
  amountNote: text,
  amountNoteShort: text,
  /** The effect on the payment schedule. California requires it; the amber panel shows it. */
  schedule: z.object({
    kicker: text,
    rows: z.array(z.object({ label: text, value: text, changed: z.boolean() })).min(1),
    note: text,
  }),
  disclaimer: text,
  approval: approvalSheet,
});
export type ChangeOrder = z.infer<typeof changeOrder>;

export const projectRecord = z.object({
  display: z.object({ name: text, property: text, town: text, kicker: text, projectName: text }),
  proposal: z.object({
    estimateNo: text,
    total: text,
    summary: text,
    priceLine: text,
    scope: text,
    scopeLines: z.array(text).min(1),
    lines: z.array(lineItem).min(1),
    allowance: z.object({ kicker: text, why: text, effect: text, short: text, kickerShort: text }),
    draws: z.array(draw).min(1),
    drawsHeadline: text,
    drawsNote: text,
    notices: z.object({
      kicker: text,
      body: text,
      /** The statutory notices as the PDF on file, in private storage. */
      path: z.string().optional(),
    }),
  }),
  approval: approvalSheet,
  approved: z.object({
    answer: text,
    next: z.array(z.object({ when: text, what: text })).min(1),
  }),
  changeOrders: z.array(changeOrder),
  /** The receipt after a question about the proposal. */
  requestAck: z.object({ body: text, next: text }),
  request: z.object({
    categories: z.array(text).min(1),
    placeholder: text,
    disclaimer: text,
    urgent: text,
  }),
  stages: z.object({ total: z.number().int().positive(), atProposal: stage, atApproved: stage }),
});
export type ProjectRecord = z.infer<typeof projectRecord>;

/* ---- The copy rules, over a whole record ----------------------------- */

/**
 * Every house-style problem in a record, as "path: rule (offending text)".
 *
 * Walks every string in the document, whatever its depth. A colour swatch is
 * a string too, and a hex value cannot break a prose rule, so nothing needs
 * to be excluded.
 */
export function checkRecordCopy(record: unknown, path = 'record'): string[] {
  const problems: string[] = [];
  const walk = (value: unknown, at: string) => {
    if (typeof value === 'string') {
      for (const [rule, text] of proseProblems(value)) problems.push(`${at}: ${rule} ("${text}")`);
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${at}[${i}]`));
    } else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) walk(item, `${at}.${key}`);
    }
  };
  walk(record, path);
  return problems;
}

/**
 * Parse a record against its schema and the copy rules together.
 *
 * Used on the way in by the admin script and on the way out by the loaders,
 * so the same failure is reported by the same words in both places.
 */
export function parseRecord<S extends z.ZodTypeAny>(
  schema: S,
  raw: unknown,
  what: string,
): z.output<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`${what} does not fit its schema. ${issues}`);
  }
  const problems = checkRecordCopy(parsed.data, what);
  if (problems.length > 0) {
    throw new Error(`${what} breaks house style. ${problems.join('; ')}`);
  }
  return parsed.data;
}
