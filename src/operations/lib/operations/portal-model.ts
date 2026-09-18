import { z } from 'zod';
import { stateSchema, type State } from './model.ts';
export function hydratePortal(snapshot: any) {
  if (!snapshot.workspace) return null;
  const state = stateSchema.parse(snapshot.workspace.state);
  for (const c of snapshot.clients) {
    const local = state.clients.find((x) => x.id === c.localId);
    if (local) {
      local.name = c.name;
      local.email = c.email;
    }
  }
  for (const p of snapshot.properties) {
    const at = state.properties.findIndex((x) => x.id === p.id);
    if (at < 0) continue;
    const local = { ...p.data };
    if (p.primary && p.legacy) {
      Object.assign(local, {
        address: p.legacy.address,
        city: p.legacy.town,
        truck: p.legacy.truck,
        budgetMinutes: p.legacy.budget_minutes,
        monthly: p.legacy.monthly === null ? null : Number(p.legacy.monthly),
        internal: p.legacy.internal,
        notes: p.legacy.notes,
      });
    }
    state.properties[at] = local;
  }
  return {
    state: stateSchema.parse(state),
    version: Number(snapshot.workspace.version),
    fingerprint: snapshot.fingerprint,
    connected: true,
  };
}
export function publication(
  state: State,
  visitId: string,
  clientId: string,
  photoPaths: Record<string, string>,
) {
  const v = state.visits.find((v) => v.id === visitId);
  if (!v) throw Error('Visit not found');
  if (v.status !== 'Completed' || !['Reviewed', 'Published to portal'].includes(v.reportStatus))
    throw Error('Complete and review this report before publishing');
  const p = state.properties.find((p) => p.id === v.propertyId)!;
  if (p.internal) throw Error('Internal properties cannot publish client reports');
  const photos = v.photos
    .filter((p) => p.visible)
    .map((p) => {
      if (!photoPaths[p.id]?.startsWith(clientId + '/operations/'))
        throw Error('A selected photo is not ready for publication');
      return {
        path: photoPaths[p.id],
        caption: p.caption || p.kind + ' service photo',
        kind: p.kind,
      };
    });
  return {
    date: v.date,
    property: p.name,
    summary: v.report,
    tasks: v.checklist.filter((t) => t.done).map((t) => t.label),
    photos,
  };
}
const text = z.string().trim().max(4000),
  date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v);
export const announcementSchema = z
  .object({
    id: z.string().uuid(),
    title: text.min(1).max(160),
    body: text.min(1),
    kind: z.enum(['Announcement', 'Promotion']),
    audience: z.enum(['All clients', 'Garden clients', 'Project clients', 'Selected clients']),
    client_ids: z.array(z.string().uuid()).max(500),
    starts_on: date,
    ends_on: date.nullable(),
    link_url: z
      .string()
      .url()
      .refine((v) => v.startsWith('https://'), 'Use an HTTPS link')
      .or(z.literal('')),
    link_label: text.max(100),
    status: z.enum(['Draft', 'Published', 'Archived']),
    version: z.number().int().min(0),
  })
  .refine((v) => !v.ends_on || v.ends_on >= v.starts_on, 'End date must follow start date')
  .refine(
    (v) => v.audience !== 'Selected clients' || v.client_ids.length > 0,
    'Select at least one client',
  )
  .refine((v) => !v.link_url || !!v.link_label, 'Give the link a label');
export function announcementVisible(a: any, c: { id: string; kind: string }, day: string) {
  return (
    a.status === 'Published' &&
    a.starts_on <= day &&
    (!a.ends_on || a.ends_on >= day) &&
    (a.audience === 'All clients' ||
      (a.audience === 'Garden clients' && c.kind === 'garden') ||
      (a.audience === 'Project clients' && c.kind === 'project') ||
      (a.audience === 'Selected clients' && a.client_ids.includes(c.id)))
  );
}

export function requestProposal(state: State, request: any, localId: string, propertyId: string) {
  const existing = state.leads.find((l) => l.sourceRequestId === request.id);
  if (existing) return existing;
  const c = state.clients.find((c) => c.id === localId);
  if (!c) throw Error('Link the client account first');
  const p = state.properties.find(
    (p) => p.id === propertyId && p.clientId === localId && !p.internal,
  );
  if (!p) throw Error('Choose a property belonging to this client');
  const lead = {
    id: 'request-' + request.id,
    clientId: c.id,
    propertyId: p.id,
    sourceRequestId: request.id,
    sourceReference: request.reference || request.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    address: p.address,
    city: p.city,
    kind: 'Contact' as const,
    status: 'Estimating' as const,
    notes: [request.about, request.body, JSON.stringify(request.details || {})]
      .filter(Boolean)
      .join('\n')
      .slice(0, 4000),
    lines: [],
    approvalNote: '',
    projectId: '',
    sentOn: '',
    sentReference: '',
    clientSummary: '',
  };
  state.leads.push(lead);
  return lead;
}

/** Only request images stored under the source client's prefix can be signed. */
export function requestPhotoPaths(clientId: string, value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (path): path is string =>
          typeof path === 'string' &&
          path.startsWith(clientId + '/requests/') &&
          !path.includes('..') &&
          /^[a-zA-Z0-9/_-]+\.webp$/.test(path),
      ),
    ),
  ].slice(0, 2);
}
