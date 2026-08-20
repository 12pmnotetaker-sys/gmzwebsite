import { getCollection, type CollectionEntry } from 'astro:content';

export type Town = CollectionEntry<'towns'>;

/**
 * Published towns only, in the order the service area lists them.
 *
 * No development bypass. A town page that ships before its local rules have
 * been read from the town's own documents is the thin-content version of this
 * idea, and the whole point of the collection is not to build that.
 */
export async function getPublishedTowns(): Promise<Town[]> {
  const towns = await getCollection('towns', (entry) => entry.data.published);
  return towns.sort((a, b) => a.data.order - b.data.order);
}

export const townHref = (town: Town) => `/where-we-work/${town.id}`;
