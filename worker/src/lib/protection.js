import { errorResponse } from './http.js';
import { getOwnerContext } from './ownership.js';

export const MAX_JSON_BYTES = 256 * 1024;
export const MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_INTERVIEW_DURATION_MINUTES = 20;

const GENERATIVE_PATHS = new Set([
  '/api/script/generate',
  '/api/script/refine',
  '/api/extempore/topics',
  '/api/extempore/coach',
  '/api/tts/sarvam'
]);

function requestActor(request, owner) {
  return owner?.ownerHash
    || String(request.headers.get('CF-Connecting-IP') || '').trim()
    || 'anonymous';
}

function requestSizeError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

export function assertRequestBodySize(request, maxBytes, { requireLength = false } = {}) {
  const value = request.headers.get('Content-Length');
  if (!value) {
    if (requireLength) throw requestSizeError('content_length_required', 'Content-Length is required for this upload.', 411);
    return;
  }

  const length = Number(value);
  if (!Number.isFinite(length) || length < 0) {
    throw requestSizeError('invalid_content_length', 'Content-Length must be a valid non-negative number.', 400);
  }
  if (length > maxBytes) {
    throw requestSizeError('payload_too_large', `Request body exceeds the ${maxBytes} byte limit.`, 413);
  }
}

export function validateInterviewDuration(config = {}) {
  const duration = Number(config?.duration ?? 10);
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_INTERVIEW_DURATION_MINUTES) {
    const error = new Error(`Interview duration must be between 1 and ${MAX_INTERVIEW_DURATION_MINUTES} minutes.`);
    error.code = 'invalid_interview_duration';
    error.status = 400;
    throw error;
  }
  return duration;
}

async function applyRateLimit(binding, key, message) {
  if (!binding?.limit) return null;
  const { success } = await binding.limit({ key });
  if (success) return null;

  return errorResponse('rate_limit_exceeded', message, 429, null, {
    'Retry-After': '60'
  });
}

export async function enforceRequestProtection(request, env, url) {
  if (!['POST', 'PATCH', 'DELETE'].includes(request.method)) return null;

  if (url.pathname === '/api/transcribe') {
    assertRequestBodySize(request, MAX_AUDIO_UPLOAD_BYTES, { requireLength: true });
  } else {
    assertRequestBodySize(request, MAX_JSON_BYTES);
  }

  const owner = await getOwnerContext(request);
  const actor = requestActor(request, owner);

  if (url.pathname === '/api/interview/live-sessions' && request.method === 'POST') {
    return applyRateLimit(env.LIVE_RATE_LIMITER, actor, 'Too many live interview sessions were started. Try again in a minute.');
  }

  if (url.pathname === '/api/feedback') {
    return applyRateLimit(env.FEEDBACK_RATE_LIMITER, actor, 'Too many feedback submissions. Try again in a minute.');
  }

  if (url.pathname === '/api/data') {
    return applyRateLimit(env.FEEDBACK_RATE_LIMITER, actor, 'Too many beta data deletion attempts. Try again in a minute.');
  }

  if (url.pathname === '/api/events') {
    return applyRateLimit(env.TELEMETRY_RATE_LIMITER, actor, 'Too many operational events. Try again in a minute.');
  }

  if (url.pathname === '/api/transcribe' || url.pathname.startsWith('/api/tts/elevenlabs')) {
    return applyRateLimit(env.MEDIA_RATE_LIMITER, actor, 'Too many audio requests. Try again in a minute.');
  }

  if (GENERATIVE_PATHS.has(url.pathname)) {
    return applyRateLimit(env.AI_RATE_LIMITER, actor, 'Too many AI requests. Try again in a minute.');
  }

  return null;
}

export function protectionErrorResponse(error) {
  if (!error?.status || !error?.code) return null;
  return errorResponse(error.code, error.message, error.status);
}
