'use client';
import { useEffect, useState } from 'react';
import { Plus, Package, Check, Download, Fuel, ClipboardList } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/operations/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/operations/components/ui/select';
import { routeDispatch, routeDispatchCSV } from '@/operations/lib/operations/route-dispatch';
import { useScheduleRoutes } from './schedule-routes';
import { officeBrief, dispatchCSV } from '@/operations/lib/operations/hub-workflows';
import type { Command, State } from '@/operations/lib/operations/model';
const cash = (v: number) => v.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
function Pick({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value || '__none'} onValueChange={(v) => onChange(v === '__none' ? '' : v)}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">Select…</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function DispatchExport({ data, day, crew }: { data: State; day: string; crew: string }) {
  const { feed, error, rotations, choose } = useScheduleRoutes();
  const wednesday = new Date(day + 'T12:00:00Z').getUTCDay() === 3,
    rotation = rotations[day] || '',
    hasSaved = data.routes.some((r) => r.date === day),
    rows = routeDispatch(data, feed?.book || null, day, crew, rotation);
  return (
    <section className="panel exp-pad daily-dispatch">
      <div className="flex-between">
        <div>
          <h2>Daily dispatch</h2>
          <p className="muted">
            {day} · {crew} · {rows.length} stops
          </p>
        </div>
        <button
          className="btn secondary"
          disabled={!rows.length || (!hasSaved && wednesday && !rotation)}
          onClick={() =>
            download(
              `GMZ-Dispatch-${day}.csv`,
              routeDispatchCSV(rows, day),
              'text/csv;charset=utf-8',
            )
          }
        >
          <Download size={16} /> Export dispatch CSV
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {!feed && !error && <p>Loading route stops…</p>}
      {wednesday && !hasSaved && (
        <div className="dispatch-rotation">
          <label className="field">
            <span>Wednesday route for {day}</span>
            <select value={rotation} onChange={(e) => choose(day, e.target.value)}>
              <option value="">Choose A or B for this date</option>
              <option value="wed-a">Wednesday A</option>
              <option value="wed-b">Wednesday B</option>
            </select>
          </label>
          {!rotation && feed?.book && (
            <div className="dispatch-options">
              {(['wed-a', 'wed-b'] as const).map((key) => (
                <button className="panel exp-pad" key={key} onClick={() => choose(day, key)}>
                  <strong>{key === 'wed-a' ? 'Wednesday A' : 'Wednesday B'}</strong>
                  <p>
                    {feed
                      .book!.rows.filter((r) => r.route === key)
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((r) => r.name)
                      .join(' · ')}
                  </p>
                  <span className="text-button">Use this route for dispatch →</span>
                </button>
              ))}
            </div>
          )}
          <p className="muted">
            Choose this date’s route; the recurring A/B calendar has not been confirmed.
          </p>
        </div>
      )}
      <div className="dispatch-stop-list">
        {rows.map((r, i) => (
          <article key={r.id} className="dispatch-stop">
            <span className="dispatch-number">{i + 1}</span>
            <div>
              <strong>{r.name}</strong>
              <p>
                {r.address}
                {r.city ? ', ' + r.city : ''}
              </p>
              <small>
                {[
                  r.crew,
                  r.truck,
                  r.start && r.start + ' Pacific',
                  r.minutes !== null && r.minutes + ' min budget',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
              {r.instructions && <p className="account-notes">{r.instructions}</p>}
            </div>
            <span className="chip">{r.source}</span>
          </article>
        ))}
      </div>
      {!rows.length && !(wednesday && !hasSaved && !rotation) && feed && (
        <p className="empty">No route stops or work orders are recorded for this date.</p>
      )}
      <p className="muted">
        Route plans are shown even before work orders are created. Skipped visits are excluded.
        Export includes crew instructions; access codes and job costs are excluded.
      </p>
    </section>
  );
}

type Props = {
  view: string;
  data: State;
  busy: boolean;
  save: (c: Command, close?: boolean) => Promise<boolean>;
};
export default function HubWorkflows({ view, data, busy, save }: Props) {
  const [modal, setModal] = useState(''),
    [draft, setDraft] = useState<any>({});
  const day = today(),
    brief = officeBrief(data, day),
    propertyName = (id: string) => data.properties.find((p) => p.id === id)?.name || 'Property';
  const targetLabel = (type: string, id: string) =>
    type === 'project'
      ? data.projects.find((p) => p.id === id)?.title
      : data.visits
          .filter((v) => v.id === id)
          .map((v) => propertyName(v.propertyId) + ' · ' + v.date)[0];
  const open = (kind: string, v: any) => {
    setModal(kind);
    setDraft(structuredClone(v));
  };
  const set = (key: string, value: any) => setDraft((d: any) => ({ ...d, [key]: value }));
  const run = async (action: string, value: any) => {
    if (await save({ type: 'extension', action, value }, false)) setModal('');
  };
  const purchase = () =>
    open('purchase', {
      id: crypto.randomUUID(),
      itemId: data.items[0]?.id || '',
      targetType: 'project',
      targetId: data.projects[0]?.id || '',
      quantity: 1,
      status: 'Needed',
      eta: '',
      notes: '',
    });
  const followup = () =>
    open('officeTask', {
      id: crypto.randomUUID(),
      title: '',
      owner: 'Office',
      due: day,
      status: 'Open',
      notes: '',
      projectId: '',
    });
  const fields: Record<
    string,
    {
      key: string;
      label: string;
      type?: string;
      optional?: boolean;
      options?: { value: string; label: string }[];
    }[]
  > = {
    purchase: [
      {
        key: 'itemId',
        label: 'Price book material',
        options: data.items.map((i) => ({
          value: i.id,
          label: `${i.name} · ${i.vendor} · ${cash(i.cost)}/${i.unit}`,
        })),
      },
      {
        key: 'targetType',
        label: 'Job type',
        options: ['project', 'visit'].map((value) => ({
          value,
          label: value === 'project' ? 'Project' : 'Work order',
        })),
      },
      {
        key: 'targetId',
        label: 'Project / work order',
        options:
          draft.targetType === 'project'
            ? data.projects.map((p) => ({ value: p.id, label: p.title }))
            : data.visits.map((v) => ({
                value: v.id,
                label: propertyName(v.propertyId) + ' · ' + v.date,
              })),
      },
      { key: 'quantity', label: 'Quantity', type: 'number' },
      {
        key: 'status',
        label: 'Order status',
        options: ['Needed', 'Ordered', 'Shipped', 'Arrived', 'Installed', 'Cancelled'].map(
          (value) => ({ value, label: value }),
        ),
      },
      { key: 'eta', label: 'Expected delivery', type: 'date', optional: true },
      {
        key: 'notes',
        label: 'Order / receipt reference and notes',
        type: 'textarea',
        optional: true,
      },
    ],
    fuel: [
      {
        key: 'assetId',
        label: 'Equipment',
        options: data.assets.map((a) => ({ value: a.id, label: a.name })),
      },
      { key: 'date', label: 'Fuel date', type: 'date' },
      { key: 'gallons', label: 'Gallons', type: 'number' },
      { key: 'cost', label: 'Total paid ($)', type: 'number' },
      { key: 'meter', label: 'Meter reading (equipment unit)', type: 'number' },
      { key: 'crew', label: 'Purchased by' },
      { key: 'station', label: 'Station / receipt reference', optional: true },
    ],
    officeTask: [
      { key: 'title', label: 'Follow-up' },
      { key: 'owner', label: 'Responsible person' },
      { key: 'due', label: 'Due date', type: 'date' },
      {
        key: 'status',
        label: 'Status',
        options: ['Open', 'Done'].map((value) => ({ value, label: value })),
      },
      {
        key: 'projectId',
        label: 'Related project (optional)',
        optional: true,
        options: data.projects.map((p) => ({ value: p.id, label: p.title })),
      },
      { key: 'notes', label: 'Notes', type: 'textarea', optional: true },
    ],
  };
  return (
    <div className="hub-workflows">
      {view === 'overview' && (
        <>
          <section className="panel exp-pad">
            <p className="eyebrow">OFFICE BRIEF · {day}</p>
            <h2>Today’s follow-through</h2>
            <div className="brief-grid">
              {[
                { label: 'Visits past due', rows: brief.overdueVisits, href: '#orders' },
                { label: 'Reports to review', rows: brief.reports, href: '#reports' },
                { label: 'Deliveries due / late', rows: brief.deliveries, href: '#vendors' },
                { label: 'Projects past due', rows: brief.projects, href: '#projects' },
                { label: 'Equipment service due', rows: brief.service, href: '#fleet' },
              ].map((x) => (
                <a className="brief-count" href={x.href} key={x.label}>
                  <strong>{x.rows.length}</strong>
                  <span>{x.label}</span>
                </a>
              ))}
            </div>
            {brief.deliveries.slice(0, 4).map((p) => (
              <p key={p.id}>
                <Package size={15} className="inline" /> {p.name} · {p.vendor} · expected {p.eta} ·{' '}
                {targetLabel(p.targetType, p.targetId)}
              </p>
            ))}
            <p className="muted">
              Based on saved work orders, material orders, project dates, and equipment meters.
            </p>
          </section>
          <section className="panel exp-pad">
            <div className="flex-between">
              <h2>Office follow-ups</h2>
              <button className="btn secondary" onClick={followup}>
                <Plus size={16} /> Add follow-up
              </button>
            </div>
            {data.officeTasks
              .filter((t) => t.status === 'Open')
              .sort((a, b) => a.due.localeCompare(b.due))
              .map((t) => (
                <div className="exp-route" key={t.id}>
                  <button className="text-button" onClick={() => open('officeTask', t)}>
                    {t.title}
                    <small>
                      {t.owner} · due {t.due}
                      {t.projectId ? ' · ' + targetLabel('project', t.projectId) : ''}
                    </small>
                  </button>
                  <button
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => run('officeTask', { ...t, status: 'Done' })}
                  >
                    <Check size={16} /> Done
                  </button>
                </div>
              ))}
            {!data.officeTasks.some((t) => t.status === 'Open') && (
              <p className="muted">No open follow-ups.</p>
            )}
            <details>
              <summary>
                Completed follow-ups ({data.officeTasks.filter((t) => t.status === 'Done').length})
              </summary>
              {data.officeTasks
                .filter((t) => t.status === 'Done')
                .map((t) => (
                  <button className="exp-stop" key={t.id} onClick={() => open('officeTask', t)}>
                    {t.title} · {t.owner}
                  </button>
                ))}
            </details>
          </section>
        </>
      )}
      {view === 'vendors' && (
        <section className="panel exp-pad">
          <div className="flex-between">
            <div>
              <p className="eyebrow">PROCUREMENT</p>
              <h2>Material orders & deliveries</h2>
            </div>
            <button
              className="btn"
              disabled={!data.items.length || (!data.projects.length && !data.visits.length)}
              onClick={purchase}
            >
              <Plus size={16} /> New order
            </button>
          </div>
          <p className="muted">
            Track purchases here. “Post job cost” adds the received order to the job once. Do not
            also post the same purchase from the price book.
          </p>
          {data.purchases
            .slice()
            .sort(
              (a, b) =>
                Number(a.posted) - Number(b.posted) ||
                (a.eta || '9999').localeCompare(b.eta || '9999'),
            )
            .map((p) => (
              <div className="exp-route" key={p.id}>
                <span>
                  <strong>
                    {p.name} · {p.quantity} {p.unit}
                  </strong>
                  <small>
                    {p.vendor} · {targetLabel(p.targetType, p.targetId)}
                  </small>
                  <small>
                    {cash(p.quantity * p.unitCost)} · {p.status}
                    {p.eta ? ' · expected ' + p.eta : ''}
                  </small>
                  {p.eta < day && p.eta && ['Ordered', 'Shipped'].includes(p.status) && (
                    <span className="chip amber">Delivery overdue</span>
                  )}
                </span>
                <div className="exp-actions">
                  {p.posted ? (
                    <span className="chip green">Cost posted</span>
                  ) : (
                    <>
                      <button className="text-button" onClick={() => open('purchase', p)}>
                        Edit order
                      </button>
                      {['Arrived', 'Installed'].includes(p.status) && (
                        <button
                          className="btn secondary"
                          disabled={busy}
                          onClick={() => run('postPurchase', { id: p.id })}
                        >
                          Post job cost
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          {!data.purchases.length && (
            <p className="muted">
              Add a price book item and a project or work order to start tracking purchases.
            </p>
          )}
        </section>
      )}
      {view === 'fleet' && (
        <section className="panel exp-pad">
          <div className="flex-between">
            <div>
              <p className="eyebrow">OPERATING COSTS</p>
              <h2>Fuel log</h2>
            </div>
            <button
              className="btn secondary"
              disabled={!data.assets.length}
              onClick={() =>
                open('fuel', {
                  id: crypto.randomUUID(),
                  assetId: data.assets[0]?.id || '',
                  date: day,
                  gallons: 0,
                  cost: 0,
                  meter: data.assets[0]?.meter || 0,
                  crew: '',
                  station: '',
                })
              }
            >
              <Fuel size={16} /> Log fuel
            </button>
          </div>
          <p className="muted">
            Fuel purchases update the equipment meter. They are tracked separately from job material
            costs.
          </p>
          {data.fuelLogs
            .slice()
            .reverse()
            .map((f) => (
              <div className="exp-route" key={f.id}>
                <span>
                  <strong>
                    {data.assets.find((a) => a.id === f.assetId)?.name} · {f.date}
                  </strong>
                  <small>
                    {f.gallons} gal · meter {f.meter} · {f.crew} ·{' '}
                    {f.station || 'Station not recorded'}
                  </small>
                </span>
                <strong>{cash(f.cost)}</strong>
              </div>
            ))}
          {!data.fuelLogs.length && <p className="muted">No fuel purchases recorded.</p>}
          <strong>Total recorded: {cash(data.fuelLogs.reduce((n, f) => n + f.cost, 0))}</strong>
        </section>
      )}
      <Dialog open={!!modal} onOpenChange={(v) => !v && !busy && setModal('')}>
        <DialogContent className="editor">
          <DialogHeader>
            <DialogTitle>
              {modal === 'purchase'
                ? 'Material order'
                : modal === 'fuel'
                  ? 'Fuel purchase'
                  : 'Office follow-up'}
            </DialogTitle>
            <DialogDescription>
              {modal === 'purchase'
                ? 'The unit price is captured from the price book when the order is created.'
                : 'Saved to the GMZ workspace.'}
            </DialogDescription>
          </DialogHeader>
          <form
            className="editor-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(modal, draft);
            }}
          >
            <div className="form-grid">
              {(fields[modal] || []).map((f) => (
                <label className="field" key={f.key}>
                  <span>{f.label}</span>
                  {f.options ? (
                    <Pick
                      label={f.label}
                      value={draft[f.key] || ''}
                      options={f.options}
                      onChange={(v) => {
                        set(f.key, v);
                        if (f.key === 'targetType') set('targetId', '');
                        if (f.key === 'assetId')
                          set('meter', data.assets.find((a) => a.id === v)?.meter || 0);
                      }}
                    />
                  ) : f.type === 'textarea' ? (
                    <textarea
                      value={draft[f.key] || ''}
                      onChange={(e) => set(f.key, e.target.value)}
                    />
                  ) : (
                    <input
                      required={!f.optional}
                      type={f.type || 'text'}
                      min={f.type === 'number' ? 0 : undefined}
                      step={f.type === 'number' ? 'any' : undefined}
                      value={draft[f.key] ?? ''}
                      onChange={(e) =>
                        set(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)
                      }
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="editor-footer">
              <button
                type="button"
                disabled={busy}
                className="btn secondary"
                onClick={() => setModal('')}
              >
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn">
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
