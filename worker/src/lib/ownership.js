import { errorResponse } from './http.js';

const CLIENT_ID_HEADER = 'X-AITracker-Client-ID';
const CLIENT_SECRET_HEADER = 'X-AITracker-Client-Secret';

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256(value) {
  const input = new TextEncoder().encode(String(value || ''));
  return bytesToHex(await crypto.subtle.digest('SHA-256', input));
}

export async function getOwnerContext(request) {
  const clientId = String(request.headers.get(CLIENT_ID_HEADER) || '').trim();
  const clientSecret = String(request.headers.get(CLIENT_SECRET_HEADER) || '').trim();

  if (clientId.length < 16 || clientId.length > 128 || clientSecret.length < 40 || clientSecret.length > 256) {
    return null;
  }

  return {
    clientId,
    ownerHash: await sha256(`${clientId}:${clientSecret}`)
  };
}

export async function requireOwnerContext(request) {
  const owner = await getOwnerContext(request);
  if (!owner) {
    const error = new Error('This browser does not have a valid anonymous access capability.');
    error.status = 401;
    error.code = 'anonymous_capability_required';
    throw error;
  }
  return owner;
}

export function ownerErrorResponse(error) {
  return errorResponse(error?.code || 'anonymous_capability_required', error?.message || 'Anonymous access capability required', error?.status || 401);
}

export function createLiveAccessToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}
