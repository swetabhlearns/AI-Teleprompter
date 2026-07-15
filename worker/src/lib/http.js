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

export function applyCors(response, request, env = {}) {
  if (response.status === 101) return response;

  const origin = String(request.headers.get('Origin') || '').replace(/\/$/, '');
  const headers = new Headers(response.headers);
  if (origin && getAllowedOrigins(env).includes(origin)) {
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

export function errorResponse(code, message, status = 400, details = null) {
  return jsonResponse(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details ? { details } : {})
      }
    },
    { status }
  );
}

export function parseJsonBody(request) {
  return request.json().catch(() => null);
}

export function isUuidLike(value) {
  return typeof value === 'string' && value.length > 0;
}
