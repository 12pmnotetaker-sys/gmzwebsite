'use client';
import { useState } from 'react';
import type { State, Command } from '@/operations/lib/operations/model';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/operations/components/ui/dialog';
const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export default function Absences({
  data,
  save,
  busy,
}: {
  data: State;
  save: (c: Command, close?: boolean) => Promise<boolean>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<any>(null),
    [filter, setFilter] = useState('All');
  const rows = data.absences
    .filter((r) => filter === 'All' || r.kind === filter)
    .slice()
    .sort((a, b) => b.from.localeCompare(a.from));
  const set = (key: string, value: string) => setDraft((d: any) => ({ ...d, [key]: value }));
  return (
    <section className="panel account-section">
      <div className="flex-between">
        <div>
          <h2>Sick days & missed days</h2>
          <p className="muted">
            Office-recorded absences. These do not add worked hours or change payroll.
          </p>
        </div>
        <button
          className="btn"
          disabled={busy}
          onClick={() =>
            setDraft({
              id: crypto.randomUUID(),
              employeeId: '',
              employeeName: '',
              from: today(),
              to: today(),
              kind: 'Sick day',
              notes: '',
              status: 'pending',
              reviewedAt: null,
            })
          }
        >
          Record absence
        </button>
      </div>
      <div className="exp-actions">
        {['All', 'Sick day', 'Missed day', 'Time off'].map((v) => (
          <button
            className={'btn ' + (filter === v ? '' : 'secondary')}
            aria-pressed={filter === v}
            key={v}
            onClick={() => setFilter(v)}
          >
            {v === 'All'
              ? 'All absences'
              : v === 'Sick day'
                ? 'Sick days'
                : v === 'Missed day'
                  ? 'Days missed'
                  : 'Other time off'}
          </button>
        ))}
      </div>
      {!rows.length && (
        <p className="empty">
          No {filter === 'All' ? 'absences' : filter.toLowerCase() + ' entries'} recorded.
        </p>
      )}
      {rows.map((r) => (
        <article className="portal-inbox-row" key={r.id}>
          <div className="flex-between">
            <div>
              <h3>{r.employeeName}</h3>
              <p>
                {r.kind} · {r.from}
                {r.to !== r.from ? ' through ' + r.to : ''}
              </p>
            </div>
            <span className="chip">
              {r.status === 'approved'
                ? 'Approved'
                : r.status === 'rejected'
                  ? 'Returned'
                  : 'Pending review'}
            </span>
          </div>
          <p className="account-notes">{r.notes}</p>
          <div className="exp-actions">
            {r.status !== 'approved' && (
              <>
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    save(
                      {
                        type: 'extension',
                        action: 'reviewAbsence',
                        value: { id: r.id, status: 'approved', notes: r.notes },
                      },
                      false,
                    )
                  }
                >
                  Approve absence
                </button>
                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => setDraft({ ...r })}
                >
                  Edit / review
                </button>
              </>
            )}
            {r.status === 'approved' && (
              <button
                className="text-button"
                disabled={busy}
                onClick={() =>
                  save(
                    {
                      type: 'extension',
                      action: 'reviewAbsence',
                      value: { id: r.id, status: 'pending', notes: r.notes },
                    },
                    false,
                  )
                }
              >
                Reopen for correction
              </button>
            )}
          </div>
        </article>
      ))}
      <Dialog open={!!draft} onOpenChange={(v) => !v && !busy && setDraft(null)}>
        <DialogContent className="editor">
          <DialogHeader>
            <DialogTitle>Record absence</DialogTitle>
            <DialogDescription>
              Record attendance dates and a short office note. Leave medical details out. Staff
              account matching will be added with GMZ Staff.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              className="editor-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await save({ type: 'extension', action: 'absence', value: draft }, false))
                  setDraft(null);
              }}
            >
              <label className="field">
                <span>Staff name</span>
                <input
                  required
                  maxLength={200}
                  list="absence-staff"
                  value={draft.employeeName}
                  onChange={(e) => set('employeeName', e.target.value)}
                />
                <datalist id="absence-staff">
                  {Array.from(
                    new Set([
                      ...data.timesheets.map((t) => t.employeeName),
                      ...data.absences.map((a) => a.employeeName),
                    ]),
                  ).map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </label>
              <label className="field">
                <span>Type</span>
                <select value={draft.kind} onChange={(e) => set('kind', e.target.value)}>
                  <option>Sick day</option>
                  <option>Missed day</option>
                  <option>Time off</option>
                </select>
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>First day</span>
                  <input
                    required
                    type="date"
                    value={draft.from}
                    onChange={(e) => set('from', e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Last day</span>
                  <input
                    required
                    type="date"
                    min={draft.from}
                    value={draft.to}
                    onChange={(e) => set('to', e.target.value)}
                  />
                </label>
              </div>
              <label className="field">
                <span>Office note</span>
                <textarea
                  rows={3}
                  maxLength={4000}
                  value={draft.notes}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </label>
              <button className="btn" disabled={busy}>
                Save for review
              </button>
              {data.absences.some((r) => r.id === draft.id) && (
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy || !draft.notes.trim()}
                  onClick={async () => {
                    if (
                      await save(
                        {
                          type: 'extension',
                          action: 'reviewAbsence',
                          value: { id: draft.id, status: 'rejected', notes: draft.notes },
                        },
                        false,
                      )
                    )
                      setDraft(null);
                  }}
                >
                  Return with note
                </button>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
