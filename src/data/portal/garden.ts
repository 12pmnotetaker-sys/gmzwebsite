/**
 * The garden client the brief supplied: Kate Games, Belmont, weekly on
 * Wednesdays. This is seed data, typed against the record shape, and it is
 * what `npm run portal -- seed` writes into the database so the screens have
 * a garden to show before a real one exists. The pages never import it; they
 * read the signed-in client's record from the database.
 *
 * Every string here is client-facing copy and is bound by the copy rules:
 * no em dashes, no product or manufacturer names, no raw quantities the
 * reader did not ask for, no time on site, no visit duration, and nothing
 * about crew-days, cost, margin or rates. The one price that appears is the
 * monthly figure on the agreement, which the client already signed.
 * `parseRecord` runs the house style regexes (em dashes, manufacturer names,
 * internal figures, hourly rates) on the way in; the rest is held by care.
 *
 * Town names only. Never a house number, never a street.
 */

import type { GardenRecord, PlantRecord } from './shapes';
import { routes } from './routes';

export const gardenSeed: GardenRecord = {
  display: {
    name: 'Kate Games',
    /** What the top bar says. A town, not an address. */
    property: 'Belmont garden',
    town: 'Belmont',
    kicker: 'Kate Games, your garden',
    photoCaption: 'Garden photo',
  },

  nextVisit: {
    date: 'Wednesday, September 2',
    /*
     * A window, never a time, and the reason is said out loud. A portal that
     * promises 8:15 has made a promise the route cannot keep.
     */
    window:
      'Between 8:00 and 11:00 in the morning. We give a window rather than a time, because the garden ahead of yours can run long.',
    status: 'scheduled',
    statusLabel: 'Scheduled',
  },

  /** The service, as the landing row and the service screen name it. */
  service: {
    headline: 'Weekly on Wednesdays',
    rowNote: 'Weekly on Wednesdays, two people',
  },

  lastVisit: {
    date: 'Wednesday 26 August',
    kicker: 'Last visit, Wednesday 26 August',
    summary:
      'Front beds weeded and edged, roses deadheaded, and the clematis by the fountain tied back in before it pulled itself down.',
    status: 'done',
    statusLabel: 'Done',
  },

  /** The visit report, written by a person, on the day. No duration, no time on site. */
  visitReport: {
    date: 'Wednesday, 26 August',
    body: 'Front beds weeded and edged, and the roses deadheaded. The clematis by the fountain had pulled away from its wires, so we tied it back in before it brought itself down. Cut and blew the lawn, and took the green waste with us.',
    noted: {
      kicker: 'Noted for next time',
      body: 'The bed around the fountain is staying wet longer than the rest of the front. We will check that zone on the irrigation walk on 16 September and tell you what we find.',
    },
    attribution: 'Written by the crew lead on the day.',
    photos: [{ caption: 'Front beds, edged' }, { caption: 'Clematis, tied in' }],
    earlier: '19 August, 12 August, 5 August',
    /** The applications row on the report. */
    applicationsNote: 'Nothing was applied on 26 August',
  },

  calendar: {
    month: 'September',
    days: [
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
    ],
  },

  agreement: [
    { label: 'Visits', value: 'Weekly, Wednesdays' },
    { label: 'Crew', value: 'Two people' },
    { label: 'Price', value: '$480.00 a month' },
    { label: 'Term', value: "Month to month, 30 days' notice in writing" },
    { label: 'Price review', value: 'February 2027' },
  ],
  agreementNote: 'Anything outside routine care is priced and approved by you before it happens.',

  documents: [
    {
      title: 'Service agreement',
      note: 'Signed March 2024, 4 pages',
      route: routes.service,
    },
    {
      title: 'Planting plan',
      note: 'Front garden, revised April 2024',
      /* Not on file yet; the row says so rather than opening this shelf again. */
    },
    {
      title: 'Irrigation plan',
      note: 'Zone map, drawn April 2024',
    },
    {
      title: 'Certificate of insurance',
      note: 'Sent on request',
    },
    {
      title: 'Application records',
      note: 'Labels and safety sheets, last three years',
      /* The shelf opens the completed record. The prototype sent this row to the
         pending notice, which is an approval prompt rather than an archive. */
      route: routes.applicationRecord,
    },
  ],

  /** The panel under the documents shelf. */
  documentsAsk: {
    kicker: 'Need something that is not here',
    body: 'Ask and we will add it. Landlords and property managers usually want the insurance certificate and the license on one page.',
    link: 'Ask for a document',
  },

  /**
   * The application pair: a notice before the visit, a record after it.
   *
   * "A soap-based contact spray", never a product name. The re-entry time is
   * the answer the client actually came for, so on the record screen it is
   * the 26px line.
   */
  application: {
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
  },

  /**
   * The seasonal offer.
   *
   * This is the only screen in the portal that carries a price, and it works
   * because it is a fixed price for a fixed thing. A percentage-off promotion
   * would break the copy rules and would need a different treatment.
   */
  offer: {
    slug: 'autumn-planting',
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
    photoCaption: 'Cyclamen photo',
  },

  /** The request form, and the receipt once it is with us. */
  request: {
    categories: ['Extra work', 'Something is wrong', 'A question', 'Gates and access'],
    placeholder: 'The hedge along the driveway has grown over the path',
    disclaimer:
      'Sending this is not an approval. If the work costs anything we price it and you approve it before we start.',
    urgent: 'Water running where it should not be, or a gate left open: call, do not send.',
    ack: {
      body: 'We have it. Someone reads it in the office, and if it needs pricing we will send you a price to approve.',
      next: 'The crew will look at it on Wednesday 2 September while they are there. If it is routine they will do it. If it is more than that you will get a price here first.',
    },
  },

  /** The plants section on the landing, and the summary above the full list. */
  plantsWaiting: {
    kicker: 'Waiting on you',
    headline: 'Two plants need a decision',
    body: 'Both are marked below. Nothing is bought or pulled out until you say so.',
    bodyRail: 'Both are marked in the list. Nothing is bought or pulled out until you say so.',
  },
};

/**
 * The plants on Kate's record, flagged ones first, in the order the design
 * sets. The notes under each are the crew's, one paragraph per entry, and
 * were written for the brief; GMZ reads them before a client does.
 */
export const plantsSeed: { slug: string; data: PlantRecord }[] = [
  {
    slug: 'lavender',
    data: {
      name: 'Lavender, front bed',
      species: 'Lavandula angustifolia',
      where: 'Front bed',
      status: { tone: 'needs', label: 'Needs you' },
      summary:
        'Woody at the base and thin on top. We suggest replacing them this autumn, while the soil is still warm.',
      flag: {
        recommendation:
          'Woody at the base and thin on top. We suggest replacing them this autumn, while the soil is still warm.',
        action: 'Decide about the lavender',
      },
      photo: { caption: 'Photo plate: the lavender in the front bed' },
      onLanding: false,
      notes: [
        'Lavender gives about five or six good years in a bed like yours, then the base goes woody and the flowering thins out from the middle. Cutting back into the old wood does not bring it back, which is why we are suggesting replacement rather than a hard prune.',
        'Autumn is the right window. The soil is still warm enough for roots to take hold before the wet months, so new plants go into winter established rather than sitting cold and wet in open ground.',
        'Nothing is pulled out until you say so.',
      ],
    },
  },
  {
    slug: 'chinese-fringe-flower',
    data: {
      name: 'Chinese fringe flower, side bed',
      species: 'Loropetalum chinense',
      where: 'Side bed',
      status: { tone: 'needs', label: 'Needs you' },
      summary:
        'The new leaves are yellow with green veins. Iron would put the colour back, and we can do it on a normal visit at no extra charge.',
      flag: {
        recommendation:
          'The new leaves are yellow with green veins. Iron would put the colour back, and we can do it on a normal visit at no extra charge.',
        action: 'Decide about the iron',
      },
      photo: { caption: 'Photo plate: the fringe flower, side bed' },
      onLanding: false,
      notes: [
        'Yellow leaves with green veins, on the new growth rather than the old, is the plant telling you it cannot take up enough iron. It is almost always the soil rather than the plant: our ground runs alkaline enough that iron is present but locked up where the roots cannot reach it.',
        'Iron applied to the soil corrects it. The colour comes back over a few weeks, and it holds for a season or two before it wants doing again.',
        'This is routine care on a normal Wednesday, so there is nothing to price and nothing to approve beyond telling us to go ahead.',
      ],
    },
  },
  {
    slug: 'smoke-bush',
    data: {
      name: 'Smoke bush, back corner',
      species: 'Cotinus coggygria',
      where: 'Back corner',
      status: { tone: 'done', label: 'Healthy' },
      summary: 'Back corner',
      photo: { caption: 'Photo plate: the smoke bush, back corner' },
      onLanding: false,
      notes: [
        'Nothing needed. It is doing what it should.',
        'We cut it back hard in late winter, which is what keeps the leaf colour strong and stops it going bare and leggy at the bottom. Left alone it flowers more and colours less; cut back it colours more and barely flowers. Yours is pruned for the colour.',
      ],
    },
  },
  {
    slug: 'coast-live-oak',
    data: {
      name: 'Coast live oak',
      species: 'Quercus agrifolia',
      where: 'Front garden, back corner',
      status: { tone: 'needs', label: 'Protected' },
      summary: 'Front garden, back corner',
      listName: 'Coast live oak, front garden',
      onRecordSince: 'The 2011 survey, already mature',
      water: 'Two deep soaks across the summer, none in winter',
      condition: { tone: 'done', label: 'Healthy' },
      protectedTree: {
        headline: 'Permit needed before any real pruning',
        jurisdiction: 'City of Belmont',
        permit: 'heritage tree permit 2019-0442',
        body: 'City of Belmont, heritage tree permit 2019-0442. Removing more than a quarter of the canopy, or taking the tree down, needs a permit granted before the work starts. We will not touch it beyond clearance and deadwood without one.',
      },
      careHistory: [
        {
          when: 'February 2026',
          what: 'Deadwood taken out and the lower limbs lifted clear of the path. Within the permit exemption.',
        },
        { when: 'July 2025', what: 'Summer soak, and the irrigation kept off the trunk.' },
      ],
      photo: { caption: 'Photo plate: the oak, back corner of the front garden' },
      onLanding: true,
      landingNote: 'Front garden, back corner',
      notes: [
        'A mature coast live oak is the oldest thing in your garden and the one piece of it that cannot be replaced inside a lifetime. Most of what we do for it is restraint.',
        'Summer water is the part people get wrong. An established oak wants the ground around it dry through the summer, and irrigation running against the trunk is what kills them, slowly, over years. Two deep soaks across the season is plenty, and the drip stays well away from the base.',
        "Anything beyond clearance pruning and deadwood needs the city's permission first. That is not our policy, it is the ordinance, and the permit reference is on this record so you have it if you ever need to show it.",
      ],
    },
  },
  {
    slug: 'japanese-maple',
    data: {
      name: 'Japanese maple',
      species: 'Acer palmatum',
      where: 'Side bed',
      status: { tone: 'done', label: 'Healthy' },
      summary: 'Planted March 2023, side bed, weekly water in summer',
      onRecordSince: 'Planted March 2023',
      water: 'Weekly through the summer, less once the weather turns',
      photo: { caption: 'Photo plate: the maple in the side bed' },
      onLanding: true,
      landingNote: 'Side bed, planted March 2023',
      notes: [
        'Still young, and the side bed suits it: morning sun and shade through the worst of the afternoon is what keeps the leaf edges from scorching.',
        'Weekly water through the summer while the roots are still establishing. That eases off as it settles in over the next few seasons.',
        'We prune it lightly and only in winter, when the tree is dormant and the cuts close cleanly.',
      ],
    },
  },
  {
    slug: 'clematis',
    data: {
      name: 'Clematis at the fountain',
      species: 'Clematis',
      where: 'By the fountain',
      status: { tone: 'scheduled', label: 'Watching' },
      summary: 'Planted 2019, tied back in on 26 August',
      onRecordSince: 'Planted 2019',
      condition: { tone: 'scheduled', label: 'Watching' },
      careHistory: [
        {
          when: '26 August 2026',
          what: 'Pulled away from its wires and was tied back in before it brought itself down.',
        },
      ],
      photo: { caption: 'Photo plate: the clematis by the fountain' },
      onLanding: true,
      landingNote: 'Tied back in on 26 August',
      notes: [
        'It had pulled away from its wires and was carrying its own weight on two ties. We tied it back in on the last visit before it brought itself down.',
        'We are watching it rather than calling it fixed, for a reason that is not the plant: the bed around the fountain is staying wet longer than the rest of the front. That points at the irrigation, and we are checking that zone on the walk on 16 September.',
        'You will hear what we find either way.',
      ],
    },
  },
  {
    slug: 'roses',
    data: {
      name: 'Roses, front beds',
      species: 'Rosa',
      where: 'Front beds, front and side',
      status: { tone: 'done', label: 'Healthy' },
      summary: 'Six plants, deadheaded weekly through summer',
      condition: { tone: 'done', label: 'Healthy' },
      careHistory: [
        {
          when: '26 August 2026',
          what: 'Deadheaded, as they are every week through the summer.',
        },
      ],
      photo: { caption: 'Photo plate: the roses in the front beds' },
      onLanding: false,
      notes: [
        'Deadheaded every week through the summer, which is most of what keeps them flowering into the autumn.',
        'There is aphid pressure on the new growth at the moment: curling leaves and sticky buds. We have asked you about treating it, and nothing goes on the beds until you tell us to.',
      ],
    },
  },
];
