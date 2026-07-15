import assert from 'node:assert/strict';
import test from 'node:test';

import { applyCors, jsonResponse } from '../worker/src/lib/http.js';

const env = {
  ALLOWED_ORIGINS: 'https://ai-teleprompter.vercel.app,http://localhost:5173'
};

test('Worker CORS allows the configured frontend and capability headers', async () => {
  const request = new Request('https://worker.example/health', {
    headers: { Origin: 'https://ai-teleprompter.vercel.app' }
  });
  const response = applyCors(jsonResponse({ ok: true }), request, env);

  assert.equal(response.headers.get('access-control-allow-origin'), 'https://ai-teleprompter.vercel.app');
  assert.match(response.headers.get('access-control-allow-headers'), /X-AITracker-Client-ID/);
  assert.match(response.headers.get('access-control-allow-headers'), /X-AITracker-Client-Secret/);
  assert.deepEqual(await response.json(), { ok: true });
});

test('Worker CORS does not reflect an unapproved origin', () => {
  const request = new Request('https://worker.example/health', {
    headers: { Origin: 'https://untrusted.example' }
  });
  const response = applyCors(jsonResponse({ ok: true }), request, env);

  assert.equal(response.headers.get('access-control-allow-origin'), null);
});
