const WORKER_API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_WORKER_API_BASE_URL || '').replace(/\/+$/, '');

function normalizeBaseUrl() {
  if (!WORKER_API_BASE_URL) return '';
  if (/^https?:\/\//i.test(WORKER_API_BASE_URL)) {
    return WORKER_API_BASE_URL;
  }
  return `https://${WORKER_API_BASE_URL}`;
}

export function hasWorkerApi() {
  return Boolean(WORKER_API_BASE_URL);
}

export function getWorkerApiUrl(pathname) {
  if (!hasWorkerApi()) {
    throw new Error('Worker API base URL is not configured');
  }

  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${normalizeBaseUrl()}${normalizedPath}`;
}

export function getWorkerWebSocketUrl(pathname) {
  const url = new URL(getWorkerApiUrl(pathname));
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.blob();
}

export async function requestWorkerJson(pathname, { method = 'POST', body, headers = {}, signal } = {}) {
  const response = await fetch(getWorkerApiUrl(pathname), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: body == null ? undefined : JSON.stringify(body),
    signal
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function requestWorkerMultipart(pathname, formData, { signal } = {}) {
  const response = await fetch(getWorkerApiUrl(pathname), {
    method: 'POST',
    body: formData,
    signal
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export async function requestWorkerBlob(pathname, { method = 'POST', body, headers = {}, signal } = {}) {
  const response = await fetch(getWorkerApiUrl(pathname), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: body == null ? undefined : JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    const payload = await response.json().catch(async () => {
      const text = await response.text().catch(() => '');
      return text ? { message: text } : null;
    });
    const message = payload?.error?.message || payload?.message || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return parseResponse(response);
}
