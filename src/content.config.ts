import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineCollection, reference, z, type SchemaContext } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Content schemas for the public GMZ marketing site.
 *
 * These are deliberately strict. A build that fails because a project names a
 * photograph that is not in the repo is doing its job: the alternative is a
 * live page with a broken image on it, shown to a client.
 *
 * PUBLIC CONTENT ONLY. Never add cost, margin, burdened-rate, crew-day or
 * overhead fields to these schemas. Contract value belongs in the estimating
 * system, not on a marketing site. `budgetBand` below is the one concession,
 * it is a coarse range, and it stays hidden unless `showBudgetBand` is true.
 */

/** The two service lines GMZ sells. Anything else is a scope, not a line. */
export const SERVICE_LINES = ['design-build', 'maintenance'] as const;

/** Trades a project can involve. Drives the filter chips on /work. */
export const DISCIPLINES = [
  'hardscape',
  'planting',
  'irrigation',
  'drainage',
  'fencing',
  'lighting',
  'lawn',
  'grading',
  'concrete',
  'masonry',
] as const;

/**
 * Town, never a street address.
 *
 * This is the rule that separates the public site from the gated portfolio.
 * The portfolio indexes projects by street name, which GMZ agreed to
 * explicitly, and which is conditioned on that site being behind a veil: a
 * street name plus a photograph of the house often identifies whose garden it
 * is. Nothing public may carry that.
 *
 * It is enforced here rather than left to care, so the way to get a street
 * address onto the public site is to delete this refinement on purpose, in a
 * diff somebody reviews.
 */
const townOnly = z
  .string()
  .min(1)
  .refine((value) => !/^\s*\d/.test(value), {
    message:
      'Location must be a town, not a street address. Public pages say "Atherton, CA"; ' +
      'the street name and number stay in the estimating system and the gated portfolio.',
  });

const seo = z
  .object({
    /** Overrides the page title. Defaults to the entry title. */
    title: z.string().optional(),
    /** Overrides the meta description. Defaults to the entry summary. */
    description: z.string().max(200).optional(),
    /** Set true to keep a page out of the sitemap and add noindex. */
    noindex: z.boolean().default(false),
  })
  .default({});

/**
 * A photo with the alt text required alongside it. Alt is not optional: a site
 * that is mostly photographs is unusable without it.
 *
 * `src` goes through Astro's `image()` helper, so paths resolve relative to
 * the Markdown file and the file must exist at build time. A typo'd photo path
 * fails the build instead of shipping a broken image to a client.
 *
 * `caption` is what a reader sees; `alt` is what a screen reader is told. They
 * should usually differ. "The stairs" is a fine caption and a useless alt.
 */
const photoSchema = (image: SchemaContext['image']) =>
  z.object({
    src: image(),
    alt: z.string().min(1, 'Every photo needs alt text describing what is shown.'),
    caption: z.string().optional(),
    /** Marks a before/after pair member so the gallery can group them. */
    phase: z.enum(['before', 'during', 'after']).optional(),
  });

const projects = defineCollection({
  loader: glob({ base: './src/content/projects', pattern: '**/*.md' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /** One or two sentences for cards and the project header. */
      summary: z.string().max(300),
      /** Town only. See `townOnly` above; this is a client-privacy boundary. */
      location: townOnly,
      /** Completion date. Drives default ordering, newest first. */
      completed: z.coerce.date(),
      serviceLine: z.enum(SERVICE_LINES),
      disciplines: z.array(z.enum(DISCIPLINES)).min(1),
      /** Card and social image. Lives in src/assets/projects/. */
      hero: photoSchema(image),
      gallery: z.array(photoSchema(image)).default([]),
      /** Pull-quote from the client, if one has been given in writing. */
      testimonial: reference('testimonials').optional(),
      /** Show on the homepage. Keep this to a handful. */
      featured: z.boolean().default(false),
      /** Sort weight within featured items; lower sorts first. */
      order: z.number().default(0),
      /**
       * Coarse range only, e.g. "$50k-$100k". Never a contract value, and
       * never shown unless showBudgetBand is explicitly true.
       */
      budgetBand: z.string().optional(),
      showBudgetBand: z.boolean().default(false),
      /**
       * Rough build duration in plain words, e.g. "six weeks".
       *
       * Scope gets described in shape, never in figures. "A full backyard
       * rebuild, about four weeks" is publishable; the crew-days behind it are
       * not.
       */
      duration: z.string().optional(),
      /** Hidden from listings but still buildable, for work in progress. */
      draft: z.boolean().default(false),
      seo,
    }),
});

const services = defineCollection({
  loader: glob({ base: './src/content/services', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    summary: z.string().max(300),
    serviceLine: z.enum(SERVICE_LINES),
    /** Bullets for the service card and detail page. */
    highlights: z.array(z.string()).default([]),
    /**
     * The one line from this service's copy that makes the structural
     * argument, e.g. "A fence is mostly posts." The homepage leads with these
     * rather than restating them, so the claim lives with the service it
     * belongs to.
     */
    pullQuote: z.string().max(200).optional(),
    /** Nav and listing order; lower sorts first. */
    order: z.number().default(0),
    featured: z.boolean().default(false),
    /** Projects that show this service off. */
    relatedProjects: z.array(reference('projects')).default([]),
    draft: z.boolean().default(false),
    seo,
  }),
});

/**
 * Reviews, which are not testimonials, and the difference is the whole point.
 *
 * A testimonial is a quote GMZ chose. A review is somebody else's words on
 * somebody else's platform, and a reader can go and check it. That is what
 * makes it worth publishing, so the schema refuses to let it become the other
 * thing by accident: anything not written directly to GMZ must carry a link
 * back to the original. You cannot claim a Google review here without saying
 * where it is.
 *
 * `approved` still gates everything, because a client agreeing to leave a
 * public review is not the same as agreeing to be quoted on a marketing page.
 * If you do not know that they agreed, it is not approved.
 */
const REVIEW_PLATFORMS = ['Google', 'Yelp', 'Houzz', 'Direct'] as const;

const reviews = defineCollection({
  loader: glob({ base: './src/content/reviews', pattern: '**/*.md' }),
  schema: z
    .object({
      /** As they have agreed to be credited, which on most platforms is a first name and an initial. */
      author: z.string(),
      /** Town, never a street. Same rule as everywhere else public. */
      location: townOnly.optional(),
      quote: z.string(),
      platform: z.enum(REVIEW_PLATFORMS),
      /** The original, so a reader can verify it. Required unless Direct. */
      sourceUrl: z.string().url('A review needs a link a reader can actually follow.').optional(),
      /** When it was written. A five year old review presented as current is a small lie. */
      reviewed: z.coerce.date(),
      rating: z.number().min(1).max(5).optional(),
      approved: z.boolean().default(false),
      project: reference('projects').optional(),
      featured: z.boolean().default(false),
      order: z.number().default(0),
    })
    .refine((review) => review.platform === 'Direct' || Boolean(review.sourceUrl), {
      message:
        'A review from a public platform must link to the original. Without it this is a ' +
        'quote GMZ chose, not a review, and it should be marked Direct instead.',
      path: ['sourceUrl'],
    }),
});

/* ---------------------------------------------------------------------- */
/* The gated portfolio                                                     */
/* ---------------------------------------------------------------------- */

/**
 * This collection is the private portfolio, and it plays by different rules to
 * `projects` above.
 *
 * It indexes work BY STREET NAME, which GMZ agreed to explicitly and which is
 * conditioned on these pages sitting behind the veil: a street name plus a
 * photograph of the house often identifies whose garden it is. Every route
 * built from this collection is gated and carries noindex, and robots.txt
 * disallows the whole prefix, permanently and independently of whether the
 * marketing site is indexable.
 *
 * Never move an entry from here into `projects` by copying it. The public
 * collection has no street field, on purpose.
 */

const mediaFile = z.string().refine(
  (file) => existsSync(path.join(process.cwd(), 'public/media', file)),
  (file) => ({
    message:
      `public/media/${file} does not exist. Add the video, or drop the field ` +
      `so the "to come" state renders instead.`,
  }),
);

/**
 * A Google Drive file id, embedded as an iframe player.
 *
 * Used only where GMZ has no local copy of the footage. These depend on the
 * Drive file staying link-shared: revoke the share and the player goes blank,
 * with nothing at build time to warn us. Prefer a local file under
 * `public/media/` whenever one exists.
 */
const driveId = z.string().regex(/^[A-Za-z0-9_-]{20,}$/, 'Not a Google Drive file id.');

/**
 * A photograph or rendering, with the alt text required alongside it.
 *
 * Alt is not optional and there is no way around it: a portfolio that is
 * almost entirely images is unusable without it. `label` is the visible
 * caption and `alt` is what a screen reader is told, so they are allowed to
 * differ: "The stairs" is a fine caption and a useless alt.
 */
const picture = (image: SchemaContext['image']) =>
  z.object({
    /** Visible caption. Short. */
    label: z.string().min(1),
    src: image(),
    /**
     * A larger crop for the lightbox, when one exists. The grid keeps using
     * `src`, so this is bandwidth spent only when someone zooms in.
     */
    full: image().optional(),
    alt: z.string().min(1, 'Every image needs alt text describing what is shown.'),
    /** The sentence or two under the caption. */
    note: z.string().optional(),
  });

/**
 * One panel in a video row: a local clip, a Drive embed, or a still standing
 * in for footage that does not exist. Exactly one of the three.
 */
const clip = (image: SchemaContext['image']) =>
  z
    .object({
      /** Stable id. Keys the saved playback position, so do not renumber. */
      key: z.string().min(1),
      label: z.string().min(1),
      file: mediaFile.optional(),
      drive: driveId.optional(),
      still: image().optional(),
      /** Alt text, required when `still` is set. */
      alt: z.string().optional(),
      /**
       * The footage exists but is not in the repo yet. Renders the design's
       * "to come" panel under this clip's label rather than an empty box.
       * Swap it for `file:` when the mp4 lands in public/media/.
       */
      pending: z.literal(true).optional(),
      /**
       * Rewind at this many seconds. Used where only the opening of a clip is
       * worth showing.
       */
      stop: z.number().positive().optional(),
    })
    .refine(
      (c) => [c.file, c.drive, c.still, c.pending].filter(Boolean).length === 1,
      'A clip needs exactly one of file, drive, still or pending.',
    )
    .refine((c) => !c.still || !!c.alt, 'A still needs alt text.');

/** A before/after pair for the drag-to-compare slider. */
const comparePair = (image: SchemaContext['image']) =>
  z.object({
    /** Tab label, when a project has more than one pair. */
    label: z.string().min(1),
    a: image(),
    b: image(),
    aAlt: z.string().min(1),
    bAlt: z.string().min(1),
    /** Overrides the section's own handle labels for this pair. */
    aLabel: z.string().optional(),
    bLabel: z.string().optional(),
    note: z.string().min(1),
  });

const portfolio = defineCollection({
  loader: glob({ base: './src/content/portfolio', pattern: '**/*.md' }),
  schema: ({ image }) =>
    z.object({
      /**
       * The name the project is indexed under.
       *
       * The portfolio indexes by street name, which is how GMZ refers to jobs
       * internally and what the design was drawn around. That is a deliberate
       * departure from the town-only rule the public scaffold used for client
       * privacy, and it is the reason this portfolio sits behind the veil
       * rather than in the sitemap. Never add a house number.
       */
      name: z.string().min(1),
      /** The editorial headline for the project. */
      title: z.string().min(1),
      /** Kicker above the name, e.g. "Design & Construction". */
      kicker: z.string().min(1),
      /** One-line descriptor shown opposite the name. Not an address. */
      meta: z.string().min(1),
      /** The trades involved. Rendered as a list and joined with "·". */
      scope: z.array(z.string().min(1)).min(1),
      /** Where the job stands, in GMZ's own words. */
      phase: z.string().min(1),
      /** The paragraph under the project header, and the index card blurb. */
      summary: z.string().min(1),
      /** Index order. The design sets this by hand, so it is explicit. */
      order: z.number(),
      /** Index card image. Falls back to the first drawing when absent. */
      hero: picture(image).optional(),

      /** The tabbed "Drawings" set: the design as it was drawn. */
      drawings: z.array(picture(image)).default([]),
      /** The "Finished" grid: photographed on completion. */
      built: z.array(picture(image)).default([]),
      /** The "Photographs" grid: more from the site. */
      photos: z.array(picture(image)).default([]),

      /** Schemes that were drawn and not chosen. */
      alternates: z
        .object({
          heading: z.string().min(1),
          note: z.string().min(1),
          groups: z
            .array(
              z.object({
                name: z.string().min(1),
                note: z.string().min(1),
                items: z.array(picture(image)).min(1),
              }),
            )
            .min(1),
        })
        .optional(),

      /** The walkthrough section: a single film, a row of clips, or both. */
      walkthrough: z
        .object({
          heading: z.string().optional(),
          note: z.string().min(1),
          /** A single feature film, as a local file or a Drive embed. */
          file: mediaFile.optional(),
          drive: driveId.optional(),
          /**
           * The film exists but is not in the repo yet. Renders the design's
           * "Walkthrough to come" panel. Swap for `file:` when it lands.
           */
          pending: z.literal(true).optional(),
          /** A row of short clips. */
          clips: z.array(clip(image)).default([]),
          /** A second row, shot before and after the build. */
          beforeAfterHeading: z.string().optional(),
          beforeAfterNote: z.string().optional(),
          beforeAfter: z.array(clip(image)).default([]),
        })
        .optional(),

      /** The drag-to-compare slider. */
      compare: z
        .object({
          heading: z.string().min(1),
          intro: z.string().min(1),
          aLabel: z.string().min(1),
          bLabel: z.string().min(1),
          pairs: z.array(comparePair(image)).min(1),
        })
        .optional(),

      /** Hidden from the index but still buildable, for work in progress. */
      draft: z.boolean().default(false),
      seo,
    }),
});

/** The eight stages a customer moves through, in order. Drives FAQ grouping. */
export const FAQ_PHASES = [
  'getting-started',
  'planning-budget',
  'design',
  'firm-price',
  'building',
  'after',
  'maintenance',
  'bridge',
] as const;

/**
 * The four things that come up on nearly every job. An entry tagged with one
 * gets led with rather than buried, because these are where deals are lost.
 */
export const SORE_POINTS = ['range-vs-price', 'design-fee', 'change-orders', 'timeline'] as const;

const faqs = defineCollection({
  loader: glob({ base: './src/content/faqs', pattern: '**/*.md' }),
  schema: z.object({
    /** In the client's own words, the way they would actually ask it. */
    question: z.string(),
    /** Three to six words, for compact navigation. */
    short: z.string(),
    phase: z.enum(FAQ_PHASES),
    serviceLine: z.enum([...SERVICE_LINES, 'both']),
    sorePoint: z.enum(SORE_POINTS).optional(),
    /** Sort weight within a phase; lower sorts first. */
    order: z.number().default(0),
    /**
     * Nothing renders in production until this is true. An answer that states
     * a policy nobody has decided is worse than no answer, because a client
     * will hold GMZ to whatever the website said. Same gate as a testimonial.
     */
    published: z.boolean().default(false),
    /** True when the answer depends on a decision that has not been made. */
    needsDecision: z.boolean().default(false),
    /** Exactly what has to be confirmed before this can be published. */
    decisionNote: z.string().optional(),
  }),
});

/**
 * Long-form answers: the pieces that are too big to sit in the FAQ list.
 *
 * These carry a rule the other collections do not need. An article that states
 * what a town's ordinance requires is making a claim a client may act on, and
 * a wrong one is worse than silence. So `sources` is required and must not be
 * empty: nothing publishes here without naming where its facts came from, and
 * `updated` is required because regulation goes stale and a reader deserves to
 * know when this was last checked.
 */
const articles = defineCollection({
  loader: glob({ base: './src/content/articles', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    /** Three to six words, for compact navigation. */
    short: z.string(),
    lede: z.string(),
    /** When the facts were last verified against the sources below. */
    updated: z.coerce.date(),
    sources: z
      .array(
        z.object({
          label: z.string().min(1),
          href: z.string().url('A source needs a real URL a reader can follow.'),
        }),
      )
      .min(1, 'An article that states a rule must name where the rule came from.'),
    /**
     * Renders the standing note that this is general information and that the
     * town, not GMZ, is the authority. True for anything describing a code,
     * an ordinance or a permit.
     */
    advisory: z.boolean().default(false),
    /** Same gate as an FAQ answer: nothing renders in production until true. */
    published: z.boolean().default(false),
    order: z.number().default(0),
    seo: seo.optional(),
  }),
});

/**
 * One page per town in the service area.
 *
 * These are the pages that go wrong most easily. The standard version of this
 * across the field is the same paragraph ten times with the town name swapped,
 * which is thin content: it ages badly, it says nothing a reader could not
 * guess, and it dilutes a site that is otherwise deliberately small.
 *
 * So a town page cannot publish on enthusiasm alone. `localNote` has to say
 * something that is actually true of this town and not the next one, it has a
 * length floor so a fragment cannot pass for one, and it must cite where the
 * fact came from. `content-lint` additionally fails the build if two town
 * pages ship the same local text, which is the failure this collection exists
 * to prevent and the one a schema cannot catch on its own.
 *
 * A town nobody has verified stays unpublished with the reason recorded, which
 * is better than a page that pads.
 */
const towns = defineCollection({
  loader: glob({ base: './src/content/towns', pattern: '**/*.md' }),
  schema: z
    .object({
      name: z.string(),
      county: z.enum(['San Mateo', 'Santa Clara']),
      /**
       * What is genuinely different about working here: which department
       * reviews it, what the town publishes, how its rules differ. Not a
       * description of the town, and not a description of GMZ.
       */
      localNote: z
        .string()
        .min(80, 'Too short to be worth a page. Say what is actually different about this town.'),
      updated: z.coerce.date(),
      sources: z
        .array(
          z.object({
            label: z.string().min(1),
            href: z.string().url('A source needs a real URL a reader can follow.'),
          }),
        )
        .default([]),
      published: z.boolean().default(false),
      /** Why this town has no page yet. Required when it is not published. */
      unpublishedReason: z.string().optional(),
      order: z.number().default(0),
    })
    .superRefine((town, ctx) => {
      /*
       * The requirements apply to what ships, not to what sits in the folder.
       * An unpublished town is a placeholder and should not have to invent a
       * citation to satisfy a schema: a borrowed URL that looks like evidence is
       * worse than an empty list, because the next person assumes it was checked.
       */
      if (town.published && town.sources.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sources'],
          message:
            'A published town page states local rules, so it must name where they came from.',
        });
      }
      if (!town.published && !town.unpublishedReason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['unpublishedReason'],
          message: 'Say why this town has no page yet, so nobody has to guess later.',
        });
      }
    }),
});

export const collections = { projects, services, reviews, faqs, portfolio, articles, towns };
