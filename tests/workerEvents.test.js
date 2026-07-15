import assert from 'node:assert/strict';
import test from 'node:test';

import { handleEvents, normalizeBetaEvent } from '../worker/src/routes/events.js';

const capabilityHeaders = {
  'Content-Type': 'application/json',
  'X-AITracker-Client-ID': 'client-1234567890',
  'X-AITracker-Client-Secret': 'secret-that-is-definitely-long-enough-for-capability'
};

test('Worker telemetry rejects unknown names and strips unknown fields', () => {
  assert.equal(normalizeBetaEvent({ id: '1', eventName: 'prompt_saved' }, 'owner'), null);
  const event = normalizeBetaEvent({
    id: '2',
    eventName: 'client_error',
    route: '/interview',
    errorName: 'NetworkError',
    transcript: 'private'
  }, 'owner');
  assert.equal(event.route, '/interview');
  assert.equal(event.errorName, 'NetworkError');
  assert.equal('transcript' in event, false);
});

test('Worker telemetry stores only normalized operational fields', async () => {
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
  const request = new Request('https://worker.example/api/events', {
    method: 'POST',
    headers: capabilityHeaders,
    body: JSON.stringify({
      id: 'event-1',
      eventName: 'page_view',
      mode: 'history',
      route: '/history',
      answer: 'private answer'
    })
  });
  const response = await handleEvents(request, env, new URL(request.url));
  assert.equal(response.status, 202);
  assert.equal(boundValues.includes('private answer'), false);
  assert.equal(boundValues.includes('page_view'), true);
});
