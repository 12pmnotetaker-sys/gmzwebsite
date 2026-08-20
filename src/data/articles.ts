import { getCollection, type CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'articles'>;

/**
 * Drafts are visible while developing and never in a build, which is the same
 * gate the FAQ answers and the testimonials use. An article states something a
 * client may act on, so an unfinished one must not be reachable in production.
 */
const isDev = import.meta.env.DEV;

export async function getPublishedArticles(): Promise<Article[]> {
  const articles = await getCollection('articles', (entry) => isDev || entry.data.published);
  return articles.sort((a, b) => a.data.order - b.data.order);
}

/** Written out rather than left to the reader's locale, so it cannot surprise. */
export const formatUpdated = (date: Date) =>
  date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
