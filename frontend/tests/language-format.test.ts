/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { describeForm } from '../src/language/features';

test('labels a noun form as case + number + gender', () => {
  assert.equal(
    describeForm({ case: 'gen', number: 'sg', gender: 'm3' }),
    'genitive singular masculine',
  );
});

test('labels a verb form as person + tense + aspect', () => {
  assert.equal(
    describeForm({
      person: 'ter',
      tense: 'present',
      aspect: 'imperf',
      number: 'sg',
    }),
    'third person present imperfective singular',
  );
});

test('orders consistently regardless of key insertion order', () => {
  assert.equal(
    describeForm({ number: 'pl', case: 'inst' }),
    'instrumental plural',
  );
});

test('an empty feature bag yields an empty label', () => {
  assert.equal(describeForm({}), '');
});

test('unknown codes fall back to the raw value', () => {
  assert.equal(describeForm({ case: 'zzz' }), 'zzz');
  assert.equal(describeForm({ case: 'gen' }, 'de'), 'gen');
});
