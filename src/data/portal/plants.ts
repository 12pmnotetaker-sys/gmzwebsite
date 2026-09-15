import { getCollection, type CollectionEntry } from 'astro:content';
import { routes } from './routes';

export type Plant = CollectionEntry<'plants'>;

/** Every plant on record, flagged ones first, in the order the record sets. */
export async function getPlants(): Promise<Plant[]> {
  const plants = await getCollection('plants');
  return plants.sort((a, b) => a.data.order - b.data.order);
}

/** The short list on the garden landing: the ones marked for it. */
export async function getLandingPlants(): Promise<Plant[]> {
  return (await getPlants()).filter((plant) => plant.data.onLanding);
}

/** The plants the crew has flagged for a decision. */
export function flaggedPlants(plants: Plant[]): Plant[] {
  return plants.filter((plant) => Boolean(plant.data.flag));
}

export const plantHref = (plant: Plant) => routes.plant(plant.id);
