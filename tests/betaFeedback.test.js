import assert from 'node:assert/strict';
import test from 'node:test';

import {
  flushQueuedFeedback,
  loadFeedbackReceipts,
  loadQueuedFeedback,
  normalizeBetaFeedback,
  submitBetaFeedback
} from '../src/utils/betaFeedback.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
}

test('beta feedback excludes unknown fields and bounds the optional note', () => {
  const feedback = normalizeBetaFeedback({
    kind: 'session',
    sentiment: 'helpful',
    mode: 'script',
    message: 'x'.repeat(1200),
    transcript: 'private transcript'
  });

  assert.equal(feedback.message.length, 1000);
  assert.equal('transcript' in feedback, false);
});

test('failed feedback queues locally and records a session receipt', async () => {
  const storage = createStorage();
  const result = await submitBetaFeedback({
    kind: 'session',
    sentiment: 'not_helpful',
    activityId: 'script:1'
  }, {
    storage,
    submitter: async () => { throw new Error('offline'); }
  });

  assert.equal(result.status, 'queued');
  assert.equal(loadQueuedFeedback(storage).length, 1);
  assert.equal(loadFeedbackReceipts(storage)['script:1'].status, 'queued');
});

test('queued feedback flushes later without creating a duplicate', async () => {
  const storage = createStorage();
  await submitBetaFeedback({ kind: 'session', sentiment: 'helpful', activityId: 'interview:1' }, {
    storage,
    submitter: async () => { throw new Error('offline'); }
  });
  const submitted = [];
  const result = await flushQueuedFeedback({
    storage,
    submitter: async (feedback) => submitted.push(feedback.id)
  });

  assert.equal(result.sentCount, 1);
  assert.equal(result.remainingCount, 0);
  assert.equal(submitted.length, 1);
  assert.equal(loadFeedbackReceipts(storage)['interview:1'].status, 'sent');
});
