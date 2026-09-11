import assert from 'node:assert/strict';
import test from 'node:test';
import { needsMoreSections } from '../src/reader/loading';

test('prefetch stops ahead of the reader and resumes near the end', () => {
  assert.equal(needsMoreSections(0, 2, 6, 1000), true);
  assert.equal(needsMoreSections(0, 12, 31, 1000), false);
  assert.equal(needsMoreSections(8, 12, 31, 1000), true);
  assert.equal(needsMoreSections(11, 12, 31, 31), false);
});

test('restoring a later saved section can load past the initial buffer', () => {
  assert.equal(needsMoreSections(0, 12, 31, 1000, 200), true);
  assert.equal(needsMoreSections(0, 80, 206, 1000, 200), false);
});
