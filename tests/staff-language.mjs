import test from 'node:test';
import assert from 'node:assert/strict';
import { translateCopy } from '../src/staff/language.ts';
test('Spanish labels preserve unrelated names and formatted time values', () => {
  assert.equal(translateCopy('Sick day', 'es'), 'Día por enfermedad');
  assert.equal(translateCopy('Sick day', 'en'), 'Sick day');
  assert.equal(
    translateCopy('07:00–15:30 · 30 min break', 'es'),
    '07:00–15:30 · 30 min de descanso',
  );
  assert.equal(translateCopy('Redwood City', 'es'), 'Redwood City');
});
