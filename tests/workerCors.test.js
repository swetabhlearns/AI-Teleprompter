import assert from 'node:assert/strict';
import test from 'node:test';

import { applyCors, jsonResponse } from '../worker/src/lib/http.js';

const env = {
  ALLOWED_ORIGINS: 'https://*.vercel.app,http://localhost:5173'
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

test('Worker CORS allows HTTPS Vercel subdomains but rejects lookalikes', () => {
  const previewOrigin = 'https://ai-teleprompter-281ff2k8t-swetabhlearns-projects.vercel.app';
  const previewResponse = applyCors(jsonResponse({ ok: true }), new Request('https://worker.example/health', {
    headers: { Origin: previewOrigin }
  }), env);
  const lookalikeResponse = applyCors(jsonResponse({ ok: true }), new Request('https://worker.example/health', {
    headers: { Origin: 'https://preview.vercel.app.evil.example' }
  }), env);

  assert.equal(previewResponse.headers.get('access-control-allow-origin'), previewOrigin);
  assert.equal(lookalikeResponse.headers.get('access-control-allow-origin'), null);
});
