/** Client-facing projections only. Every query is bound to the session client. */
import { db, signedUrl } from './db';
import type { PortalClient } from './auth';
import { proseProblems } from '../../scripts/lib/copy-rules.mjs';
export interface PortalProperty {
  id: string;
  name: string;
  city: string;
  cadence: string;
  primary: boolean;
}
export interface PublishedReport {
  id: string;
  visitId: string;
  propertyId: string;
  publishedAt: string;
  report: {
    date: string;
    property: string;
    summary: string;
    tasks: string[];
    photos: { path: string; caption: string; kind: string; url?: string }[];
  };
}
export interface Announcement {
  id: string;
  title: string;
  body: string;
  kind: string;
  link_url: string;
  link_label: string;
}
const day = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export async function loadOperations(client: PortalClient) {
  const { data: links, error: linkError } = await db()
    .from('gmz_operations_clients')
    .select('scope')
    .eq('client_id', client.id);
  if (linkError) throw new Error('Client updates could not be loaded.');
  const scopes = (links ?? []).map((r) => String(r.scope));
  if (!scopes.length)
    return {
      properties: [] as PortalProperty[],
      reports: [] as PublishedReport[],
      announcements: [] as Announcement[],
    };
  const [propertyResult, reportResult, announcementResult] = await Promise.all([
    db()
      .from('gmz_operations_properties')
      .select('id,data,legacy_primary')
      .eq('client_id', client.id)
      .in('scope', scopes),
    db()
      .from('gmz_portal_reports')
      .select('id,visit_id,property_id,report,published_at')
      .eq('client_id', client.id)
      .in('scope', scopes)
      .order('published_at', { ascending: false })
      .limit(200),
    db()
      .from('gmz_portal_announcements')
      .select('id,title,body,kind,audience,client_ids,starts_on,ends_on,link_url,link_label')
      .in('scope', scopes)
      .eq('status', 'Published')
      .lte('starts_on', day())
      .order('updated_at', { ascending: false }),
  ]);
  if (propertyResult.error || reportResult.error || announcementResult.error)
    throw new Error('Client updates could not be loaded.');
  const properties: PortalProperty[] = (propertyResult.data ?? [])
    .filter((p) => !p.data.internal)
    .map((p) => ({
      id: p.id,
      name: String(p.data.name),
      city: String(p.data.city),
      cadence: String(p.data.cadence),
      primary: p.legacy_primary,
    }));
  const ids = new Set(properties.map((p) => p.id)),
    seen = new Set<string>();
  const reports: PublishedReport[] = [];
  for (const row of reportResult.data ?? []) {
    if (seen.has(row.visit_id) || !ids.has(row.property_id)) continue;
    seen.add(row.visit_id);
    const r = row.report;
    if (!r || !Array.isArray(r.tasks) || !Array.isArray(r.photos)) continue;
    const photos = [];
    for (const p of r.photos) {
      if (typeof p.path !== 'string' || !p.path.startsWith(client.id + '/operations/')) continue;
      photos.push({
        path: p.path,
        caption: String(p.caption),
        kind: String(p.kind),
        url: await signedUrl(p.path),
      });
    }
    reports.push({
      id: row.id,
      visitId: row.visit_id,
      propertyId: row.property_id,
      publishedAt: row.published_at,
      report: {
        date: String(r.date),
        property: String(r.property),
        summary: String(r.summary),
        tasks: r.tasks.map(String),
        photos,
      },
    });
  }
  const announcements: Announcement[] = (announcementResult.data ?? [])
    .filter(
      (a) =>
        (!a.ends_on || a.ends_on >= day()) &&
        (a.audience === 'All clients' ||
          (a.audience === 'Garden clients' && client.kind === 'garden') ||
          (a.audience === 'Project clients' && client.kind === 'project') ||
          (a.audience === 'Selected clients' && a.client_ids.includes(client.id))),
    )
    .filter((a) => [a.title, a.body, a.link_label].every((s) => proseProblems(s).length === 0))
    .map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      kind: a.kind,
      link_url: a.link_url.startsWith('https://') ? a.link_url : '',
      link_label: a.link_label,
    }));
  return { properties, reports, announcements };
}
export async function primaryOperationsProperty(client: PortalClient) {
  const { data, error } = await db()
    .from('gmz_operations_properties')
    .select('data')
    .eq('client_id', client.id)
    .eq('legacy_primary', true)
    .maybeSingle();
  if (error) throw Error('Client property unavailable');
  return data?.data && !data.data.internal
    ? {
        name: String(data.data.name),
        city: String(data.data.city),
        cadence: String(data.data.cadence),
        monthly: data.data.monthly as number | null,
      }
    : null;
}
export async function latestOperationsReport(client: PortalClient) {
  const { data: property, error } = await db()
    .from('gmz_operations_properties')
    .select('id,data')
    .eq('client_id', client.id)
    .eq('legacy_primary', true)
    .maybeSingle();
  if (error) throw Error('Client property unavailable');
  if (!property || property.data.internal) return null;
  const { data, error: reportError } = await db()
    .from('gmz_portal_reports')
    .select('report')
    .eq('client_id', client.id)
    .eq('property_id', property.id)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (reportError) throw Error('Client report unavailable');
  return data?.report ?? null;
}
