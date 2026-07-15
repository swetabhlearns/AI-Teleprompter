import assert from 'node:assert/strict';
import test from 'node:test';

import { parseJsonBody } from '../worker/src/lib/http.js';
import {
  assertRequestBodySize,
  enforceRequestProtection,
  MAX_AUDIO_UPLOAD_BYTES,
  validateInterviewDuration
} from '../worker/src/lib/protection.js';
import { handleInterviewLiveSessions } from '../worker/src/routes/interviewLiveSessions.js';

test('bounded JSON parsing rejects streamed bodies beyond the limit', async () => {
  const request = new Request('https://worker.example/api/script/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt: 'x'.repeat(64) })
  });

  await assert.rejects(() => parseJsonBody(request, 32), (error) => {
    assert.equal(error.status, 413);
    assert.equal(error.code, 'payload_too_large');
    return true;
  });
});

test('audio uploads require a bounded content length', () => {
  const missingLength = new Request('https://worker.example/api/transcribe', { method: 'POST', body: 'audio' });
  const oversized = new Request('https://worker.example/api/transcribe', {
    method: 'POST',
    headers: { 'Content-Length': String(MAX_AUDIO_UPLOAD_BYTES + 1) },
    body: 'audio'
  });

  assert.throws(() => assertRequestBodySize(missingLength, MAX_AUDIO_UPLOAD_BYTES, { requireLength: true }), { status: 411 });
  assert.throws(() => assertRequestBodySize(oversized, MAX_AUDIO_UPLOAD_BYTES), { status: 413 });
});

test('interview duration is capped at twenty minutes', () => {
  assert.equal(validateInterviewDuration({ duration: 20 }), 20);
  assert.throws(() => validateInterviewDuration({ duration: 21 }), { code: 'invalid_interview_duration' });
  assert.throws(() => validateInterviewDuration({ duration: 0 }), { code: 'invalid_interview_duration' });
});

test('live-session duration validation is returned as a client error', async () => {
  const request = new Request('https://worker.example/api/interview/live-sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AITracker-Client-ID': '12345678-1234-4123-8123-123456789abc',
      'X-AITracker-Client-Secret': '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    },
    body: JSON.stringify({ config: { duration: 21 } })
  });
  const response = await handleInterviewLiveSessions(request, {}, new URL(request.url));

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'invalid_interview_duration');
});

test('expensive AI routes return 429 when the binding rejects the actor', async () => {
  const request = new Request('https://worker.example/api/script/generate', {
    method: 'POST',
    headers: {
      'Content-Length': '2',
      'CF-Connecting-IP': '203.0.113.4'
    },
    body: '{}'
  });
  const response = await enforceRequestProtection(request, {
    AI_RATE_LIMITER: { limit: async () => ({ success: false }) }
  }, new URL(request.url));

  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.equal((await response.json()).error.code, 'rate_limit_exceeded');
});
