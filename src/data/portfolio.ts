import { getCollection, type CollectionEntry } from 'astro:content';

/**
 * Query helpers and page copy for the portfolio.
 *
 * The project entries themselves live in `src/content/portfolio/`. What is
 * here is the material the design holds as page structure rather than as
 * per-project content: the three service stages, the four process steps, and
 * the index of walkthrough films.
 */

export type Project = CollectionEntry<'portfolio'>;

/** True in `astro dev`, false in a production build. */
const isDev = import.meta.env.DEV;

/** Drafts are visible while developing and invisible in production. */
const publishable = (entry: Project) => isDev || !entry.data.draft;

/** Every publishable project, in the order the design sets. */
export async function getProjects(): Promise<Project[]> {
  const projects = await getCollection('portfolio', publishable);
  return projects.sort((a, b) => a.data.order - b.data.order);
}

/** The URL for a project's page. */
export const projectHref = (project: Project) => `/portfolio/${project.id}`;

/**
 * The image the index card and the project header lead with.
 *
 * A conceptual project has no built photograph to lead with, so it falls back
 * to the first drawing. A project with neither renders the design's
 * "Renderings to come" panel instead, which is why this can return undefined.
 */
export const heroPicture = (project: Project) => project.data.hero ?? project.data.drawings[0];

/**
 * The index card's call to action. A built project invites you to see how;
 * one still on the drawing board says so rather than overpromising.
 */
export const indexCta = (project: Project) =>
  project.data.built.length > 0 ? 'See how it was built' : 'Design still in progress';

/** The previous and next project, wrapping at both ends. */
export function neighbours(projects: Project[], current: Project) {
  const i = projects.findIndex((p) => p.id === current.id);
  const count = projects.length;
  return {
    previous: projects[(i - 1 + count) % count],
    next: projects[(i + 1) % count],
  };
}

/**
 * A Google Drive preview player URL.
 *
 * Only for footage GMZ has no local copy of. See the note in
 * `src/content.config.ts`: these break silently if the Drive file stops being
 * link-shared, so a local file under `public/media/` is always preferable.
 */
export const driveEmbed = (id: string) => `https://drive.google.com/file/d/${id}/preview`;

/** A video under public/media. */
export const mediaSrc = (file: string) => `/media/${file}`;

/* ---------------------------------------------------------------------- */
/* Services                                                                */
/* ---------------------------------------------------------------------- */

/**
 * The three stages a project runs through. Most clients take all three; the
 * services page says so, because any one of them can be bought on its own.
 */
export const SERVICE_STAGES = [
  {
    stage: 'Stage one',
    title: 'Design',
    items: [
      'Site survey and levels',
      'Concept and massing studies',
      '3D renders',
      'Planting plans',
      'Hardscape and site layout',
    ],
  },
  {
    stage: 'Stage two',
    title: 'Construction',
    items: [
      'Retaining walls',
      'Paving, steps and masonry',
      'Drainage',
      'Irrigation',
      'Planting',
      'Fencing and gates',
    ],
  },
  {
    stage: 'Stage three',
    title: 'Care',
    items: [
      'Scheduled maintenance',
      'Irrigation adjustment',
      'Seasonal planting',
      'Establishment watering',
      'Repairs and replacements',
    ],
  },
] as const;

/** How a job actually proceeds, in four steps. */
export const PROCESS_STEPS = [
  {
    n: '1',
    name: 'The visit',
    note: 'About an hour on site, charged when you book. No drawing or quote at this stage.',
  },
  {
    n: '2',
    name: 'The drawings',
    note: 'Concepts, then a resolved plan you can hold the build against.',
  },
  {
    n: '3',
    name: 'The build',
    note: 'Our crews, our schedule, one point of contact throughout.',
  },
  {
    n: '4',
    name: 'After',
    note: 'Establishment care, then maintenance for as long as you want it.',
  },
] as const;

/* ---------------------------------------------------------------------- */
/* Walkthroughs                                                            */
/* ---------------------------------------------------------------------- */

/**
 * The walkthroughs page, in order.
 *
 * An entry either names a `project`, in which case the film comes from that
 * project's own `walkthrough` field, or carries its own `drive` id for footage
 * that has no project page behind it.
 *
 * `meta` is the one-line descriptor shown beside the name, and `note` is
 * optional: both live here rather than being derived from the project, because
 * the design words this page differently. Viewridge is the case that proves
 * it, adding a sentence about the terracing that the project page does not
 * carry. Omit `note` and the project's own wording is used.
 */
const WALKTHROUGH_INDEX: (
  | { name: string; meta: string; note: string; file: string }
  | { project: string; meta: string; note?: string }
)[] = [
  {
    name: 'Planting and garden management',
    meta: 'Planting · Ongoing garden management',
    note: 'Planting and garden management on this property, walked on video.',
    file: 'planting-garden-management.mp4',
  },
  {
    name: 'Garden walkthrough',
    meta: 'Built · Hardscape and planting',
    note: 'A walking video of the finished garden, recorded on completion.',
    file: 'garden-walkthrough.mp4',
  },
  {
    project: 'viewridge',
    meta: 'Built · Six retaining walls, steps and railings',
    // The design gives this page a fuller note than the project page carries.
    note: 'The whole garden walked end to end. The terracing reads on video in a way it does not in stills.',
  },
  { project: 'los-charros', meta: 'Built · Hardscape and planting' },
  { project: 'hamilton', meta: 'Built · Hardscape and planting' },
];

export interface Walkthrough {
  name: string;
  meta: string;
  note: string;
  /** A Drive embed URL, a local file URL, or neither when footage is pending. */
  drive?: string;
  file?: string;
  /** Set when this film belongs to a project page. */
  href?: string;
}

/**
 * Resolves the walkthrough index against the project collection.
 *
 * A project entry named here that has no walkthrough is a content mistake, so
 * it throws rather than quietly disappearing from the page.
 */
export async function getWalkthroughs(): Promise<Walkthrough[]> {
  const projects = await getProjects();

  return WALKTHROUGH_INDEX.map((entry) => {
    if (!('project' in entry)) {
      return { name: entry.name, meta: entry.meta, note: entry.note, file: entry.file };
    }

    const project = projects.find((p) => p.id === entry.project);
    if (!project) {
      throw new Error(
        `Walkthrough index names project "${entry.project}", which is not in ` +
          `src/content/portfolio/. Fix the id or drop the entry.`,
      );
    }

    const walkthrough = project.data.walkthrough;
    if (!walkthrough) {
      throw new Error(
        `Walkthrough index names project "${entry.project}", but that project ` +
          `has no walkthrough field. Add one or drop the entry.`,
      );
    }

    return {
      name: project.data.name,
      meta: entry.meta,
      // An entry may word the film differently here than on the project page.
      note: entry.note ?? walkthrough.note,
      drive: walkthrough.drive,
      file: walkthrough.file,
      href: projectHref(project),
    };
  });
}

/* ---------------------------------------------------------------------- */
/* Contact form                                                            */
/* ---------------------------------------------------------------------- */

/**
 * Where the consultation request is posted.
 *
 * Netlify Forms picks the form up from its `data-netlify` attribute at deploy
 * time and needs no endpoint here, so the form is live by default rather than
 * hidden behind an unset variable. Set PUBLIC_CONTACT_ENDPOINT to post
 * somewhere else instead: Formspree, a Worker, whatever the host suits.
 *
 * Whichever it is, send a real submission and confirm it arrives before
 * shipping. A form that silently drops a lead is worse than no form.
 */
export const formEndpoint = import.meta.env.PUBLIC_CONTACT_ENDPOINT ?? '';
