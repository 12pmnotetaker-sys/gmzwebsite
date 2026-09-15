/**
 * The project client: Heron, Menlo Park. A backyard rebuild with a proposal
 * waiting.
 *
 * Copy rules that bite hardest on this file:
 *
 *  - Scope is described in shape, never in figures. "About four weeks on
 *    site" is fine; crew-days, rates and margin never appear.
 *  - No product or manufacturer names. "A smart controller", never a model.
 *  - "Deposit" is the correct word. It is the statutory term, capped at the
 *    lesser of $1,000 or 10% of the contract, and the cap is said out loud.
 *  - Draws are dollars and cents, one row per milestone, each naming what
 *    triggers it. Never percentages.
 *  - Nothing is credited toward a later stage. Do not write "credited toward
 *    construction".
 *  - Never label this "design/build" to the client. They have a project.
 */

export interface LineItem {
  label: string;
  amount: string;
  /** Set on the one line held as an allowance, which must say so on screen. */
  allowance?: boolean;
}

export interface Draw {
  label: string;
  amount: string;
  /** What triggers the payment. Required on every row by law and by decency. */
  trigger: string;
}

export const client = {
  name: 'Heron',
  property: 'Menlo Park',
  town: 'Menlo Park',
  kicker: 'Heron, backyard rebuild',
  projectName: 'Backyard rebuild',
} as const;

export const proposal = {
  estimateNo: '00000485',
  total: '$8,760.00',
  /** The line on the landing, above the two buttons. */
  summary: 'A firm price for the work below, with one line held as an allowance.',
  priceLine: '$8,760.00, firm except the allowance',
  scope:
    'A full backyard rebuild, about four weeks on site. We work in one stretch rather than in visits, and the yard is unusable for most of it.',
  /** The scope in client language, one claim per line. */
  scopeLines: [
    'The failing lawn and the cracked patio come out and are hauled away.',
    'The ground is regraded so water runs to the side yard instead of toward the house.',
    'Drip lines to the beds and a smart controller, on its own zones, so the new planting can be watered differently from the lawn area.',
    'Soil prepared, then planting: a small tree, shrubs, perennials and grasses, with mulch over the beds.',
    'Two garden lights on the path, wired to the existing outdoor outlet.',
  ],
  lines: [
    { label: 'Site preparation', amount: '$2,140.00' },
    { label: 'Irrigation', amount: '$1,880.00' },
    { label: 'Planting', amount: '$2,000.00', allowance: true },
    { label: 'Everything else', amount: '$2,740.00' },
  ] satisfies LineItem[],
  /**
   * The allowance callout. The brief calls this the single most important
   * detail on the canvas: the number will move, and the screen has to say
   * both that it will and what happens when it does.
   */
  allowance: {
    kicker: 'Allowance, and what happens to it',
    why: 'Planting is an allowance, not a firm price, because the plants are chosen with you at the nursery. We hold $2,000.00 for plants and soil.',
    effect:
      'If what you choose comes to less, the difference comes off the final payment. If it comes to more, we write it up as a change, show you the new amount and the new payment schedule, and wait for your approval before we buy anything.',
    /** The shorter form, on the landing screen. */
    short:
      'We hold $2,000.00 for plants and soil. If what you choose comes to less, you pay less. If it comes to more, we price the difference and you approve it in writing before we buy anything.',
    kickerShort: 'The planting line will move',
  },
  draws: [
    {
      label: 'Deposit',
      amount: '$876.00',
      trigger:
        'Due when you sign the contract. This is the legal maximum, the lesser of $1,000 or a tenth of the contract.',
    },
    {
      label: 'First payment',
      amount: '$2,140.00',
      trigger:
        'When the old lawn and patio are gone, the debris is hauled, and the regrading is done and walked with you.',
    },
    {
      label: 'Second payment',
      amount: '$1,880.00',
      trigger:
        'When the irrigation is in, pressure tested, and every zone has run in front of you.',
    },
    {
      label: 'Third payment',
      amount: '$2,000.00',
      trigger:
        'When the planting and mulching are complete. This row moves with the planting allowance, up or down, and only after you approve the new amount.',
    },
    {
      label: 'Final payment',
      amount: '$1,864.00',
      trigger:
        'After the walkthrough, when the list of small corrections is closed and you tell us the work is complete.',
    },
  ] satisfies Draw[],
  drawsHeadline: 'Five payments, each with something to see',
  drawsNote:
    'Nothing is billed ahead of the work it pays for. Nothing paid earlier is credited to a later stage.',
  notices: {
    kicker: 'Notices that come with the contract',
    body: 'Your right to cancel, the lien warning, and the cancellation form.',
    /**
     * These render as the PDF that goes on file, not as reflowed HTML. The
     * wording is statutory: what the client reads has to be the document,
     * page for page.
     */
    designNote:
      'These pages render as the PDF that goes on file, not as reflowed HTML. The wording is statutory: what the client reads has to be the document, page for page.',
  },
} as const;

/** The approval step. Intent to proceed, with the signature step still ahead. */
export const approval = {
  kicker: 'Review and approve',
  headline: 'What you are agreeing to',
  lines: [
    { label: 'The work as described', amount: '$8,760.00' },
    { label: 'Planting, held as an allowance', amount: '$2,000.00' },
    { label: 'Deposit, due on signing', amount: '$876.00' },
  ] satisfies LineItem[],
  body: 'This records that you want to proceed. The contract comes by email for signature, and no money is due until you have signed it.',
  signerPlaceholder: 'Julia Heron',
} as const;

/** Approved. Calm, not celebratory. No confetti. */
export const approved = {
  answer: 'Approved',
  recorded: 'Recorded Tuesday 1 September, 9:42 in the morning, by Julia Heron.',
  next: [
    {
      when: 'Today, Tuesday 1 September',
      what: 'The contract and the notices go to your email for signature.',
    },
    {
      when: 'By Friday 4 September',
      what: 'Signed contract back to us, and the deposit of $876.00 is due then.',
    },
    {
      when: 'Week of 7 September',
      what: 'We walk the yard with you, mark the beds, and choose the plants together.',
    },
    {
      when: 'Monday 14 September',
      what: 'Work starts, about four weeks on site. We will tell you the day before anything noisy.',
    },
  ],
} as const;

/**
 * The change order.
 *
 * Three fields have to show: the scope of the change, the amount added or
 * subtracted, and the effect on the payment schedule. That third field is
 * required by California law and no competitor product shows it, which is why
 * it gets the amber panel rather than a footnote.
 */
export const changeOrder = {
  kicker: 'Change order 1, estimate 00000485',
  title: 'A second hose bib and a wider gate',
  scope:
    'A second outdoor tap on the far side of the yard, tapped off the line we already opened, and the side gate rebuilt four inches wider so a wheelbarrow fits through without scraping the post.',
  amount: 'Plus $640.00',
  amountNote:
    'Contract total goes from $8,760.00 to $9,400.00. Two days added on site; the start date does not move.',
  amountNoteShort: 'Contract total goes from $8,760.00 to $9,400.00.',
  schedule: {
    kicker: 'Effect on your payment schedule',
    rows: [
      { label: 'Second payment', value: '$1,880.00 to $2,520.00', changed: true },
      { label: 'Third payment', value: 'Unchanged, $2,000.00', changed: false },
      { label: 'Final payment', value: 'Unchanged, $1,864.00', changed: false },
    ],
    note: 'The deposit does not change and nothing new is due today. The tap and the gate are both paid on the second payment, when the irrigation is tested.',
  },
  disclaimer: 'Nothing on this change is ordered or built until you approve it.',
} as const;

/**
 * The stage bar.
 *
 * Twelve segments for a project. The current one is thicker rather than a
 * different colour so it survives a screenshot or a print, and the stages are
 * named in the line underneath rather than scored with a percentage.
 */
export const projectStages = {
  total: 12,
  atProposal: { done: 2, now: 3, caption: 'Now: your approval. Next: contract and signature.' },
  atApproved: {
    done: 3,
    now: 4,
    caption: 'Now: contract and signature. Next: materials and the start date.',
  },
} as const;
