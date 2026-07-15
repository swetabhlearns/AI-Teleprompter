import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyClientError, modeFromRoute, normalizeBetaEvent, trackBetaEvent } from '../src/utils/betaTelemetry.js';

test('beta telemetry only permits allowlisted events and routes', () => {
  assert.equal(normalizeBetaEvent('secret_prompt', { route: '/script' }), null);
  const event = normalizeBetaEvent('page_view', { route: '/script', transcript: 'private' });
  assert.equal(event.route, '/script');
  assert.equal(event.mode, 'script');
  assert.equal('transcript' in event, false);
});

test('client errors are reduced to safe operational classes', () => {
  assert.equal(classifyClientError(new TypeError('Failed to fetch private-url')), 'NetworkError');
  assert.equal(classifyClientError(new Error('Failed to fetch a dynamically imported module')), 'ChunkLoadError');
  assert.equal(classifyClientError({ name: 'NotAllowedError' }), 'MediaError');
  assert.equal(modeFromRoute('/extempore/live'), 'extempore');
});

test('telemetry failures never interrupt the product flow', async () => {
  const tracked = await trackBetaEvent('page_view', { route: '/history' }, async () => {
    throw new Error('offline');
  });
  assert.equal(tracked, false);
});
