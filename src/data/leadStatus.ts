/**
 * Lead status values for the admin panel.
 *
 * Shared between the `/admin/leads` page and `api/admin/leads.ts`, the same
 * way `enquiry.ts`'s option lists are shared between the intake form and its
 * endpoint: one list, so a renamed status cannot be accepted by the page and
 * rejected by the server, or the other way round.
 *
 * Dependency-free and free of path aliases: `api/admin/leads.ts` is a Vercel
 * Function outside `src/`, bundled by Vercel rather than by Astro, so it can
 * only import a plain relative module.
 */

export interface StatusOption {
  value: string;
  label: string;
}

export const leadStatuses: StatusOption[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

export const defaultLeadStatus = 'new';

/** Turn a stored status back into the word a person reads. */
export function statusLabel(value: string): string {
  return leadStatuses.find((option) => option.value === value)?.label ?? value;
}
