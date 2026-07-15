import assert from 'node:assert/strict';
import test from 'node:test';

import { handleFeedback, normalizeFeedbackRecord } from '../worker/src/routes/feedback.js';

const capabilityHeaders = {
  'Content-Type': 'application/json',
  'X-AITracker-Client-ID': 'client-1234567890',
  'X-AITracker-Client-Secret': 'secret-that-is-definitely-long-enough-for-capability'
};

test('feedback normalization bounds optional user text and rejects incomplete session ratings', () => {
  assert.equal(normalizeFeedbackRecord({ id: '1', kind: 'session' }, 'owner'), null);
  const feedback = normalizeFeedbackRecord({
    id: 'feedback-1',
    kind: 'session',
    sentiment: 'helpful',
    category: 'session_quality',
    mode: 'interview',
    message: 'x'.repeat(1200)
  }, 'owner');

  assert.equal(feedback.message.length, 1000);
  assert.equal(feedback.ownerHash, 'owner');
  assert.equal(feedback.mode, 'interview');
});

test('feedback route requires an anonymous capability', async () => {
  const request = new Request('https://worker.example/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'feedback-1', kind: 'beta' })
  });
  const response = await handleFeedback(request, {}, new URL(request.url));
  assert.equal(response.status, 401);
});

test('feedback route stores only the normalized record', async () => {
  const boundValues = [];
  const env = {
    DB: {
      prepare: () => ({
        bind: (...values) => {
          boundValues.push(...values);
          return { run: async () => ({ success: true }) };
        }
      })
    }
  };
  const request = new Request('https://worker.example/api/feedback', {
    method: 'POST',
    headers: capabilityHeaders,
    body: JSON.stringify({
      id: 'feedback-2',
      kind: 'session',
      sentiment: 'not_helpful',
      category: 'technical_issue',
      mode: 'extempore',
      activityId: 'extempore:1',
      message: 'The microphone stopped.',
      transcript: 'must not be stored'
    })
  });
  const response = await handleFeedback(request, env, new URL(request.url));

  assert.equal(response.status, 201);
  assert.equal(boundValues.includes('The microphone stopped.'), true);
  assert.equal(boundValues.includes('must not be stored'), false);
});
