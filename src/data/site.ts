/**
 * Single source of truth for every company fact on this site.
 *
 * Nothing in `src/` may hardcode a phone number, an address, a license number
 * or the tagline. Components read from here. This mirrors the rule the
 * estimating system learned the hard way: one fact with many homes drifts
 * apart, and correcting one copy leaves the others wrong.
 *
 * Everything in this file is PUBLIC. Cost, margin, overhead, burdened rates
 * and crew capacity are internal to GMZ and must never appear on the website.
 *
 * The contested facts here were confirmed by Xavier on 2026-08-19, against
 * brand documents that disagreed with each other. Where a brand document and
 * this file conflict in future, this file wins unless someone re-confirms:
 * it has been right three for three (license, email, phone).
 */

export interface Phone {
  /** Who answers. */
  name: string;
  /** Display form, e.g. "(650) 274-5188". */
  display: string;
  /** E.164 for `tel:` links, e.g. "+16502745188". */
  tel: string;
}

export const company = {
  /** Legal entity name, for footers, schema.org and legal lines. */
  legalName: 'GMZ Landscaping Inc.',
  /** Display name used in headings and nav. */
  name: 'GMZ Landscaping',
  /** Short form for the logo lockup. */
  shortName: 'GMZ',

  /**
   * Set by Xavier 2026-08-06: three services, not three trades. Do not revert
   * to "LANDSCAPE · HARDSCAPE · FENCING" without asking. The 2026 Master Brand
   * Manual says no tagline was ever chosen and offers four candidates; it
   * predates this decision and does not override it.
   */
  tagline: 'Design · Build · Maintenance',

  /** One-sentence description, used for meta descriptions and the hero. */
  summary:
    'A licensed landscape contractor serving the San Francisco Peninsula, designing, building and maintaining outdoor spaces.',

  /** First year of trading. Drives the "since" line and the About facts. */
  founded: 1994,

  /**
   * The founder. Confirmed 2026-08-19: Gomez with a z, no accent.
   *
   * Three documents disagreed. The 2025 brand PDF and the Business Profile
   * both say Rafael; the 2026 Master Brand Manual says "Samuel Gomez" and is
   * simply wrong. That error is why the manual is trusted for voice and colour
   * but not for business facts.
   */
  founder: 'Rafael Gomez Sr.',

  address: {
    mailing: 'P.O. Box 3718, Redwood City, CA 94064',
    /** Split form, for the footer and contact panel which stack the lines. */
    mailingLines: ['P.O. Box 3718', 'Redwood City, CA 94064'],
    locality: 'Redwood City',
    region: 'CA',
    postalCode: '94064',
    country: 'US',
  },

  /**
   * Confirmed 2026-08-19 as the real, day-to-day address. Printed collateral
   * (business cards, letterhead, envelopes) shows `rglandscape@yahoo.com`
   * without the "1"; that address is wrong and the next reprint should be
   * generated from this file rather than retyped.
   */
  email: 'rglandscape1@yahoo.com',

  /**
   * Order matters. Where only one number fits (the footer, the compact
   * header) the site takes the first entry, so whoever is listed first is
   * who a client calls.
   *
   * The first number was confirmed 2026-08-19. Printed collateral shows
   * `650 533 8094`, which is not in use.
   */
  phones: [
    { name: 'Xavier', display: '(650) 274-5188', tel: '+16502745188' },
    { name: 'Lili', display: '(650) 283-6296', tel: '+16502836296' },
    { name: 'Rafael Jr.', display: '(650) 307-9993', tel: '+16503079993' },
  ] satisfies Phone[],

  /** Office hours. The contact panel stacks these, the footer runs them inline. */
  hours: {
    days: 'Monday to Friday',
    daysShort: 'Mon–Fri',
    time: '8am – 4pm',
  },

  /**
   * California State License Board number. Confirmed 2026-07-25, re-confirmed
   * 2026-08-19 against a client contract that carries `696696`. That contract
   * is wrong; this is the number.
   *
   * California requires the license number in advertising (B&P 7030.5), so
   * this renders in the footer on every page. The classification is not
   * recorded in any GMZ document and is not required by that statute.
   */
  license: {
    label: 'CSLB License',
    number: '636636',
    display: 'CSLB License #636636',
  },

  /**
   * Who draws the plans. Stated on project pages and in the About facts,
   * because "in house" is a differentiator clients ask about.
   */
  drawings: 'In house',

  /**
   * The region as GMZ describes it in prose. `serviceArea` below is the
   * town-by-town claim; this is the shorthand the design uses in headings.
   */
  serviceRegion: 'The Peninsula',

  /**
   * Towns GMZ actively works in. Used by the service-area section and the
   * areaServed field in structured data.
   *
   * Keep this honest; it is a claim. No brand document names a single town, so
   * this list is the only one that exists. Do not extend it by reading job
   * addresses: overstating reach is a trust claim, not a marketing choice.
   */
  serviceArea: [
    'Redwood City',
    'Atherton',
    'Menlo Park',
    'Palo Alto',
    'Woodside',
    'San Carlos',
    'Belmont',
    'Portola Valley',
    'Los Altos',
    'Hillsborough',
  ],

  /**
   * Professional bodies GMZ belongs to. Each is a claim; drop the entry
   * rather than let a lapsed membership keep rendering.
   */
  memberships: [
    {
      name: 'Association of Professional Landscape Designers',
      abbr: 'APLD',
      /** Logo under src/assets/brand/. Alt text is the full name above. */
      logo: 'apld-logo.webp',
    },
  ],

  /** Public social profiles. Leave a value empty to hide the link. */
  social: {
    instagram: '',
    facebook: '',
    yelp: '',
    google: '',
  },
} as const;

/**
 * Claims the site is not yet allowed to make.
 *
 * A claim goes here rather than into prose so it cannot be written by
 * accident. Flip a flag only when the underlying fact has been confirmed by
 * someone who can be held to it, and say in the note who confirmed what.
 *
 * `licensedAndInsured` is false on purpose. The CSLB number above is settled
 * and publishable on its own; the insurance half is not. No GMZ document
 * states a carrier, a coverage amount or a bond, and the portfolio's
 * `licensed-and-insured` FAQ answer is held back for exactly this reason. A
 * client can hold GMZ to whatever the website said, so the website does not
 * say it yet.
 */
export const claims = {
  licensedAndInsured: false,
  licensedAndInsuredNote:
    'Insurance wording unconfirmed as of 2026-08-19. Only the CSLB number is settled. ' +
    'Confirm carrier and coverage before setting this true.',
} as const;

/**
 * What a client pays before any drawing exists.
 *
 * Ratified and live as of 2026-08-17, from the GMZ fee schedule. These are
 * prices to the client, not internal costs, so they belong on the site. The
 * "nothing internal reaches the site" rule protects GMZ's cost structure, not
 * its rate card; the two look similar and are not the same thing.
 *
 * Nothing here is credited against anything later. That is deliberate and it
 * is stated plainly, because the worst moment for a client to discover it is
 * at contract signing.
 */
export const fees = {
  consultation: {
    display: '$175',
    /** What the fee buys. */
    covers: 'the first hour on the property',
    prepaid: true,
  },
  maintenanceWalk: {
    display: '$75',
    prepaid: true,
  },
  travel: {
    display: '$100',
    /** Charged on top when the property is outside the service area. */
    note: 'outside the towns served',
    limitMiles: 40,
  },
  /** No fee is credited toward a later stage. */
  credited: false,
} as const;

/** The number a visitor calls when only one fits. */
export const primaryPhone: Phone = company.phones[0];

/** The second number the contact page offers as an alternative. */
export const secondaryPhone: Phone = company.phones[1];

/**
 * Derived display strings. These exist so the license number and the founding
 * year each keep exactly one home: change the value above and every rendering
 * of it follows.
 */
export const licenseShort = `CSLB #${company.license.number}`;
/** "the Peninsula", for use mid-sentence where the capital would read oddly. */
export const serviceRegionInline = company.serviceRegion.replace(/^The\b/, 'the');
export const hoursInline = `${company.hours.daysShort} ${company.hours.time}`;
export const foundedLine = `since ${company.founded}`;

export const site = {
  /**
   * The production origin. Overridden at build time by SITE_URL; see
   * astro.config.mjs.
   *
   * It is gmzlandscape.com, with no "ing". GMZ does not own gmzlandscaping.com
   * and never has. Confirmed 2026-08-17.
   */
  url: 'https://www.gmzlandscape.com',
  title: `${company.name} — ${company.tagline}`,
  titleTemplate: `%s | ${company.name}`,
  description: company.summary,
  locale: 'en_US',
  /** Path under /public. Regenerated from the mark; see the brand script. */
  ogImage: '/og-default.jpg',
} as const;

export interface NavItem {
  label: string;
  href: string;
}

/**
 * Primary navigation, in the order a visitor should meet the site.
 *
 * The Work comes first because the portfolio is what earns the bigger jobs,
 * and Contact comes last because the site's real conversion is /start, which
 * sits in the header as a button rather than a nav link.
 *
 * `/portal` is deliberately absent. The route is reserved for the client
 * portal and the nav slot goes in when there is something behind it.
 */
export const primaryNav: NavItem[] = [
  { label: 'The Work', href: '/work' },
  { label: 'Services', href: '/services' },
  { label: 'Process', href: '/process' },
  { label: 'About', href: '/about' },
  { label: 'Answers', href: '/faq' },
  { label: 'Contact', href: '/contact' },
];

/** The one action the whole site is pointed at. */
export const primaryCta = { label: 'Start a project', href: '/start' } as const;
