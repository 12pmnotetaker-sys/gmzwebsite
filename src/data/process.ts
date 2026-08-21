/**
 * How a job actually runs.
 *
 * Source: "GMZ Landscape Information: Working Document", which sets out a
 * twelve step design process and a ten step construction process. Those two
 * lists overlap: design steps eight through twelve ARE the construction
 * process, so publishing both in full would describe the same work twice and
 * make a job look longer than it is. Deduplicated they come to seventeen
 * steps, grouped here under the four the client actually experiences.
 *
 * The wording is rewritten rather than pasted. The source is written in the
 * register the brand manual's own avoid list warns against, and no step here
 * states a duration: a published lead time is a promise a client will hold GMZ
 * to, and nobody has decided one.
 */

export interface ProcessStep {
  name: string;
  what: string;
}

export interface ProcessPhase {
  /** What the client calls this part of the job. */
  name: string;
  /** One line on what the phase is for. */
  purpose: string;
  steps: ProcessStep[];
}

export const processPhases: ProcessPhase[] = [
  {
    name: 'The visit',
    purpose: 'Finding out what you want and what the ground will allow.',
    steps: [
      {
        name: 'Consultation',
        what: 'An hour on the property, listening to what you want from it and looking at what is already there.',
      },
      {
        name: 'Site analysis',
        what: 'Dimensions, existing planting, soil, drainage and the fall of the land, recorded properly rather than remembered.',
      },
    ],
  },
  {
    name: 'The drawings',
    purpose: 'Deciding everything on paper, where changing your mind is free.',
    steps: [
      {
        name: 'Design brief',
        what: 'What the project has to do, written down, so there is something to check the design against later.',
      },
      {
        name: 'Concept design',
        what: 'Sketches, a layout and a first pass at planting and materials, shown to you for a reaction rather than approval.',
      },
      {
        name: 'Design development',
        what: 'The plan resolved: specific planting, hardscape, lighting, water and any outdoor living space.',
      },
      {
        name: 'Design presentation',
        what: 'The finished drawings with costs against them, and a plain account of what building it will involve.',
      },
      {
        name: 'Approval and permits',
        what: 'Permits and approvals obtained where the town requires them, which on the Peninsula is more often than people expect.',
      },
    ],
  },
  {
    name: 'The build',
    purpose: 'Building what the drawings say, in the order that makes it last.',
    steps: [
      {
        name: 'Pre-construction meeting',
        what: 'Scope, sequence and budget walked through before anyone digs, so surprises happen here rather than later.',
      },
      {
        name: 'Site preparation',
        what: 'Clearing, grading and drainage. The part nobody photographs and everything else depends on.',
      },
      {
        name: 'Hardscape',
        what: 'Patios, walkways, retaining walls and structures go in first, because planting around them is easier than the reverse.',
      },
      {
        name: 'Planting and softscape',
        what: 'Trees, shrubs and beds, placed for the light, the soil and how the garden will look in ten years.',
      },
      {
        name: 'Irrigation and lighting',
        what: 'Watering laid out by hydrozone so the thirsty and the drought-tolerant are not on the same valve, and lighting where it earns its place.',
      },
      {
        name: 'Outdoor living',
        what: 'Decks, pergolas, fire pits and outdoor kitchens, where the project calls for them.',
      },
      {
        name: 'Final touches',
        what: 'Mulch, gravel and stone, then the site cleaned and the debris taken away.',
      },
    ],
  },
  {
    name: 'After',
    purpose: 'Handing it over, and coming back.',
    steps: [
      {
        name: 'Final walkthrough',
        what: 'Walked with you, checked against the drawings, with anything outstanding written down rather than agreed verbally.',
      },
      {
        name: 'Handover',
        what: 'What the garden needs and when, so the plants stand a chance in their first year.',
      },
      {
        name: 'Ongoing maintenance',
        what: 'The same company coming back to look after it, if you want that. A garden is not finished when the crew leaves.',
      },
    ],
  },
];

/** Seventeen steps once the two source lists stop describing the same work twice. */
export const totalSteps = processPhases.reduce((n, phase) => n + phase.steps.length, 0);
