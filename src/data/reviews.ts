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

/**
 * The approved reviews for one project, newest first.
 *
 * The link between the two lives on the review and only there. A project could
 * have carried a field naming its own pull-quote, and for a while the schema
 * said it did, pointing at a collection that did not exist. Modelling it once,
 * from the side that already has `project`, means the two can never disagree
 * about which review belongs to which job.
 *
 * Approval still gates it, through `getApprovedReviews`: a review reaching a
 * project page is the same publication as a review reaching /reviews.
 */
export async function getReviewsForProject(projectId: string): Promise<Review[]> {
  const reviews = await getApprovedReviews();
  return reviews.filter((review) => review.data.project?.id === projectId);
}

export const formatReviewed = (date: Date) =>
  date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
