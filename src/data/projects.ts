import { getCollection, type CollectionEntry } from 'astro:content';
import { DISCIPLINES, SERVICE_LINES } from '../content.config';

export type Project = CollectionEntry<'projects'>;

/**
 * The public work. Nothing here reads the `portfolio` collection, and nothing
 * should: that collection is indexed by street name and sits behind the veil.
 * A public project is identified by town, which the schema enforces.
 *
 * Drafts are visible while developing and never in a build, the same gate the
 * services and the articles use.
 */
const isDev = import.meta.env.DEV;

const publishable = (entry: Project) => isDev || !entry.data.draft;

/** Every publishable project, most recently completed first. */
export async function getPublishedProjects(): Promise<Project[]> {
  const projects = await getCollection('projects', publishable);
  return projects.sort((a, b) => b.data.completed.getTime() - a.data.completed.getTime());
}

/**
 * The handful marked for the homepage, in the order their `order` field sets,
 * newest first among equals.
 */
export async function getFeaturedProjects(): Promise<Project[]> {
  const projects = await getPublishedProjects();
  return projects
    .filter((project) => project.data.featured)
    .sort((a, b) => a.data.order - b.data.order);
}

export const projectHref = (project: Project) => `/work/${project.id}`;

/** "March 2026". Written out so it cannot read as a day of the month. */
export const formatCompleted = (date: Date) =>
  date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/** The service line as a reader sees it, rather than as the schema keys it. */
const SERVICE_LINE_LABELS: Record<(typeof SERVICE_LINES)[number], string> = {
  'design-build': 'Design and build',
  maintenance: 'Maintenance',
};

export const serviceLineLabel = (line: (typeof SERVICE_LINES)[number]) => SERVICE_LINE_LABELS[line];

/** A discipline key with its first letter up, for a facts row or a card. */
export const disciplineLabel = (discipline: (typeof DISCIPLINES)[number]) =>
  discipline.charAt(0).toUpperCase() + discipline.slice(1);
