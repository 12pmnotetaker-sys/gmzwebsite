import { getCollection, type CollectionEntry } from 'astro:content';
import { FAQ_PHASES } from '../content.config';

export type Faq = CollectionEntry<'faqs'>;
export type FaqPhase = (typeof FAQ_PHASES)[number];

/**
 * The gate, and it is stricter than the one the articles use.
 *
 * An unpublished article is visible while developing because a draft is
 * something a writer wants to see in place. An FAQ answer marked
 * `needsDecision` is not a draft in that sense: it states a policy nobody has
 * decided, and the whole point of holding it is that the words must not be
 * read as GMZ's position, by anyone, on any build. So dev shows unpublished
 * answers only when they are merely unfinished, never when they are undecided.
 */
const isDev = import.meta.env.DEV;

const publishable = (faq: Faq) => faq.data.published || (isDev && !faq.data.needsDecision);

/**
 * Sort-point entries lead within a phase, because they are the questions
 * where jobs are lost; after that the entry's own order decides.
 */
const byWeight = (a: Faq, b: Faq) => {
  const sore = Number(Boolean(b.data.sorePoint)) - Number(Boolean(a.data.sorePoint));
  return sore || a.data.order - b.data.order;
};

export async function getPublishedFaqs(): Promise<Faq[]> {
  const faqs = await getCollection('faqs', publishable);
  assertFactSlotsExist(faqs);
  return faqs.sort(byWeight);
}

/** The phase, as a client would name it. */
export const phaseLabel: Record<FaqPhase, string> = {
  'getting-started': 'Getting started',
  'planning-budget': 'Planning and budget',
  design: 'Design',
  'firm-price': 'A firm price',
  building: 'Building',
  after: 'After',
  maintenance: 'Maintenance',
  bridge: 'From design to build',
};

/** The line under the kicker, one per phase, so a section has a heading and not just a label. */
export const phaseHeading: Record<FaqPhase, string> = {
  'getting-started': 'Before anything is booked.',
  'planning-budget': 'What it costs, and when you find out.',
  design: 'The drawings.',
  'firm-price': 'What a firm price means.',
  building: 'While the crew is there.',
  after: 'When the crew leaves.',
  maintenance: 'Coming back.',
  bridge: 'Between the visit and the build.',
};

export interface FaqGroup {
  phase: FaqPhase;
  label: string;
  heading: string;
  entries: Faq[];
}

/** Every phase with at least one entry, in FAQ_PHASES order. */
export async function getFaqsByPhase(): Promise<FaqGroup[]> {
  const faqs = await getPublishedFaqs();
  return FAQ_PHASES.map((phase) => ({
    phase,
    label: phaseLabel[phase],
    heading: phaseHeading[phase],
    entries: faqs.filter((faq) => faq.data.phase === phase),
  })).filter((group) => group.entries.length > 0);
}

/* ---------------------------------------------------------------------- */
/* Facts read from site.ts                                                 */
/* ---------------------------------------------------------------------- */

/**
 * A fee, the hours or a phone number never gets typed into a Markdown answer;
 * that would be a second home for a fact that has exactly one. Instead an
 * answer's body is written without the figure, and the page appends the fact
 * beneath it, read from `site.ts` at build time.
 *
 * The page decides what each fact looks like. This file only says which
 * answers carry which facts, keyed by entry id, and refuses to build if a key
 * names an entry that no longer exists, so a renamed file cannot quietly drop
 * the line that tells a client what the visit costs.
 */
export const FACTS = ['consultation-fee', 'maintenance-walk', 'hours-and-phones'] as const;
export type Fact = (typeof FACTS)[number];

const factsByEntry: Record<string, Fact[]> = {
  'what-the-first-visit-buys': ['consultation-fee'],
  'what-a-maintenance-visit-involves': ['maintenance-walk'],
  'reaching-us': ['hours-and-phones'],
};

export const factsFor = (faq: Faq): Fact[] => factsByEntry[faq.id] ?? [];

function assertFactSlotsExist(faqs: Faq[]) {
  const ids = new Set(faqs.map((faq) => faq.id));
  for (const id of Object.keys(factsByEntry)) {
    if (!ids.has(id) && !isDev) {
      throw new Error(
        `src/data/faqs.ts names an FAQ entry "${id}" that is not published. Either the ` +
          `file was renamed, or it was unpublished and this map should drop it.`,
      );
    }
  }
}
