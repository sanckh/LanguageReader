import assert from 'node:assert/strict';
import test from 'node:test';
import { sentenceRange, toggleWord } from '../src/reader/selection';

test('holding a word selects its sentence without neighboring sentences', () => {
  const tokens = 'Pierwsze zdanie. Drugie zdanie! Ostatnie'.split(/(\s+)/);
  assert.deepEqual(sentenceRange(tokens, 4), { start: 4, end: 6 });
  assert.deepEqual(sentenceRange(tokens, 0), { start: 0, end: 2 });
  assert.deepEqual(sentenceRange(tokens, 8), { start: 8, end: 8 });
});

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
