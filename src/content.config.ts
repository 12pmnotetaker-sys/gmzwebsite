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

const testimonials = defineCollection({
  loader: glob({ base: './src/content/testimonials', pattern: '**/*.md' }),
  schema: z.object({
    /** Client name as they have agreed to be credited. */
    author: z.string(),
    /** Town, matching the project's location field. Never a street. */
    location: townOnly.optional(),
    /** The quote itself. The file body holds the long form, if any. */
    quote: z.string(),
    /**
     * Only publish quotes the client has given permission to publish. Leave
     * false and the entry stays out of every listing. If you do not know that
     * a client agreed, it is not approved.
     */
    approved: z.boolean().default(false),
    project: reference('projects').optional(),
    featured: z.boolean().default(false),
    order: z.number().default(0),
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

export const collections = { projects, services, testimonials, faqs };
