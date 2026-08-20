import { getCollection, type CollectionEntry } from 'astro:content';

export type Review = CollectionEntry<'reviews'>;

/**
 * Approved reviews only, newest first.
 *
 * There is no development bypass here, unlike drafts elsewhere. A review is
 * someone else's words, and the cost of one appearing before they agreed is
 * not a broken build, it is a person finding themselves quoted on a marketing
 * page. So the gate holds in every environment.
 */
export async function getApprovedReviews(): Promise<Review[]> {
  const reviews = await getCollection('reviews', (entry) => entry.data.approved);
  return reviews.sort(
    (a, b) =>
      Number(b.data.featured) - Number(a.data.featured) ||
      b.data.reviewed.getTime() - a.data.reviewed.getTime(),
  );
}

export const formatReviewed = (date: Date) =>
  date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
