/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { isOnboardingRequired, needsAutoStart } from '../src/assessment/state';

test('onboarding is required until it is completed', () => {
  assert.equal(isOnboardingRequired(null), false);
  assert.equal(
    isOnboardingRequired({ state: 'not_started', assessment: null }),
    true,
  );
  assert.equal(
    isOnboardingRequired({
      state: 'in_progress',
      assessment: {
        id: 'a',
        status: 'in_progress',
        completedAt: null,
        language: { code: 'pl', name: 'Polish' },
      },
    }),
    true,
  );
  assert.equal(
    isOnboardingRequired({ state: 'completed', assessment: null }),
    false,
  );
});

test('only a never-started snapshot triggers an automatic start', () => {
  assert.equal(needsAutoStart(null), false);
  assert.equal(
    needsAutoStart({ state: 'not_started', assessment: null }),
    true,
  );
  assert.equal(
    needsAutoStart({
      state: 'in_progress',
      assessment: {
        id: 'a',
        status: 'in_progress',
        completedAt: null,
        language: { code: 'pl', name: 'Polish' },
      },
    }),
    false,
  );
  assert.equal(needsAutoStart({ state: 'completed', assessment: null }), false);
});
