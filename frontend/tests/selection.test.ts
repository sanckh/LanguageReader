import assert from 'node:assert/strict';
import test from 'node:test';
import { toggleWord } from '../src/reader/selection';

test('adjacent taps extend a phrase in either direction; tapping selected text clears it', () => {
  const tokens = 'Czas Białego Zimna i Białego'.split(/(\s+)/);
  const first = toggleWord(tokens, null, 2);
  assert.deepEqual(first, { start: 2, end: 2 });
  const next = toggleWord(tokens, first, 4);
  assert.deepEqual(next, { start: 2, end: 4 });
  const previous = toggleWord(tokens, next, 0);
  assert.deepEqual(previous, { start: 0, end: 4 });
  assert.equal(toggleWord(tokens, previous, 2), null);
  assert.deepEqual(toggleWord(tokens, first, 8), { start: 8, end: 8 });
});
