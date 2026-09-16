import designGarden from '../assets/portfolio/menlo-oaks/menlo-oaks-p3.webp';
import outdoorRoom from '../assets/portfolio/marlowe/marlowe-hero.webp';
import stoneSteps from '../assets/portfolio/fox-hill/foxhill-stair-full.webp';
import establishedGarden from '../assets/portfolio/los-charros/loscharros-slope-after.webp';
import terracedGarden from '../assets/portfolio/viewridge/viewridge-aerial-full.webp';
import hillsborough from '../assets/portfolio-preview/hillsborough.webp';
import menlo from '../assets/portfolio-preview/menlo.webp';
import woodside from '../assets/portfolio-preview/woodside.webp';

/**
 * Anonymous, public-safe selections from GMZ's portfolio. The public site
 * shows the kind of work we do without identifying an individual home.
 */
export const publicWorkTeasers = [
  {
    image: outdoorRoom,
    alt: 'Outdoor dining table beside a built-in barbecue and white timber pergola.',
    label: 'Outdoor rooms',
    text: 'Places to cook, gather and stay outside after the workday ends.',
  },
  {
    image: stoneSteps,
    alt: 'Wide stone stair with low retaining walls leading through planted slopes.',
    label: 'Hardscape and grade',
    text: 'Steps, walls and drainage resolved as one piece of ground.',
  },
  {
    image: establishedGarden,
    alt: 'Layered drought-tolerant garden looking toward wooded hills.',
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
    caption: 'Care keeps a garden growing into the intention behind the plan.',
  },
} as const;

export const processVisuals = [
  { image: terracedGarden, alt: 'Aerial view of a terraced garden and curved path.', label: 'Read the ground' },
  { image: designGarden, alt: 'Landscape rendering of an outdoor kitchen and dining garden.', label: 'Resolve the plan' },
  { image: stoneSteps, alt: 'Stone stair and retaining walls in a completed garden.', label: 'Build in sequence' },
  { image: establishedGarden, alt: 'Established planting in a drought-tolerant garden.', label: 'Care as it grows' },
] as const;

export const aboutVisuals = [
  { image: hillsborough, alt: 'Formal garden planting and a stone path at a Peninsula home.' },
  { image: menlo, alt: 'A planted garden arranged around an outdoor living area.' },
  { image: woodside, alt: 'Layered hillside planting beneath mature trees.' },
] as const;
