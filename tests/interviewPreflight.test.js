import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBrowserMediaReadiness,
  getPreflightSummary,
  PREFLIGHT_STATUS,
  stopMediaStream
} from '../src/utils/interviewPreflight.js';

test('preflight summary requires every readiness check to pass', () => {
  const checks = Object.fromEntries(
    ['browser', 'worker', 'microphone', 'speaker'].map((key) => [key, { status: PREFLIGHT_STATUS.PASSED }])
  );

  assert.deepEqual(getPreflightSummary(checks), {
    total: 4,
    passed: 4,
    failed: 0,
    checking: 0,
    isReady: true,
    canRetry: false
  });
});

test('browser readiness reports missing media support', () => {
  const result = getBrowserMediaReadiness({ navigator: {} });
  assert.equal(result.status, PREFLIGHT_STATUS.FAILED);
});

test('stopMediaStream releases every acquired track', () => {
  let stopped = 0;
  stopMediaStream({ getTracks: () => [{ stop: () => stopped += 1 }, { stop: () => stopped += 1 }] });
  assert.equal(stopped, 2);
});
