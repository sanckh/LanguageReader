import assert from 'node:assert/strict';
import test from 'node:test';
import { weeklyChange } from '../src/home/weeklyChange';

test('weekly vocabulary changes require an actual seven-day baseline', () => {
  const now = new Date('2026-09-11T12:00:00Z');
  assert.equal(weeklyChange([], 100, now), null);
  assert.equal(
    weeklyChange([{ day: '2026-09-10', known: 90 }], 100, now),
    null,
  );
  assert.equal(weeklyChange([{ day: '2026-09-04', known: 90 }], 100, now), 10);
  assert.equal(
    weeklyChange([{ day: '2026-09-04', known: 110 }], 100, now),
    -10,
  );
  assert.equal(weeklyChange([{ day: '2026-09-04', known: 100 }], 100, now), 0);
});
