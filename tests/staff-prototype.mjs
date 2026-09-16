import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shiftMinutes,
  clockMinutes,
  weekStart,
  dayOffset,
  pacificDate,
  pacificTime,
  validateAbsence,
} from '../src/staff/model.ts';
test('time entry subtracts breaks and refuses invalid shifts', () => {
  assert.equal(shiftMinutes('07:00', '15:30', 30), 480);
  for (const v of [
    ['15:00', '07:00', 0],
    ['07:00', '08:00', 60],
    ['07:00', '08:00', -1],
    ['27:00', '29:00', 0],
  ])
    assert.throws(() => shiftMinutes(...v));
});
test('an active break pauses working time and resumes without losing earlier breaks', () => {
  assert.equal(clockMinutes({ start: 0, breakStart: 3600000, breakMs: 0 }, 5400000), 60);
  assert.equal(clockMinutes({ start: 0, breakStart: null, breakMs: 1800000 }, 7200000), 90);
});
test('Pacific dates and weekly buckets do not follow UTC midnight', () => {
  assert.equal(pacificDate(Date.parse('2026-09-17T02:00:00Z')), '2026-09-16');
  assert.equal(pacificTime(Date.parse('2026-12-01T16:00:00Z')), '08:00');
  assert.equal(weekStart('2026-09-20'), '2026-09-14');
  assert.equal(dayOffset('2026-09-28', 6), '2026-10-04');
});
test('attendance date range must contain valid ordered dates', () => {
  assert.doesNotThrow(() => validateAbsence('2026-09-16', '2026-09-17'));
  assert.throws(() => validateAbsence('2026-09-17', '2026-09-16'));
  assert.throws(() => validateAbsence('2026-02-30', '2026-03-02'));
});
