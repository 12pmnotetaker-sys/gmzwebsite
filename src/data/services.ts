import { getCollection, type CollectionEntry } from 'astro:content';

export type Service = CollectionEntry<'services'>;

/**
 * The three service lines, in the order GMZ describes them: design, then
 * construction, then maintenance. Drafts are visible while developing and
 * never in a build, the same gate the rest of the content uses.
 */
const isDev = import.meta.env.DEV;

export async function getServices(): Promise<Service[]> {
  const services = await getCollection('services', (entry) => isDev || !entry.data.draft);
  return services.sort((a, b) => a.data.order - b.data.order);
}

export const serviceHref = (service: Service) => `/services/${service.id}`;
