export function jsonResponse(payload, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');

  return new Response(JSON.stringify(payload, null, 2), {
    ...init,
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
