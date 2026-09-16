export type Shift = {
  id: string;
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
  minutes: number;
  notes: string;
  status: 'Draft' | 'Submitted';
};
export type Absence = {
  id: string;
  from: string;
  to: string;
  kind: 'Sick day' | 'Missed day' | 'Time off';
  notes: string;
};
export type Clock = { start: number; breakStart: number | null; breakMs: number };
export type DemoState = {
  version: 1;
  clock: Clock | null;
  shifts: Shift[];
  absences: Absence[];
  stops: Record<string, { done: boolean; note: string }>;
};
export const freshState = (): DemoState => ({
  version: 1,
  clock: null,
  shifts: [],
  absences: [],
  stops: {},
});
export const pacificDate = (time = Date.now()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(time);
export const pacificTime = (time = Date.now()) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(time);
export function shiftMinutes(start: string, end: string, pause: number) {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end))
    throw Error('Enter a start and end time.');
  const read = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    if (h > 23 || m > 59) throw Error('Check the times.');
    return h * 60 + m;
  };
  const elapsed = read(end) - read(start);
  if (elapsed <= 0) throw Error('End time must be after start time. Enter one day per shift.');
  if (!Number.isInteger(pause) || pause < 0 || pause >= elapsed)
    throw Error('Break must be shorter than the shift.');
  return elapsed - pause;
}
export function clockMinutes(clock: Clock, now = Date.now()) {
  return Math.max(
    0,
    Math.floor(
      (now -
        clock.start -
        clock.breakMs -
        (clock.breakStart === null ? 0 : now - clock.breakStart)) /
        60000,
    ),
  );
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !isNaN(Date.parse(value)) &&
    new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value
  );
}
export function validateAbsence(from: string, to: string) {
  if (!validDate(from) || !validDate(to) || to < from) throw Error('Choose a valid date range.');
}
export function weekStart(date: string) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
export function dayOffset(date: string, offset: number) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
