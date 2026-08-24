/**
 * The shape of an intake submission.
 *
 * This file is the only place the form's fields are described. The markup in
 * `EnquiryForm.astro` builds itself from these lists and `api/enquiry.ts`
 * validates against the same ones, so a renamed option cannot pass the browser
 * and fail the server, or the other way round. One fact, one home applies to
 * the shape of a form as much as to a phone number.
 *
 * Deliberately dependency-free and free of path aliases: the Vercel function
 * lives outside `src/` and is bundled by Vercel rather than by Astro, so it
 * can only import a plain relative module.
 *
 * Nothing here is a price GMZ charges. The budget question asks what a client
 * intends to spend, which discloses nothing about GMZ's cost structure; see
 * the note on `budgetBands`.
 */

/** A select option. `value` is what is stored; `label` is what is read. */
export interface Choice {
  value: string;
  label: string;
}

export const propertyTypes: Choice[] = [
  { value: 'house', label: 'A house' },
  { value: 'townhouse', label: 'A townhouse or condominium' },
  { value: 'estate', label: 'A larger property with several areas' },
  { value: 'commercial', label: 'Commercial or multi-unit' },
];

export const projectTypes: Choice[] = [
  { value: 'new-garden', label: 'A new garden, or a full rebuild' },
  { value: 'part-garden', label: 'One part of the garden' },
  { value: 'hardscape', label: 'Paving, walls, steps or a patio' },
  { value: 'water', label: 'Irrigation or drainage' },
  { value: 'planting', label: 'Planting, replanting or lawn replacement' },
  { value: 'maintenance', label: 'Looking after a garden that already exists' },
  { value: 'unsure', label: 'Not sure yet' },
];

export const timelines: Choice[] = [
  { value: 'now', label: 'As soon as you can' },
  { value: 'three-months', label: 'Within about three months' },
  { value: 'this-year', label: 'Later this year' },
  { value: 'next-year', label: 'Next year' },
  { value: 'exploring', label: 'Still working out whether to do it' },
];

/**
 * What the client intends to spend.
 *
 * The plan called this the strongest qualifier available, and it is: it is the
 * fastest way to tell a prospect early that GMZ is or is not the right fit,
 * which is kinder than telling them after a visit they paid for.
 *
 * The boundaries are the one thing on this form GMZ has not confirmed. They
 * state no GMZ policy and commit nobody to anything, but the lowest band does
 * signal where GMZ expects to start, so they are worth a deliberate look. The
 * lowest band is open downward and "still working it out" is offered, so
 * nothing here reads as a minimum GMZ will not go below.
 */
export const budgetBands: Choice[] = [
  { value: 'under-25', label: 'Under $25,000' },
  { value: '25-50', label: '$25,000 to $50,000' },
  { value: '50-100', label: '$50,000 to $100,000' },
  { value: '100-250', label: '$100,000 to $250,000' },
  { value: 'over-250', label: 'Over $250,000' },
  { value: 'unsure', label: 'Still working it out' },
];

export const heardVia: Choice[] = [
  { value: 'search', label: 'A search' },
  { value: 'referral', label: 'A neighbour, friend or family member' },
  { value: 'crew', label: 'Saw a GMZ crew working' },
  { value: 'designer', label: 'A designer, architect or builder' },
  { value: 'social', label: 'Instagram or Facebook' },
  { value: 'returning', label: 'Worked with GMZ before' },
  { value: 'other', label: 'Somewhere else' },
];

/**
 * Field length ceilings, enforced on both sides.
 *
 * These are generous for a person and mean for a script. The point is not to
 * police wording; it is that an unbounded field is an unbounded email and an
 * unbounded database row.
 */
export const limits = {
  name: 120,
  email: 200,
  phone: 40,
  town: 80,
  address: 200,
  description: 4000,
} as const;

/** A validated submission, as the endpoint stores and sends it. */
export interface Enquiry {
  name: string;
  email: string;
  phone: string;
  town: string;
  propertyType: string;
  projectType: string;
  timeline: string;
  budget: string;
  heardVia: string;
  description: string;
  portfolio: boolean;
}

/**
 * The hidden field a script fills in and a person never sees.
 *
 * Named for something a bot wants to complete rather than something that
 * announces itself as a trap. A submission carrying any value here is dropped
 * silently, with a 200, because telling a spammer why they failed is how they
 * learn to pass.
 */
export const honeypotField = 'company_website';

/**
 * Validate a submission. Returns the cleaned enquiry, or the reasons it was
 * rejected keyed by field so the form can put each message beside its input.
 *
 * Shared by the browser and the function on purpose. A check that runs only in
 * the browser is a suggestion.
 */
export function validate(
  input: Record<string, unknown>,
): { ok: true; enquiry: Enquiry } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const text = (key: string, max: number) =>
    typeof input[key] === 'string' ? (input[key] as string).trim().slice(0, max) : '';

  const name = text('name', limits.name);
  const email = text('email', limits.email);
  const phone = text('phone', limits.phone);
  const town = text('town', limits.town);
  const description = text('description', limits.description);

  if (name.length < 2) errors.name = 'Please give a name we can use.';

  /*
   * Either route back is enough, and requiring both loses people who have a
   * strong preference about which one they hand over. What cannot happen is
   * neither: an enquiry nobody can answer is worse than no enquiry, because
   * it looks answered.
   */
  const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const hasPhone = phone.replace(/\D/g, '').length >= 10;
  if (!hasEmail && !hasPhone) {
    errors.email = 'Please leave either an email address or a phone number.';
  } else {
    if (email && !hasEmail) errors.email = 'That email address does not look complete.';
    if (phone && !hasPhone) errors.phone = 'That phone number looks too short.';
  }

  if (town.length < 2) errors.town = 'Which town is the property in?';
  if (description.length < 10) {
    errors.description = 'A sentence or two about the property helps more than anything else here.';
  }

  const choice = (key: string, list: Choice[], required: boolean) => {
    const value = text(key, 60);
    if (!value) {
      if (required) errors[key] = 'Please choose one.';
      return '';
    }
    if (!list.some((option) => option.value === value)) {
      errors[key] = 'Please choose one of the options offered.';
      return '';
    }
    return value;
  };

  const propertyType = choice('propertyType', propertyTypes, true);
  const projectType = choice('projectType', projectTypes, true);
  const timeline = choice('timeline', timelines, true);
  const budget = choice('budget', budgetBands, false);
  const via = choice('heardVia', heardVia, false);

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    enquiry: {
      name,
      email,
      phone,
      town,
      propertyType,
      projectType,
      timeline,
      budget,
      heardVia: via,
      description,
      portfolio: input.portfolio === true || input.portfolio === 'on',
    },
  };
}

/** Turn a stored value back into the words the client actually chose. */
export function labelFor(list: Choice[], value: string): string {
  return list.find((option) => option.value === value)?.label ?? value;
}
