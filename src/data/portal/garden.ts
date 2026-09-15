/**
 * The garden client: Kate Games, Belmont. Weekly on Wednesdays.
 *
 * Every string here is client-facing copy and is bound by the copy rules:
 * no em dashes, no product or manufacturer names, no raw quantities the
 * reader did not ask for, no time on site, no visit duration, and nothing
 * about crew-days, cost, margin or rates. The one price that appears is the
 * monthly figure on the agreement, which the client already signed.
 *
 * Town names only. Never a house number, never a street.
 */

import type { StatusKey } from './status';
import { routes } from './routes';

export interface VisitDay {
  label: string;
  note?: string;
  status: StatusKey;
  statusLabel: string;
}

export interface AgreementRow {
  label: string;
  value: string;
}

export interface DocumentRow {
  title: string;
  note: string;
  href: string;
}

export const client = {
  name: 'Kate Games',
  /** What the top bar says. A town, not an address. */
  property: 'Belmont garden',
  town: 'Belmont',
  kicker: 'Kate Games, your garden',
} as const;

export const nextVisit = {
  date: 'Wednesday, September 2',
  /**
   * A window, never a time, and the reason is said out loud. A portal that
   * promises 8:15 has made a promise the route cannot keep.
   */
  window:
    'Between 8:00 and 11:00 in the morning. We give a window rather than a time, because the garden ahead of yours can run long.',
  status: 'scheduled' as StatusKey,
  statusLabel: 'Scheduled',
} as const;

export const lastVisit = {
  date: 'Wednesday 26 August',
  kicker: 'Last visit, Wednesday 26 August',
  summary:
    'Front beds weeded and edged, roses deadheaded, and the clematis by the fountain tied back in before it pulled itself down.',
  status: 'done' as StatusKey,
  statusLabel: 'Done',
} as const;

/** The visit report, written by a person, on the day. No duration, no time on site. */
export const visitReport = {
  date: 'Wednesday, 26 August',
  body: 'Front beds weeded and edged, and the roses deadheaded. The clematis by the fountain had pulled away from its wires, so we tied it back in before it brought itself down. Cut and blew the lawn, and took the green waste with us.',
  noted: {
    kicker: 'Noted for next time',
    body: 'The bed around the fountain is staying wet longer than the rest of the front. We will check that zone on the irrigation walk on 16 September and tell you what we find.',
  },
  attribution: 'Written by the crew lead on the day.',
  photos: [{ caption: 'Front beds, edged' }, { caption: 'Clematis, tied in' }],
  earlier: '19 August, 12 August, 5 August',
} as const;

export const september: VisitDay[] = [
  { label: 'Wednesday 2', status: 'scheduled', statusLabel: 'Scheduled' },
  { label: 'Wednesday 9', status: 'scheduled', statusLabel: 'Scheduled' },
  {
    label: 'Wednesday 16',
    note: 'Irrigation walk, zone by zone',
    status: 'scheduled',
    statusLabel: 'Scheduled',
  },
  { label: 'Wednesday 23', status: 'scheduled', statusLabel: 'Scheduled' },
  { label: 'Wednesday 30', status: 'scheduled', statusLabel: 'Scheduled' },
];

export const agreement: AgreementRow[] = [
  { label: 'Visits', value: 'Weekly, Wednesdays' },
  { label: 'Crew', value: 'Two people' },
  { label: 'Price', value: '$480.00 a month' },
  { label: 'Term', value: "Month to month, 30 days' notice in writing" },
  { label: 'Price review', value: 'February 2027' },
];

export const agreementNote =
  'Anything outside routine care is priced and approved by you before it happens.';

export const documents: DocumentRow[] = [
  {
    title: 'Service agreement',
    note: 'Signed March 2024, 4 pages',
    href: routes.service,
  },
  {
    title: 'Planting plan',
    note: 'Front garden, revised April 2024',
    href: routes.documents,
  },
  {
    title: 'Warranty',
    note: 'Planting from the 2024 work, one year',
    href: routes.documents,
  },
  {
    title: 'Certificate of insurance',
    note: 'Current, renews January 2027',
    href: routes.documents,
  },
  {
    title: 'Application records',
    note: 'Labels and safety sheets, last three years',
    href: routes.applicationNotice,
  },
];

/**
 * The application pair: a notice before the visit, a record after it.
 *
 * "A soap-based contact spray", never a product name. The re-entry time is the
 * answer the client actually came for, so on the record screen it is the 26px
 * line.
 */
export const application = {
  before: {
    kicker: 'Before your visit',
    date: 'Wednesday, 2 September',
    intent: 'We plan to treat the aphids on the roses in the front beds.',
    facts: [
      { label: 'What we would apply', value: 'A soap-based contact spray' },
      { label: 'Where', value: 'The rose beds, front and side' },
      { label: 'Why now', value: 'The new growth is curling and the buds are sticky' },
    ],
    safety: {
      kicker: 'Children and pets',
      body: 'Keep children and pets off the treated beds until the leaves are dry, about two hours after we finish. Bring in water bowls and toys the night before if you can.',
    },
    deadline:
      'Tell us by Tuesday evening. If we do not hear from you we will leave the roses alone and ask again.',
    /** The same deadline as the rail sets it: the lead as a kicker, the rest as a note. */
    deadlineLead: 'Tell us by Tuesday evening',
    deadlineNote: 'If we do not hear from you we will leave the roses alone and ask again.',
  },
  after: {
    kicker: 'Applied',
    answer: 'Safe again since 11:20 this morning',
    body: 'The leaves were dry by 11:20, Wednesday 2 September. The beds are fine for children and pets.',
    facts: [
      { label: 'What was applied', value: 'A soap-based contact spray for aphids' },
      { label: 'Where', value: 'The rose beds, front and side' },
      { label: 'When', value: 'Wednesday 2 September, morning' },
      { label: 'Applied by', value: 'The crew lead, license on file' },
      { label: 'Safe again', value: '11:20 the same morning' },
    ],
    retention:
      'Kept on your record for three years. The label and the safety sheet are in your documents.',
  },
} as const;

/**
 * The seasonal offer.
 *
 * This is the only screen in the portal that carries a price, and it works
 * because it is a fixed price for a fixed thing. A percentage-off promotion
 * would break the copy rules and would need a different treatment.
 */
export const offer = {
  kicker: 'Autumn planting, until 31 October',
  rowTitle: 'Autumn planting',
  rowNote: 'Cyclamen, $25.00 a flat, planted',
  rowChip: 'Until 31 Oct',
  title: 'Cyclamen, planted for you',
  intro:
    'Colour through the wet months, in beds or in pots. They go in on one of your normal Wednesday visits.',
  price: '$25.00 a flat',
  priceKicker: 'Price a flat',
  includes:
    'The plants, the planting, and the drip line adjusted so they get watered. Nothing else is added.',
  colours: [
    { label: 'Red', swatch: '#B4232A' },
    { label: 'Pink', swatch: '#E68BAE' },
    { label: 'White', swatch: '#FFFFFF' },
    { label: 'Mixed', swatch: null },
  ],
  quantities: ['One', 'Two', 'Three', 'Not sure'],
  quantityNote:
    'Not sure how many your beds take? Choose Not sure and the crew will measure it on Wednesday and tell you before they plant.',
  placeNote: 'In your own words is fine. The crew reads this on Wednesday.',
  recommendLabel: 'Recommend a spot for me',
  recommendNote:
    'We will walk the garden on Wednesday, suggest where they will do best, and tell you before anything is planted.',
  total: {
    kicker: 'What this comes to',
    line: 'Two flats, red: $50.00',
    body: 'Added to your next monthly bill, on top of the $480.00. It does not change your agreement.',
  },
  disclaimer:
    'Sending this is not an approval. We confirm the colour, the number of flats, the spot and the total here before anything is planted.',
} as const;

/** The request form. */
export const request = {
  categories: ['Extra work', 'Something is wrong', 'A question', 'Gates and access'],
  placeholder: 'The hedge along the driveway has grown over the path',
  disclaimer:
    'Sending this is not an approval. If the work costs anything we price it and you approve it before we start.',
  urgent: 'Water running where it should not be, or a gate left open: call, do not send.',
  sent: {
    reference: 'R-2026-0311',
    about: 'Extra work',
    wrote: 'The hedge along the driveway has grown over the path.',
    body: 'We have it. Someone reads it in the office, and if it needs pricing we will send you a price to approve.',
    next: 'The crew will look at the hedge on Wednesday 2 September while they are there. If it is routine they will do it. If it is more than that you will get a price here first.',
  },
} as const;

/** The plants section on the landing, and the summary above the full list. */
export const plantsWaiting = {
  kicker: 'Waiting on you',
  headline: 'Two plants need a decision',
  body: 'Both are marked below. Nothing is bought or pulled out until you say so.',
  bodyRail: 'Both are marked in the list. Nothing is bought or pulled out until you say so.',
} as const;
