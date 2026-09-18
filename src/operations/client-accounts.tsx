'use client';
import { useState } from 'react';
import { PortalAccount, PortalInbox } from './portal-tools';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/operations/components/ui/tabs';
import type { State, Client, Property, Visit, Project } from '@/operations/lib/operations/model';
const cash = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
export default function ClientAccounts({
  data,
  selected,
  onSelect,
  onEdit,
  onProperty,
  onVisit,
  onProject,
  onAddProperty,
  onRefresh,
  onProposal,
}: {
  data: State;
  selected: string;
  onSelect: (id: string) => void;
  onEdit: (c: Client) => void;
  onProperty: (p: Property) => void;
  onVisit: (v: Visit) => void;
  onProject: (p: Project) => void;
  onAddProperty: (id: string) => void;
  onRefresh: () => Promise<void>;
  onProposal: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const c = data.clients.find((c) => c.id === selected);
  if (!c)
    return (
      <>
        <div className="toolbar">
          <label className="search">
            <input
              aria-label="Search client accounts"
              placeholder="Search name, contact, email, or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <span className="muted">{data.clients.length} accounts</span>
        </div>
        {selected && <p role="status">This account was not found. Choose an account below.</p>}
        <div className="client-grid">
          {data.clients
            .filter((c) =>
              `${c.name} ${c.contact} ${c.email} ${c.phone}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((c) => {
              const ps = data.properties.filter((p) => p.clientId === c.id);
              return (
                <a
                  className="panel account-directory"
                  href={'#clients/' + encodeURIComponent(c.id)}
                  key={c.id}
                  onClick={(e) => {
                    e.preventDefault();
                    onSelect(c.id);
                  }}
                >
                  <h2>{c.name}</h2>
                  <p>{c.contact || 'Contact not recorded'}</p>
                  <p className="muted">{c.phone || 'Phone not recorded'}</p>
                  <p>
                    {ps.length} {ps.length === 1 ? 'property' : 'properties'} ·{' '}
                    {
                      data.projects.filter(
                        (p) => ps.some((x) => x.id === p.propertyId) && p.stage !== 'Complete',
                      ).length
                    }{' '}
                    open projects
                  </p>
                  <span className="text-button">View client account →</span>
                </a>
              );
            })}
        </div>
        {!data.clients.some((c) =>
          `${c.name} ${c.contact} ${c.email} ${c.phone}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        ) && <p className="empty">No matching client accounts.</p>}
      </>
    );
  const properties = data.properties.filter((p) => p.clientId === c.id),
    ids = new Set(properties.map((p) => p.id));
  const visits = data.visits
    .filter((v) => ids.has(v.propertyId))
    .sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start));
  const projects = data.projects.filter((p) => ids.has(p.propertyId));
  const known = properties.filter((p) => p.monthly !== null && !p.internal);
  const propertyName = (id: string) => properties.find((p) => p.id === id)?.name || 'Property';
  return (
    <div className="account-detail">
      <button className="text-button" onClick={() => onSelect('')}>
        ← All client accounts
      </button>
      <section className="panel account-header">
        <div>
          <p className="eyebrow">CLIENT ACCOUNT</p>
          <h2>{c.name}</h2>
          <p className="muted">
            {c.contact || 'Contact not recorded'} · {properties.length}{' '}
            {properties.length === 1 ? 'property' : 'properties'}
          </p>
        </div>
        <div className="exp-actions">
          <button className="btn secondary" onClick={() => onEdit(c)}>
            Edit account
          </button>
          <button className="btn" onClick={() => onAddProperty(c.id)}>
            Add property
          </button>
        </div>
      </section>
      <PortalAccount clientId={c.id} />
      <Tabs key={c.id} defaultValue="overview">
        <TabsList className="account-tabs" aria-label="Client account sections">
          <TabsTrigger value="overview">Account details</TabsTrigger>
          <TabsTrigger value="properties">Properties ({properties.length})</TabsTrigger>
          <TabsTrigger value="history">Service history ({visits.length})</TabsTrigger>
          <TabsTrigger value="requests">Requests & proposals</TabsTrigger>
          <TabsTrigger value="projects">Projects ({projects.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="account-columns">
            <section className="panel account-section">
              <h3>Contact & communication</h3>
              <dl>
                <dt>Primary contact</dt>
                <dd>{c.contact || 'Not recorded'}</dd>
                <dt>Email</dt>
                <dd>
                  {c.email || 'Not recorded'}
                  {/@(pending\.invalid|example\.com)$/.test(c.email) ? ' (placeholder)' : ''}
                </dd>
                <dt>Phone</dt>
                <dd>{c.phone || 'Not recorded'}</dd>
                <dt>Preferred contact method</dt>
                <dd>{c.preferredContact || 'Not recorded'}</dd>
                <dt>Account owner</dt>
                <dd>{c.accountOwner || 'Not assigned'}</dd>
              </dl>
            </section>
            <section className="panel account-section">
              <h3>Agreement & billing details</h3>
              <dl>
                <dt>Recorded monthly agreements</dt>
                <dd>
                  {known.length ? cash(known.reduce((n, p) => n + p.monthly!, 0)) : 'Not recorded'}
                  <small>
                    {known.length} of {properties.filter((p) => !p.internal).length} customer
                    properties have an amount recorded
                  </small>
                </dd>
                <dt>Billing contact</dt>
                <dd>{c.billingContact || 'Not recorded'}</dd>
                <dt>Billing email</dt>
                <dd>{c.billingEmail || 'Not recorded'}</dd>
                <dt>Billing address</dt>
                <dd>{c.billingAddress || 'Not recorded'}</dd>
              </dl>
              <p className="muted">
                Agreement values only. Invoices, payments, and account balances are not connected.
              </p>
            </section>
            <section className="panel account-section">
              <h3>Account notes · internal</h3>
              <p className="account-notes">
                {c.notes ||
                  'No account notes recorded. Use Edit account to add preferences, context, or follow-up details.'}
              </p>
            </section>
            <section className="panel account-section">
              <h3>Service & project summary</h3>
              <dl>
                <dt>Open work orders</dt>
                <dd>
                  {visits.filter((v) => ['Scheduled', 'In progress'].includes(v.status)).length}
                </dd>
                <dt>Completed visits</dt>
                <dd>{visits.filter((v) => v.status === 'Completed').length}</dd>
                <dt>Open projects</dt>
                <dd>{projects.filter((p) => p.stage !== 'Complete').length}</dd>
                <dt>Latest completed service</dt>
                <dd>
                  {visits.find((v) => v.status === 'Completed')?.date ||
                    'No completed service recorded'}
                </dd>
              </dl>
            </section>
          </div>
        </TabsContent>
        <TabsContent value="properties">
          <div className="account-columns">
            {properties.map((p) => (
              <section className="panel account-section" key={p.id}>
                <h3>{p.name}</h3>
                <p>{[p.address, p.city].filter(Boolean).join(', ') || 'Address not recorded'}</p>
                <dl>
                  <dt>Service frequency</dt>
                  <dd>{p.cadence}</dd>
                  <dt>Crew / truck</dt>
                  <dd>
                    {p.crew || 'Unassigned'} / {p.truck || 'Unassigned'}
                  </dd>
                  <dt>Monthly agreement</dt>
                  <dd>
                    {p.internal
                      ? 'Internal property'
                      : p.monthly === null
                        ? 'Not recorded'
                        : cash(p.monthly)}
                  </dd>
                  <dt>Service scope</dt>
                  <dd>{p.notes || 'Not recorded'}</dd>
                </dl>
                <button
                  className="btn secondary"
                  onClick={() => onProperty(p)}
                  aria-label={'Property details: ' + p.name}
                >
                  Property details →
                </button>
              </section>
            ))}
          </div>
          {!properties.length && (
            <p className="empty">
              No properties linked yet. Add a property to this account to get started.
            </p>
          )}
        </TabsContent>
        <TabsContent value="history">
          <div className="panel account-section">
            <h3>Work orders & service reports</h3>
            {visits.map((v) => (
              <button className="account-record" key={v.id} onClick={() => onVisit(v)}>
                <span>
                  <strong>{propertyName(v.propertyId)}</strong>
                  <small>
                    {v.date} · {v.start} · {v.crew}
                  </small>
                  <small>{v.report || 'No client summary recorded'}</small>
                </span>
                <span>
                  {v.status}
                  <small>Report: {v.reportStatus}</small>
                  <small>Open work order →</small>
                </span>
              </button>
            ))}
            {!visits.length && (
              <p className="empty">No service visits recorded for this account yet.</p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="projects">
          <div className="panel account-section">
            <h3>Projects</h3>
            {projects.map((p) => (
              <button className="account-record" key={p.id} onClick={() => onProject(p)}>
                <span>
                  <strong>{p.title}</strong>
                  <small>
                    {propertyName(p.propertyId)} · {p.owner}
                  </small>
                </span>
                <span>
                  {p.stage}
                  <small>
                    Due {p.due} · Budget {cash(p.budget)}
                  </small>
                  <small>Project details →</small>
                </span>
              </button>
            ))}
            {!projects.length && <p className="empty">No projects linked to this account yet.</p>}
          </div>
        </TabsContent>
        <TabsContent value="requests">
          <PortalInbox
            clientId={c.id}
            onAccount={onSelect}
            onRefresh={onRefresh}
            onProposal={onProposal}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
