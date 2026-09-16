import { setupLanguage } from './language';
import { setupLiveRoute } from './live-route';
import {
  freshState,
  pacificDate,
  pacificTime,
  clockMinutes,
  shiftMinutes,
  validateAbsence,
  validDate,
  weekStart,
  dayOffset,
  type DemoState,
  type Shift,
  type Absence,
} from './model';
const key = 'gmz-staff-prototype-v1';
let state: DemoState = freshState();
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const escape = (value: unknown) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const notify = (message: string) => {
  $('staff-feedback').textContent = message;
};
try {
  const saved = JSON.parse(localStorage.getItem(key) || 'null');
  if (
    saved?.version === 1 &&
    Array.isArray(saved.shifts) &&
    Array.isArray(saved.absences) &&
    typeof saved.stops === 'object' &&
    saved.stops
  ) {
    state = saved;
    if (
      state.clock &&
      (!Number.isFinite(state.clock.start) || !Number.isFinite(state.clock.breakMs))
    )
      state.clock = null;
    state.shifts = state.shifts.filter(
      (s) =>
        validDate(s.date) &&
        Number.isFinite(s.minutes) &&
        s.minutes >= 0 &&
        ['Draft', 'Submitted'].includes(s.status),
    );
    state.absences = state.absences.filter((a) => validDate(a.from) && validDate(a.to));
  }
} catch {
  notify('A new demo has been started.');
}
function save() {
  try {
    localStorage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    notify('Browser storage is unavailable. Your changes will last only until this page closes.');
    return false;
  }
}
const stops = [
  {
    id: 'sample-a',
    name: 'Sample garden A',
    city: 'Redwood City',
    minutes: 65,
    scope: 'Routine garden care',
    note: 'Office request: trim the planting away from the front path. Keep the flowering stems.',
    tasks: [
      'Check the planting beds',
      'Clear paths and collect debris',
      'Record any follow-up work',
    ],
  },
  {
    id: 'sample-b',
    name: 'Sample garden B',
    city: 'Belmont',
    minutes: 60,
    scope: 'Weekly maintenance',
    note: 'Leave the new planting undisturbed. Check for dry spots and report anything that needs a repair.',
    tasks: ['Weed and tidy planting beds', 'Check irrigation visually', 'Blow off hard surfaces'],
  },
  {
    id: 'sample-c',
    name: 'Sample garden C',
    city: 'Hillsborough',
    minutes: 80,
    scope: 'Garden and lawn care',
    note: 'Office request: check the side-yard hedge before pruning. Flag extra work for review.',
    tasks: ['Mow and edge lawn', 'Inspect hedges', 'Leave the property tidy'],
  },
];
let routeDay = pacificDate(),
  editingId = '';
$('today-label').textContent = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})
  .format(Date.now())
  .toUpperCase();
const week = $<HTMLInputElement>('week-of');
week.value = weekStart(pacificDate());
const shiftForm = $<HTMLFormElement>('shift-form'),
  absenceForm = $<HTMLFormElement>('absence-form');
(shiftForm.elements.namedItem('date') as HTMLInputElement).value = pacificDate();
for (const name of ['from', 'to'])
  (absenceForm.elements.namedItem(name) as HTMLInputElement).value = pacificDate();
function renderRoute() {
  routeDay = pacificDate();
  let done = 0;
  $('route-list').innerHTML = stops
    .map((stop, index) => {
      const record = state.stops[routeDay + ':' + stop.id] || { done: false, note: '' };
      if (record.done) done++;
      return `<article class="stop-card ${record.done ? 'is-complete' : ''}"><div class="stop-number">${String(index + 1).padStart(2, '0')}</div><div class="stop-main"><div class="stop-header"><div><p class="staff-kicker">${escape(stop.city)} · ${stop.minutes} MIN PLAN</p><h3>${escape(stop.name)}</h3><p>${escape(stop.scope)}</p></div><span class="staff-badge">${record.done ? 'Completed' : 'Planned'}</span></div><div class="service-note"><strong>Service instructions</strong><p>${escape(stop.note)}</p></div><details><summary>Tasks & my notes</summary><ul>${stop.tasks.map((t) => `<li>${escape(t)}</li>`).join('')}</ul><label class="staff-field">My stop note<textarea maxlength="1000" data-note="${stop.id}" rows="2" placeholder="Add a sample field note">${escape(record.note)}</textarea></label><button class="staff-button compact" data-save-note="${stop.id}">Save note</button></details><button class="staff-button ${record.done ? '' : 'primary'} compact" data-complete="${stop.id}">${record.done ? 'Reopen stop' : 'Mark stop complete'}</button></div></article>`;
    })
    .join('');
  $('route-progress').textContent = `${done} / ${stops.length}`;
}
function renderClock() {
  const clock = state.clock,
    minutes = clock ? clockMinutes(clock) : 0;
  $('clock-status').textContent = clock
    ? clock.breakStart !== null
      ? 'On break'
      : 'Shift in progress'
    : 'Off the clock';
  $('clock-elapsed').textContent =
    String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
  $('clock-toggle').textContent = clock ? 'Clock out' : 'Clock in';
  const pause = $<HTMLButtonElement>('break-toggle');
  pause.hidden = !clock;
  pause.textContent = clock?.breakStart !== null ? 'End break' : 'Start break';
}
function shiftsForWeek() {
  return state.shifts
    .filter((s) => s.date >= week.value && s.date <= dayOffset(week.value, 6))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}
function renderShifts() {
  const shifts = shiftsForWeek();
  $('total-hours').textContent = (shifts.reduce((n, s) => n + s.minutes, 0) / 60).toFixed(2);
  $('draft-count').textContent = String(shifts.filter((s) => s.status === 'Draft').length);
  $('submitted-count').textContent = String(shifts.filter((s) => s.status === 'Submitted').length);
  $('shift-list').innerHTML = shifts.length
    ? shifts
        .map(
          (s) =>
            `<article class="shift-row"><div><strong>${escape(s.date)}</strong><p>${escape(s.start)}–${escape(s.end)} · ${s.breakMinutes} min break</p>${s.notes ? `<p data-no-translate>${escape(s.notes)}</p>` : ''}</div><strong>${(s.minutes / 60).toFixed(2)} h</strong><span class="staff-badge">${s.status === 'Submitted' ? 'Submitted · demo' : 'Draft'}</span>${s.status === 'Draft' ? `<button class="text-action" data-edit="${escape(s.id)}">Edit</button>` : '<small>Awaiting review in demo</small>'}</article>`,
        )
        .join('')
    : '<p class="staff-empty">No entries this week. Clock a shift or add a missed time entry.</p>';
  $<HTMLButtonElement>('submit-week').disabled =
    !shifts.some((s) => s.status === 'Draft') || !!state.clock;
}
function renderAbsences() {
  $('absence-list').innerHTML = state.absences.length
    ? state.absences
        .slice()
        .reverse()
        .map(
          (a) =>
            `<article class="absence-card"><span class="staff-badge">Awaiting review · demo</span><h3>${escape(a.kind)}</h3><p>${escape(a.from)}${a.to === a.from ? '' : ' through ' + escape(a.to)}</p>${a.notes ? `<p data-no-translate>${escape(a.notes)}</p>` : ''}</article>`,
        )
        .join('')
    : '<p class="staff-empty">No days away recorded in this demo.</p>';
}
function render() {
  renderRoute();
  renderClock();
  renderShifts();
  renderAbsences();
}
function navigate() {
  const view = location.hash.slice(1);
  const selected = ['route', 'timesheets', 'attendance'].includes(view) ? view : 'route';
  for (const name of ['route', 'timesheets', 'attendance'])
    $('section-' + name).hidden = name !== selected;
  document.querySelectorAll<HTMLAnchorElement>('[data-section]').forEach((a) => {
    if (a.dataset.section === selected) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}
window.addEventListener('hashchange', navigate);
async function confirmAction(title: string, message: string) {
  const dialog = $<HTMLDialogElement>('confirm-dialog');
  $('confirm-title').textContent = title;
  $('confirm-message').textContent = message;
  dialog.returnValue = 'cancel';
  dialog.showModal();
  return new Promise<boolean>((resolve) =>
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), {
      once: true,
    }),
  );
}
$('clock-toggle').addEventListener('click', async () => {
  if (!state.clock) {
    state.clock = { start: Date.now(), breakStart: null, breakMs: 0 };
    save();
    renderClock();
    renderShifts();
    notify('Demo shift started.');
    return;
  }
  if (
    !(await confirmAction(
      'Finish this shift?',
      'Working time will be saved as a draft for you to review.',
    ))
  )
    return;
  const now = Date.now(),
    clock = state.clock;
  if (!clock) return;
  const minutes = clockMinutes(clock, now);
  if (minutes < 1) {
    notify('Record at least one minute of working time before clocking out.');
    return;
  }
  if (now - clock.start > 24 * 60 * 60 * 1000) {
    notify(
      'This demo clock is over 24 hours old. Reset the clock, then add each day as a manual entry.',
    );
    return;
  }
  const pause = Math.floor(
    (clock.breakMs + (clock.breakStart === null ? 0 : now - clock.breakStart)) / 60000,
  );
  state.shifts.push({
    id: crypto.randomUUID(),
    date: pacificDate(clock.start),
    start: pacificTime(clock.start),
    end: pacificTime(now) + (pacificDate(clock.start) !== pacificDate(now) ? ' (+1 day)' : ''),
    breakMinutes: pause,
    minutes,
    notes: '',
    status: 'Draft',
  });
  state.clock = null;
  save();
  renderClock();
  renderShifts();
  notify('Shift saved as a demo draft. Review it in Timesheets.');
});
$('break-toggle').addEventListener('click', () => {
  const clock = state.clock;
  if (!clock) return;
  if (clock.breakStart === null) clock.breakStart = Date.now();
  else {
    clock.breakMs += Date.now() - clock.breakStart;
    clock.breakStart = null;
  }
  save();
  renderClock();
});
$('route-list').addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!button) return;
  const id = button.dataset.complete || button.dataset.saveNote;
  if (!id) return;
  const stopKey = routeDay + ':' + id,
    record = state.stops[stopKey] || { done: false, note: '' };
  const input = document.querySelector<HTMLTextAreaElement>(`[data-note="${id}"]`);
  record.note = input?.value.slice(0, 1000) || '';
  if (button.dataset.complete) record.done = !record.done;
  state.stops[stopKey] = record;
  save();
  renderRoute();
  notify(button.dataset.complete ? 'Stop updated in demo.' : 'Field note saved in this browser.');
});
week.addEventListener('change', () => {
  if (!validDate(week.value)) week.value = weekStart(pacificDate());
  week.value = weekStart(week.value);
  renderShifts();
});
shiftForm.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const form = new FormData(shiftForm),
      date = String(form.get('date')),
      start = String(form.get('start')),
      end = String(form.get('end')),
      pause = Number(form.get('breakMinutes'));
    if (!validDate(date) || date > pacificDate()) throw Error('Choose today or an earlier date.');
    const minutes = shiftMinutes(start, end, pause);
    const existing = state.shifts.find((s) => s.id === editingId);
    if (existing?.status === 'Submitted') throw Error('Submitted shifts are locked in this demo.');
    if (
      state.shifts.some(
        (s) => s.id !== editingId && s.date === date && start < s.end && end > s.start,
      )
    )
      throw Error('This overlaps another shift. Edit the existing entry.');
    const shift: Shift = {
      id: editingId || crypto.randomUUID(),
      date,
      start,
      end,
      breakMinutes: pause,
      minutes,
      notes: String(form.get('notes') || '').slice(0, 1000),
      status: 'Draft',
    };
    if (existing) Object.assign(existing, shift);
    else state.shifts.push(shift);
    editingId = '';
    save();
    shiftForm.reset();
    (shiftForm.elements.namedItem('date') as HTMLInputElement).value = pacificDate();
    week.value = weekStart(date);
    renderShifts();
    notify('Demo time entry saved.');
  } catch (e) {
    notify((e as Error).message);
  }
});
$('shift-list').addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-edit]');
  const shift = state.shifts.find((s) => s.id === button?.dataset.edit);
  if (!shift) return;
  if (shift.end.includes('+1 day')) {
    notify('Overnight clock entries are read-only in this prototype.');
    return;
  }
  editingId = shift.id;
  for (const name of ['date', 'start', 'end', 'breakMinutes', 'notes'] as const)
    (shiftForm.elements.namedItem(name) as HTMLInputElement).value = String(shift[name]);
  const details = shiftForm.closest('details')!;
  details.open = true;
  shiftForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  notify('Editing the selected draft. Save below to replace it.');
});
$('submit-week').addEventListener('click', async () => {
  if (state.clock) {
    notify('Clock out before submitting the week.');
    return;
  }
  if (
    !(await confirmAction(
      'Submit this demo week?',
      'Draft entries will be locked as submitted in this browser. Nothing is sent to Admin or payroll.',
    ))
  )
    return;
  shiftsForWeek()
    .filter((s) => s.status === 'Draft')
    .forEach((s) => (s.status = 'Submitted'));
  save();
  renderShifts();
  notify('Week submitted in demo only.');
});
absenceForm.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const f = new FormData(absenceForm),
      from = String(f.get('from')),
      to = String(f.get('to'));
    validateAbsence(from, to);
    if (state.absences.some((a) => a.from <= to && a.to >= from))
      throw Error('This overlaps a day-away request already in the demo.');
    state.absences.push({
      id: crypto.randomUUID(),
      from,
      to,
      kind: String(f.get('kind')) as Absence['kind'],
      notes: String(f.get('notes') || '').slice(0, 1000),
    });
    save();
    renderAbsences();
    notify('Day-away request saved in demo only.');
  } catch (e) {
    notify((e as Error).message);
  }
});
$('reset-demo').addEventListener('click', async () => {
  if (
    await confirmAction(
      'Reset the prototype?',
      'This clears the demo clock, notes, time entries, and day-away requests on this browser.',
    )
  ) {
    state = freshState();
    editingId = '';
    save();
    render();
    notify('Demo reset.');
  }
});
setInterval(() => {
  renderClock();
  if (routeDay !== pacificDate()) renderRoute();
}, 15000);
navigate();
render();

setupLanguage();
setupLiveRoute();
