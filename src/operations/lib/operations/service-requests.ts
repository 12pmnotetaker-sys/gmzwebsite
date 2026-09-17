import { z } from 'zod';
import type { State } from './model';
const text = z.string().trim().max(4000),
  id = text.min(1);
export const serviceRequestSchema = z.object({
  id,
  reference: id,
  clientId: id,
  propertyId: id,
  note: text.min(1).max(2500),
  visitId: text,
  addedAt: id,
});
export const serviceRequestFields = {
  serviceRequests: z.array(serviceRequestSchema).max(1000).default([]),
};
export function assignServiceRequests(s: State, day: string) {
  for (const r of s.serviceRequests) {
    const linked = s.visits.find((v) => v.id === r.visitId);
    if (linked && linked.status !== 'Skipped') continue;
    const next = s.visits
      .filter(
        (v) =>
          v.propertyId === r.propertyId &&
          v.date >= day &&
          ['Scheduled', 'In progress'].includes(v.status),
      )
      .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))[0];
    if (!next) {
      r.visitId = '';
      continue;
    }
    const block = `Client request ${r.reference}\n${r.note}`;
    const instructions = [next.instructions, block].filter(Boolean).join('\n\n');
    if (instructions.length > 4000) continue;
    next.instructions = instructions;
    r.visitId = next.id;
  }
}
export function addServiceRequest(
  s: State,
  request: any,
  clientId: string,
  propertyId: string,
  note: string,
  now: string,
  day: string,
) {
  const existing = s.serviceRequests.find((r) => r.id === request.id);
  if (existing) return existing;
  if (!s.properties.some((p) => p.id === propertyId && p.clientId === clientId && !p.internal))
    throw Error('Choose a property belonging to this client');
  const row = serviceRequestSchema.parse({
    id: request.id,
    reference: request.reference || request.id,
    clientId,
    propertyId,
    note,
    visitId: '',
    addedAt: now,
  });
  s.serviceRequests.push(row);
  assignServiceRequests(s, day);
  return row;
}
