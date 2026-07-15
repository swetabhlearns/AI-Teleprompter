import { hasWorkerApi, getWorkerApiUrl, getWorkerWebSocketUrl } from '../utils/workerApi.js';

async function parseJsonResponse(response) {
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

async function parseBinaryResponse(response) {
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

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.blob();
}

async function requestJson(pathname, { method = 'POST', body, headers = {}, signal } = {}) {
  const response = await fetch(getWorkerApiUrl(pathname), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: body == null ? undefined : JSON.stringify(body),
    signal
  });

  return parseJsonResponse(response);
}

async function requestMultipart(pathname, formData, { signal } = {}) {
  const response = await fetch(getWorkerApiUrl(pathname), {
    method: 'POST',
    body: formData,
    signal
  });

  return parseJsonResponse(response);
}

async function requestBinary(pathname, { method = 'POST', body, headers = {}, signal } = {}) {
  const response = await fetch(getWorkerApiUrl(pathname), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: body == null ? undefined : JSON.stringify(body),
    signal
  });

  return parseBinaryResponse(response);
}

function buildCompletionPayload({ model, messages, temperature, max_tokens, response_format }) {
  return {
    model,
    messages,
    temperature,
    max_tokens,
    ...(response_format ? { response_format } : {})
  };
}

export const workerApi = {
  hasWorkerApi,
  getHealth() {
    return requestJson('/health', { method: 'GET' });
  },
  getManifest() {
    return requestJson('/api', { method: 'GET' });
  },
  generateScript(payload) {
    return requestJson('/api/script/generate', { body: buildCompletionPayload(payload) });
  },
  refineScript(payload) {
    return requestJson('/api/script/refine', { body: buildCompletionPayload(payload) });
  },
  generateExtemporeTopics(payload) {
    return requestJson('/api/extempore/topics', { body: buildCompletionPayload(payload) });
  },
  generateExtemporeCoachSuggestion(payload) {
    return requestJson('/api/extempore/coach', { body: buildCompletionPayload(payload) });
  },
  transcribeAudio(formData, options = {}) {
    return requestMultipart('/api/transcribe', formData, options);
  },
  generateSarvamTts(payload, options = {}) {
    return requestJson('/api/tts/sarvam', { body: payload, signal: options.signal });
  },
  generateElevenLabsTts(voiceId, payload, options = {}) {
    return requestBinary(`/api/tts/elevenlabs/${encodeURIComponent(voiceId)}`, {
      body: payload,
      signal: options.signal
    });
  },
  listInterviewSessions() {
    return requestJson('/api/interview/sessions', { method: 'GET' });
  },
  createInterviewSession(payload) {
    return requestJson('/api/interview/sessions', { body: payload });
  },
  getInterviewSession(id) {
    return requestJson(`/api/interview/sessions/${encodeURIComponent(id)}`, { method: 'GET' });
  },
  updateInterviewSession(id, payload) {
    return requestJson(`/api/interview/sessions/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload });
  },
  deleteInterviewSession(id) {
    return requestJson(`/api/interview/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  createInterviewLiveSession(payload) {
    return requestJson('/api/interview/live-sessions', { body: payload });
  },
  getInterviewLiveSession(id) {
    return requestJson(`/api/interview/live-sessions/${encodeURIComponent(id)}`, { method: 'GET' });
  },
  getInterviewLiveSessionLog(id) {
    return requestJson(`/api/interview/live-sessions/${encodeURIComponent(id)}/log`, { method: 'GET' });
  },
  completeInterviewLiveSession(id, payload) {
    return requestJson(`/api/interview/live-sessions/${encodeURIComponent(id)}/complete`, { body: payload });
  },
  failInterviewLiveSession(id, payload) {
    return requestJson(`/api/interview/live-sessions/${encodeURIComponent(id)}/fail`, { body: payload });
  },
  getInterviewLiveSessionWebSocketUrl(id) {
    return getWorkerWebSocketUrl(`/api/interview/live-sessions/${encodeURIComponent(id)}/ws`);
  }
};
