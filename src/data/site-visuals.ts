import designGarden from '../assets/portfolio/menlo-oaks/menlo-oaks-p3.webp';
import outdoorRoom from '../assets/portfolio/marlowe/marlowe-hero.webp';
import stoneSteps from '../assets/portfolio/fox-hill/foxhill-stair-full.webp';
import establishedGarden from '../assets/portfolio/los-charros/loscharros-slope-after.webp';
import terracedGarden from '../assets/portfolio/viewridge/viewridge-aerial-full.webp';

/**
 * Public-facing examples selected from the portfolio. These stay deliberately
 * anonymous: the public site demonstrates the work without identifying a
 * client's address or turning a project image into a locator.
 */
export const publicWorkTeasers = [
  {
    image: outdoorRoom,
    alt: 'Outdoor dining table beside a built-in barbecue and a white timber pergola.',
    label: 'Outdoor rooms',
    text: 'Places to cook, gather and stay outside after the workday ends.',
  },
  {
    image: stoneSteps,
    alt: 'A wide stone stair with low retaining walls leading through newly planted slopes.',
    label: 'Hardscape and grade',
    text: 'Steps, walls and drainage resolved as one piece of ground.',
  },
  {
    image: establishedGarden,
    alt: 'A layered drought-tolerant garden looking toward wooded hills.',
    label: 'Planting that settles in',
    text: 'Gardens built for the light, water and seasons they actually have.',
  },
] as const;

export const serviceVisuals = {
  'landscape-design': {
    image: designGarden,
    alt: 'Landscape rendering showing a dining terrace, outdoor kitchen, planting and play area under mature trees.',
    caption: 'A design study brings planting, use and construction decisions into one view.',
  },
  'landscape-construction': {
    image: stoneSteps,
    alt: 'Finished stone steps, retaining walls and planting climbing a landscaped slope.',
    caption: 'Grade, hardscape and planting meet on site after the plan is resolved.',
  },
  'landscape-maintenance': {
    image: establishedGarden,
    alt: 'Established drought-tolerant planting layered along a garden path.',
    caption: 'Care keeps a new garden growing into the intention behind the plan.',
  },
} as const;

export const processVisuals = [
  {
    image: terracedGarden,
    alt: 'Aerial view of a terraced garden and curved path.',
    label: 'Read the ground',
  },
  {
    image: designGarden,
    alt: 'Landscape rendering of an outdoor kitchen and dining garden.',
    label: 'Resolve the plan',
  },
  {
    image: stoneSteps,
    alt: 'Stone stair and retaining walls under construction landscaping.',
    label: 'Build in sequence',
  },
  {
    image: establishedGarden,
    alt: 'Established planting in a drought-tolerant garden.',
    label: 'Care as it grows',
  },
] as const;

export const aboutVisual = {
  image: establishedGarden,
  alt: 'Established drought-tolerant planting along a garden path.',
};
