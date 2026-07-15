export function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');

  return new Response(JSON.stringify(payload, null, 2), {
    ...init,
    headers
  });
}

function getAllowedOrigins(env = {}) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function matchesAllowedOrigin(origin, allowedOrigin) {
  if (!allowedOrigin.includes('*')) return origin === allowedOrigin;

  const [prefix, suffix, ...extraParts] = allowedOrigin.split('*');
  if (extraParts.length > 0 || !prefix || !suffix) return false;
  if (!origin.startsWith(prefix) || !origin.endsWith(suffix)) return false;

  const wildcardValue = origin.slice(prefix.length, origin.length - suffix.length);
  return /^[a-z0-9-]+$/i.test(wildcardValue);
}

export function applyCors(response, request, env = {}) {
  if (response.status === 101) return response;

  const origin = String(request.headers.get('Origin') || '').replace(/\/$/, '');
  const headers = new Headers(response.headers);
  if (origin && getAllowedOrigins(env).some((allowedOrigin) => matchesAllowedOrigin(origin, allowedOrigin))) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  } else {
    headers.delete('Access-Control-Allow-Origin');
  }
  headers.set('Access-Control-Allow-Headers', 'Content-Type, X-AITracker-Client-ID, X-AITracker-Client-Secret');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  headers.set('Access-Control-Max-Age', '86400');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export function errorResponse(code, message, status = 400, details = null, responseHeaders = {}) {
  return jsonResponse(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details ? { details } : {})
      }
    },
    { status, headers: responseHeaders }
  );
}

export async function parseJsonBody(request, maxBytes = 256 * 1024) {
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        const error = new Error(`Request body exceeds the ${maxBytes} byte limit.`);
        error.code = 'payload_too_large';
        error.status = 413;
        throw error;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export function isUuidLike(value) {
  return typeof value === 'string' && value.length > 0;
}
