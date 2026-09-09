/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { getCallbackCode } from '../src/auth/callback';

const target = 'language-reader-development://auth/callback';
test('accepts a PKCE code on the exact callback', () => {
  assert.equal(
    getCallbackCode(target + '?code=one-time-code', target),
    'one-time-code',
  );
});
test('ignores another app, host, or path', () => {
  for (const url of [
    'evil://auth/callback?code=x',
    'language-reader-development://evil/callback?code=x',
    'language-reader-development://auth/other?code=x',
  ]) {
    assert.equal(getCallbackCode(url, target), null);
  }
});
test('does not consume an implicit bearer-token callback', () => {
  assert.equal(getCallbackCode(target + '#access_token=secret', target), null);
});
test('provider errors become safe user messages', () => {
  assert.throws(
    () =>
      getCallbackCode(
        target + '?error=denied&error_description=secret',
        target,
      ),
    /declined or the link expired/,
  );
});
test('ordinary links do not trigger an exchange', () => {
  assert.equal(getCallbackCode(target, target), null);
});
