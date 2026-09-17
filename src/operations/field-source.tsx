'use client';
import { useEffect, useState } from 'react';
import { Truck, RefreshCw, Route } from 'lucide-react';
import { matchRouteProperty, type FieldFeed } from '@/operations/lib/operations/field-feed';
import type { Property } from '@/operations/lib/operations/model';
const labels = { monday: 'Monday route', 'wed-a': 'Wednesday A', 'wed-b': 'Wednesday B' };
export default function FieldSource({
  properties,
  onLoad,
}: {
  properties: Property[];
  onLoad: (ids: string[]) => void;
}) {
  const [feed, setFeed] = useState<FieldFeed | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [vehicle, setVehicle] = useState('');
  async function refresh(signal?: AbortSignal) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/admin/field-feed', { signal });
      const j = (await r.json()) as FieldFeed & { error?: string };
      if (!r.ok) throw Error(j.error || 'Could not load field sources');
      setFeed(j);
    } catch (e) {
      if (!signal?.aborted)
        setError(e instanceof Error ? e.message : 'Could not load field sources');
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, []);
  const current = feed?.vehicles.find((v) => v.id === vehicle) || feed?.vehicles[0];
  return (
    <>
      <section className="panel exp-pad">
        <div className="flex-between">
          <div>
            <p className="eyebrow">BOUNCIE · FIELD ACTIVITY</p>
            <h2>Truck locations</h2>
          </div>
          <button className="btn secondary" disabled={busy} onClick={() => refresh()}>
            <RefreshCw size={16} />
            {busy ? 'Checking…' : 'Refresh feed'}
          </button>
        </div>
        {error ? (
          <p role="alert">{error}</p>
        ) : !feed ? (
          <p>Checking field sources…</p>
        ) : (
          <>
            <span className={'chip ' + (feed.status === 'available' ? 'green' : 'amber')}>
              {feed.status === 'available'
                ? 'Bouncie data available'
                : feed.status === 'unavailable'
                  ? 'Refresh unavailable'
                  : 'Connection needed'}
            </span>
            <p>{feed.message}</p>
            {feed.status === 'available' && feed.vehicles.length === 0 && (
              <p>No vehicles were returned by Bouncie.</p>
            )}
            <div className="exp-actions">
              {feed.vehicles.map((v) => (
                <button className="btn secondary" onClick={() => setVehicle(v.id)} key={v.id}>
                  <Truck size={16} />
                  {v.name}
                </button>
              ))}
            </div>
            {current && (
              <>
                <h3>{current.name}</h3>
                <p>
                  {current.reportedAt
                    ? 'Reported ' + new Date(current.reportedAt).toLocaleString()
                    : 'Location timestamp not supplied. freshness unverified'}
                </p>
                {current.lat !== null && current.lon !== null ? (
                  <iframe
                    title={'Bouncie location: ' + current.name}
                    className="exp-map"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    src={
                      'https://maps.google.com/maps?q=' +
                      encodeURIComponent(current.lat + ',' + current.lon) +
                      '&output=embed'
                    }
                  />
                ) : (
                  <p>No GPS location supplied for this vehicle.</p>
                )}
              </>
            )}
            <small className="muted">
              Feed checked {new Date(feed.checkedAt).toLocaleString()}. GPS activity does not
              automatically complete work orders.
            </small>
          </>
        )}
      </section>
      {feed?.book && (
        <section className="panel exp-pad">
          <p className="eyebrow">EXISTING GMZ ROUTE BOOK</p>
          <h2>Routes</h2>
          <p className="muted">
            {feed.book.source} · snapshot {feed.book.asOf}. Closed accounts excluded. Loading a
            route copies matched stops into the day planner for review.
          </p>
          <div className="project-grid">
            {(['monday', 'wed-a', 'wed-b'] as const).map((key) => {
              const rows = feed
                .book!.rows.filter((r) => r.route === key)
                .sort((a, b) => a.sortOrder - b.sortOrder);
              const matches = rows.map((r) => ({
                ...r,
                propertyId: matchRouteProperty(r.address, properties),
              }));
              return (
                <article className="exp-card" key={key}>
                  <Route size={20} />
                  <h3>{labels[key]}</h3>
                  <p>{rows[0]?.crew} · 7:00 AM Pacific</p>
                  <ol className="source-stops">
                    {matches.map((r) => (
                      <li key={r.id}>
                        <strong>{r.name}</strong>
                        <small>
                          {r.frequency === 'biweekly' ? 'Every two weeks' : 'Weekly'}
                          {!r.propertyId ? ' · Not matched to this workspace' : ''}
                        </small>
                      </li>
                    ))}
                  </ol>
                  <button
                    className="btn secondary"
                    disabled={!matches.some((r) => r.propertyId)}
                    onClick={() =>
                      onLoad(matches.flatMap((r) => (r.propertyId ? [r.propertyId] : [])))
                    }
                  >
                    Load {matches.filter((r) => r.propertyId).length} matched stops
                  </button>
                  {matches.some((r) => !r.propertyId) && (
                    <p className="muted">
                      Unmatched stops stay in this source list. Add or reconcile their property
                      records before scheduling.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
