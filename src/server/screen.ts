/**
 * What every portal screen does before it renders.
 *
 * The middleware has already put the signed-in client on `locals`. A screen
 * then needs three things: that this client is the right kind for the
 * screen (a garden client has no proposal), the record itself, and a way to
 * fail honestly when the record cannot be read. This is those three things
 * once, so a page reads:
 *
 *   const screen = await gardenScreen(Astro);
 *   if (screen instanceof Response) return screen;
 *   const { client, garden } = screen;
 *
 * A wrong-kind client is sent to their own landing. A client with no record
 * yet is sent to the landing too, which is the one screen that can render
 * without one and says the record is being prepared. A record that will not
 * parse is logged with what was wrong and the screen becomes the
 * "unavailable" page, with the phone number, rather than a stack trace.
 */
import type { AstroGlobal } from 'astro';
import { routes } from '@data/portal/routes';
import type { GardenRecord, Plant, ProjectRecord } from '@data/portal/shapes';
import { landingFor, type PortalClient } from './auth';
import { RecordUnreadable, loadGarden, loadPlants, loadProject } from './records';

type Astro = Pick<AstroGlobal, 'locals' | 'redirect' | 'rewrite'>;

function unavailable(astro: Astro, cause: unknown): Response | Promise<Response> {
  console.error(cause instanceof Error ? cause.message : String(cause));
  return astro.rewrite(routes.unavailable);
}

export interface GardenScreen {
  client: PortalClient;
  garden: GardenRecord;
  plants: Plant[];
}

/**
 * The garden client's record and plants. `allowMissing` lets the landing
 * render for a client whose record is not written yet; every other screen
 * sends them there.
 */
export async function gardenScreen(
  astro: Astro,
  options: { allowMissing?: false },
): Promise<GardenScreen | Response>;
export async function gardenScreen(
  astro: Astro,
  options: { allowMissing: true },
): Promise<(Omit<GardenScreen, 'garden'> & { garden: GardenRecord | null }) | Response>;
export async function gardenScreen(
  astro: Astro,
  options: { allowMissing?: boolean } = {},
): Promise<(Omit<GardenScreen, 'garden'> & { garden: GardenRecord | null }) | Response> {
  const client = astro.locals.client;
  if (!client) return astro.redirect(routes.signIn, 302);
  if (client.kind !== 'garden') return astro.redirect(landingFor(client), 302);
  try {
    const [garden, plants] = await Promise.all([loadGarden(client), loadPlants(client)]);
    if (!garden && !options.allowMissing) return astro.redirect(routes.garden, 302);
    return { client, garden, plants };
  } catch (cause) {
    if (cause instanceof RecordUnreadable) return unavailable(astro, cause);
    throw cause;
  }
}

export interface ProjectScreen {
  client: PortalClient;
  project: ProjectRecord;
}

export async function projectScreen(
  astro: Astro,
  options: { allowMissing?: false },
): Promise<ProjectScreen | Response>;
export async function projectScreen(
  astro: Astro,
  options: { allowMissing: true },
): Promise<(Omit<ProjectScreen, 'project'> & { project: ProjectRecord | null }) | Response>;
export async function projectScreen(
  astro: Astro,
  options: { allowMissing?: boolean } = {},
): Promise<(Omit<ProjectScreen, 'project'> & { project: ProjectRecord | null }) | Response> {
  const client = astro.locals.client;
  if (!client) return astro.redirect(routes.signIn, 302);
  if (client.kind !== 'project') return astro.redirect(landingFor(client), 302);
  try {
    const project = await loadProject(client);
    if (!project && !options.allowMissing) return astro.redirect(routes.project, 302);
    return { client, project };
  } catch (cause) {
    if (cause instanceof RecordUnreadable) return unavailable(astro, cause);
    throw cause;
  }
}

/** A form field as a trimmed string, never longer than `max`. */
export const field = (form: FormData, name: string, max = 4000): string =>
  String(form.get(name) ?? '')
    .trim()
    .slice(0, max);

/** The files in a multi-file field, ignoring the empty entry a blank input sends. */
export const files = (form: FormData, name: string): File[] =>
  form.getAll(name).filter((entry): entry is File => entry instanceof File && entry.size > 0);

/**
 * "Extra work" from "extra-work": a choice comes back as its slug, and the
 * record is asked which label that was. An unknown slug is the first choice,
 * which is what the form had checked by default.
 */
export const chosen = (options: readonly string[], slug: string): string =>
  options.find((option) => toSlug(option) === slug) ?? options[0] ?? '';

export const toSlug = (label: string) => label.toLowerCase().replace(/\s+/g, '-');
