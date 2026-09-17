import { z } from 'zod';
import type { State } from './model';
const text = z.string().trim().max(4000),
  id = text.min(1),
  num = z.number().finite().min(0).max(100000000),
  date = text
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
      'Enter a valid date',
    );
export const leadSchema = z.object({
  id,
  name: id,
  email: z.string().email().or(z.literal('')),
  phone: text,
  address: text,
  city: text,
  kind: z.enum(['Contact', 'Consultation', 'Site walk']),
  status: z.enum(['New', 'Contacted', 'Site walk', 'Estimating', 'Won', 'Lost']),
  notes: text,
  lines: z
    .array(z.object({ id, label: id, unit: id, quantity: num, price: num, accepted: z.boolean() }))
    .max(100),
  approvalNote: text,
  projectId: text.default(''),
  clientId: text.default(''),
  propertyId: text.default(''),
  sourceRequestId: text.default(''),
  sourceReference: text.default(''),
  sentOn: date.or(z.literal('')).default(''),
  sentReference: text.default(''),
  clientSummary: text.default(''),
});
export const assetSchema = z.object({
  id,
  name: id,
  kind: z.enum(['Truck', 'Trailer', 'Loader', 'Mower', 'Tool', 'Other']),
  meter: num,
  unit: z.enum(['Miles', 'Hours']),
  lastService: num,
  interval: num.positive(),
  notes: text,
  checklist: z.array(z.object({ label: id, done: z.boolean() })).max(50),
});
export const serviceSchema = z.object({
  id,
  assetId: id,
  date,
  meter: num,
  description: id,
  cost: num,
});
export const zoneSchema = z.object({
  id,
  propertyId: id,
  controller: id,
  location: text,
  zone: id,
  planting: text,
  minutes: num.max(240),
  cycles: num.max(20).int(),
  days: text,
  start: text,
  budget: num.max(300),
  notes: text,
});
export const issueSchema = z.object({
  id,
  propertyId: id,
  title: id,
  priority: z.enum(['Routine', 'Urgent']),
  notes: text,
  status: z.enum(['Open', 'Resolved']),
  visitId: text.default(''),
});
export const itemSchema = z.object({
  id,
  name: id,
  vendor: id,
  unit: id,
  cost: num,
  asOf: date,
  source: text,
});
export const allocationSchema = z.object({
  id,
  itemId: id,
  targetType: z.enum(['visit', 'project']),
  targetId: id,
  quantity: num.positive(),
  unitCost: num,
  total: num,
  name: id,
  at: text,
});
export const routeSchema = z.object({ id, date, truck: id, propertyIds: z.array(id).max(50) });
export const extensionFields = {
  leads: z.array(leadSchema).max(1000).default([]),
  assets: z.array(assetSchema).max(300).default([]),
  services: z.array(serviceSchema).max(5000).default([]),
  zones: z.array(zoneSchema).max(3000).default([]),
  issues: z.array(issueSchema).max(3000).default([]),
  items: z.array(itemSchema).max(3000).default([]),
  allocations: z.array(allocationSchema).max(5000).default([]),
  routes: z.array(routeSchema).max(1000).default([]),
};
export function estimateTotal(lead: z.infer<typeof leadSchema>, accepted = false) {
  return (
    Math.round(
      lead.lines
        .filter((l) => !accepted || l.accepted)
        .reduce((n, l) => n + l.quantity * l.price, 0) * 100,
    ) / 100
  );
}
function upsert(rows: any[], v: any) {
  const i = rows.findIndex((r) => r.id === v.id);
  if (i < 0) rows.push(v);
  else rows[i] = v;
}
export function extensionCommand(s: State, action: string, value: any, now: string) {
  const property = (pid: string) => {
    const p = s.properties.find((p) => p.id === pid);
    if (!p) throw Error('Property not found');
    return p;
  };
  if (action === 'lead') {
    const v = leadSchema.parse(value),
      old = s.leads.find((l) => l.id === v.id);
    if (old?.projectId) throw Error('Converted proposals are locked; edit the project instead');
    if (
      old?.sentOn &&
      v.sentOn &&
      JSON.stringify([
        old.clientSummary,
        old.lines.map(({ accepted, ...line }) => line),
        old.propertyId,
      ]) !==
        JSON.stringify([
          v.clientSummary,
          v.lines.map(({ accepted, ...line }) => line),
          v.propertyId,
        ])
    )
      throw Error(
        'Clear the sent date before changing delivered scope, then resend the revised proposal',
      );
    v.projectId = '';
    for (const key of ['clientId', 'sourceRequestId', 'sourceReference'] as const)
      v[key] = old?.[key] || '';
    if (
      v.clientId &&
      (!v.propertyId ||
        !s.properties.some(
          (p) => p.id === v.propertyId && p.clientId === v.clientId && !p.internal,
        ))
    )
      throw Error('Select a property belonging to this client');
    if (v.sentOn && !v.sentReference.trim())
      throw Error('Add a delivery reference for the sent proposal');
    if (v.sentOn && !v.lines.length) throw Error('Add proposal scope before recording delivery');
    if (v.status === 'Won') throw Error('Use Convert accepted proposal to mark a lead won');
    upsert(s.leads, v);
  } else if (action === 'convert') {
    const v = z.object({ id, propertyId: text, due: date, owner: id }).parse(value);
    const lead = s.leads.find((l) => l.id === v.id);
    if (!lead) throw Error('Inquiry not found');
    if (lead.projectId) return 'Proposal already converted';
    if (!lead.lines.some((l) => l.accepted) || !lead.approvalNote.trim())
      throw Error('Record acceptance evidence and select accepted scope first');
    let pid = v.propertyId;
    if (
      lead.clientId &&
      (!pid || property(pid).clientId !== lead.clientId || property(pid).internal)
    )
      throw Error('Select this client’s property before conversion');
    if (pid) property(pid);
    else {
      if (!lead.address.trim() || !lead.city.trim())
        throw Error('Add a property address and city first');
      if (
        s.properties.some(
          (p) =>
            p.address.trim().toLowerCase() === lead.address.trim().toLowerCase() &&
            p.city.trim().toLowerCase() === lead.city.trim().toLowerCase(),
        )
      )
        throw Error('This address already exists. Select its property.');
      let client = s.clients.find(
        (c) => lead.email && c.email.toLowerCase() === lead.email.toLowerCase(),
      );
      if (!client) {
        client = {
          id: crypto.randomUUID(),
          name: lead.name,
          contact: lead.name,
          email: lead.email,
          phone: lead.phone,
        };
        s.clients.push(client);
      }
      pid = crypto.randomUUID();
      s.properties.push({
        id: pid,
        clientId: client.id,
        name: lead.name,
        address: lead.address,
        city: lead.city,
        monthly: null,
        budgetMinutes: null,
        crew: '',
        truck: '',
        access: '',
        notes: lead.notes,
        cadence: 'Not set',
      });
    }
    const jid = crypto.randomUUID();
    s.projects.push({
      id: jid,
      propertyId: pid,
      title: lead.name + '. approved scope',
      stage: 'Approval',
      owner: v.owner,
      due: v.due,
      budget: estimateTotal(lead, true),
      laborCost: null,
      materialCost: null,
      notes: 'Office-recorded approval: ' + lead.approvalNote,
      approvalUrl: '',
      tasks: lead.lines
        .filter((l) => l.accepted)
        .map((l) => ({
          id: crypto.randomUUID(),
          label: `${l.label} (${l.quantity} ${l.unit})`,
          done: false,
        })),
    });
    lead.projectId = jid;
    lead.status = 'Won';
  } else if (action === 'asset') {
    const v = assetSchema.parse(value);
    upsert(s.assets, v);
  } else if (action === 'service') {
    const v = serviceSchema.parse(value);
    if (s.services.some((x) => x.id === v.id)) return 'Service already logged';
    const a = s.assets.find((a) => a.id === v.assetId);
    if (!a) throw Error('Equipment not found');
    if (v.meter < a.meter) throw Error('Service meter cannot be below the current meter');
    s.services.push(v);
    a.meter = v.meter;
    a.lastService = v.meter;
  } else if (action === 'zone') {
    const v = zoneSchema.parse(value);
    property(v.propertyId);
    upsert(s.zones, v);
  } else if (action === 'issue') {
    const v = issueSchema.parse(value);
    property(v.propertyId);
    v.visitId = s.issues.find((x) => x.id === v.id)?.visitId || '';
    upsert(s.issues, v);
  } else if (action === 'repair') {
    const v = z
        .object({ id, date, crew: id, truck: id, minutes: num.positive().max(1440).int() })
        .parse(value),
      issue = s.issues.find((i) => i.id === v.id);
    if (!issue) throw Error('Audit issue not found');
    if (issue.visitId) return 'Repair work order already created';
    if (issue.status === 'Resolved') throw Error('Issue is already resolved');
    const p = property(issue.propertyId);
    const vid = crypto.randomUUID();
    s.visits.push({
      id: vid,
      propertyId: p.id,
      date: v.date,
      start: '08:00',
      crew: v.crew,
      truck: v.truck,
      crewCount: 2,
      budgetMinutes: v.minutes,
      status: 'Scheduled',
      checklist: [{ id: crypto.randomUUID(), label: issue.title, done: false }],
      instructions: issue.notes,
      internalNotes: 'Irrigation audit repair. Confirm billable scope with office.',
      report: '',
      reportStatus: 'Draft',
      actualMinutes: null,
      hourlyCost: null,
      materials: null,
      photos: [],
      completedAt: null,
      publishedAt: null,
    });
    issue.visitId = vid;
  } else if (action === 'item') {
    upsert(s.items, itemSchema.parse(value));
  } else if (action === 'importItems') {
    const rows = z.array(itemSchema).min(1).max(500).parse(value);
    if (new Set(rows.map((r) => r.id)).size !== rows.length) throw Error('Duplicate item IDs');
    rows.forEach((r) => upsert(s.items, r));
  } else if (action === 'allocate') {
    const v = z
      .object({
        id,
        itemId: id,
        targetType: z.enum(['visit', 'project']),
        targetId: id,
        quantity: num.positive(),
      })
      .parse(value);
    if (s.allocations.some((a) => a.id === v.id)) return 'Materials already recorded';
    const item = s.items.find((i) => i.id === v.itemId);
    if (!item) throw Error('Price book item not found');
    const total = Math.round(item.cost * v.quantity * 100) / 100;
    const target =
      v.targetType === 'visit'
        ? s.visits.find((x) => x.id === v.targetId)
        : s.projects.find((x) => x.id === v.targetId);
    if (!target) throw Error('Work order or project not found');
    if ('materials' in target) target.materials = (target.materials || 0) + total;
    else target.materialCost = (target.materialCost || 0) + total;
    s.allocations.push({ ...v, unitCost: item.cost, total, name: item.name, at: now });
  } else if (action === 'route') {
    const v = routeSchema.parse(value);
    v.propertyIds.forEach(property);
    if (new Set(v.propertyIds).size !== v.propertyIds.length) throw Error('Duplicate route stop');
    upsert(s.routes, v);
  } else throw Error('Unknown operations action');
  return 'Saved: ' + action;
}
