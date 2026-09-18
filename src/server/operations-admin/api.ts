import { db } from '../db';
import { handleBridge } from './bridge';
import { privateHeaders, sameOrigin, type Admin } from './auth';
import { stateSchema, clientReport } from '../../operations/lib/operations/model';
import { hydratePortal } from '../../operations/lib/operations/portal-model';
import { routeBookSchema, vehicleLocations } from '../../operations/lib/operations/field-feed';
import { staffRoute } from '../../operations/lib/operations/staff-route';
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: privateHeaders });
const bucket = 'gmz-operations';
export async function workspace(scope: string) {
  const { data, error } = await db().rpc('gmz_ops_snapshot', { p_scope: scope });
  if (error || !data?.workspace) throw Error('Operations workspace is unavailable');
  const current = hydratePortal(data);
  if (!current) throw Error('Workspace unavailable');
  return { ...current, state: stateSchema.parse(current.state) };
}
export async function adminApi(request: Request, admin: Admin, path: string): Promise<Response> {
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
  if (request.method === 'POST' && !sameOrigin(request))
    return json({ error: 'Request origin is not allowed' }, 403);
  const scope = admin.scope;
  const bridge = async (body: unknown) =>
    handleBridge(
      new Request('https://internal/bridge', { method: 'POST', body: JSON.stringify(body) }),
      db(),
      scope,
    );
  const key = (id: string) => `${scope}/${id}.webp`;
  try {
    if (path === 'operations' && request.method === 'GET') return json(await workspace(scope));
    if (path === 'operations' || path === 'portal') {
      if (request.method !== 'POST') return json({ error: 'POST required' }, 405);
      if (!request.headers.get('content-type')?.includes('application/json'))
        return json({ error: 'JSON required' }, 415);
      const text = await request.text();
      if (text.length > 200000) return json({ error: 'Request too large' }, 413);
      const body = JSON.parse(text);
      if (path === 'operations')
        return bridge({
          action: 'save',
          version: body.version,
          fingerprint: body.fingerprint,
          command: body.command,
        });
      if (
        ![
          'requestPhotos',
          'requestService',
          'requestProposal',
          'inbox',
          'link',
          'track',
          'preview',
          'announcements',
          'announcementSave',
          'publish',
        ].includes(body.action)
      )
        return json({ error: 'Unknown action' }, 400);
      if (body.action === 'publish') {
        const current = await workspace(scope);
        if (current.version !== body.version || current.fingerprint !== body.fingerprint)
          return json({ error: 'Workspace changed. Refresh before publishing.' }, 409);
        const visit = current.state.visits.find((v) => v.id === body.visitId);
        if (!visit || visit.status !== 'Completed' || visit.reportStatus !== 'Reviewed')
          return json({ error: 'Review this completed report before publishing' }, 400);
        const photoPaths: Record<string, string> = {};
        for (const photo of visit.photos.filter((p) => p.visible)) {
          const { data: file, error } = await db().storage.from(bucket).download(key(photo.id));
          if (error || !file)
            throw Error(
              'A selected photo is not available on Vercel. Transfer it from the private workspace before publishing.',
            );
          const uploaded = await bridge({
            action: 'upload',
            version: body.version,
            fingerprint: body.fingerprint,
            visitId: visit.id,
            photoId: photo.id,
            bytes: Buffer.from(await file.arrayBuffer()).toString('base64'),
          });
          const result = await uploaded.json();
          if (!uploaded.ok) return json(result, uploaded.status);
          photoPaths[photo.id] = result.path;
        }
        return bridge({
          action: 'publish',
          version: body.version,
          fingerprint: body.fingerprint,
          visitId: visit.id,
          photoPaths,
        });
      }
      return bridge(body);
    }
    if (path === 'photos' && request.method === 'POST') {
      if (request.headers.get('content-type') !== 'image/webp')
        return json({ error: 'Upload a processed WebP photo' }, 415);
      if (Number(request.headers.get('content-length')) > 4000000)
        return json({ error: 'Photo must be smaller than 4 MB' }, 413);
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength > 4000000)
        return json({ error: 'Photo must be smaller than 4 MB' }, 413);
      const b = new Uint8Array(bytes),
        dec = new TextDecoder();
      if (dec.decode(b.slice(0, 4)) !== 'RIFF' || dec.decode(b.slice(8, 12)) !== 'WEBP')
        return json({ error: 'Invalid photo' }, 400);
      for (let at = 12; at + 8 <= b.length;) {
        const tag = dec.decode(b.slice(at, at + 4));
        if (tag === 'EXIF' || tag === 'XMP ')
          return json({ error: 'Remove image metadata before upload' }, 400);
        const n = new DataView(bytes).getUint32(at + 4, true);
        at += 8 + n + (n % 2);
      }
      const id = crypto.randomUUID();
      const { error } = await db()
        .storage.from(bucket)
        .upload(key(id), bytes, { contentType: 'image/webp', upsert: false });
      if (error) throw Error('Photo upload failed');
      return json({ id });
    }
    if (path.startsWith('photos/') && request.method === 'GET') {
      const id = path.slice(7);
      if (!/^[a-f0-9-]{36}$/.test(id)) return json({ error: 'Not found' }, 404);
      const { data, error } = await db().storage.from(bucket).download(key(id));
      if (error || !data) return json({ error: 'Photo unavailable' }, 404);
      return new Response(data, {
        headers: {
          ...privateHeaders,
          'Content-Type': 'image/webp',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    if (path.startsWith('reports/') && request.method === 'GET') {
      const { state } = await workspace(scope);
      const v = state.visits.find((v) => v.id === path.slice(8));
      if (!v) return json({ error: 'Not found' }, 404);
      const p = state.properties.find((p) => p.id === v.propertyId)!;
      const c = state.clients.find((c) => c.id === p.clientId)!;
      return json(clientReport(v, p, c));
    }
    if ((path === 'field-feed' || path === 'staff-route') && request.method === 'GET') {
      const { data, error } = await db()
        .from('gmz_operations_config')
        .select('route_book')
        .eq('scope', scope)
        .maybeSingle();
      if (error) throw Error('Route configuration unavailable');
      let book = data?.route_book ? routeBookSchema.parse(data.route_book) : null;
      if (book)
        book.rows = book.rows.filter((r) => !['judy-hoff', 'jill-hoff', 'gemello'].includes(r.id));
      if (path === 'staff-route') {
        const p = new URL(request.url).searchParams,
          date = p.get('date') || '',
          rotation = p.get('rotation') || '';
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          isNaN(Date.parse(date)) ||
          new Date(date).toISOString().slice(0, 10) !== date ||
          !['', 'wed-a', 'wed-b'].includes(rotation)
        )
          return json({ error: 'Invalid date or route' }, 400);
        return json(staffRoute((await workspace(scope)).state, book, date, rotation));
      }
      const feed: any = {
        book,
        status: 'not-connected',
        message: book
          ? 'Saved route book. Live Bouncie positions are not connected.'
          : 'Route-book transfer is pending. Use the current private workspace for route planning.',
        vehicles: [],
        checkedAt: new Date().toISOString(),
      };
      if (
        process.env.BOUNCIE_API_KEY &&
        new URL(request.url).searchParams.get('routesOnly') !== '1'
      ) {
        try {
          const r = await fetch('https://api.bouncie.dev/v1/vehicles', {
            headers: { Authorization: process.env.BOUNCIE_API_KEY },
            signal: AbortSignal.timeout(10000),
            cache: 'no-store',
          });
          if (!r.ok) throw Error();
          const raw = await r.json();
          feed.vehicles = vehicleLocations(Array.isArray(raw) ? raw : raw.vehicles);
          feed.status = 'available';
          feed.message = 'Vehicle positions returned by Bouncie. Check the reported timestamps.';
        } catch {
          feed.status = 'unavailable';
          feed.message = 'Bouncie could not be refreshed.';
        }
      }
      return json(feed);
    }
    return json({ error: 'Not found' }, 404);
  } catch (e) {
    console.error('operations-admin-request-failed', e instanceof Error ? e.name : 'Error');
    return json({ error: 'The operation could not be completed. Refresh and try again.' }, 503);
  }
}
