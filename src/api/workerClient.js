import { hasWorkerApi, getWorkerApiUrl, getWorkerWebSocketUrl } from '../utils/workerApi.js';
import { getAnonymousCapabilityHeaders } from '../utils/anonymousIdentity.js';

const liveSessionWebSocketUrls = new Map();

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

async function requestJson(pathname, { method = 'POST', body, headers = {}, signal, capability = false } = {}) {
  const response = await fetch(getWorkerApiUrl(pathname), {
    method,
    headers: {
      ...(body == null ? {} : { 'Content-Type': 'application/json' }),
      ...(capability ? getAnonymousCapabilityHeaders() : {}),
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
    headers: getAnonymousCapabilityHeaders(),
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
      ...getAnonymousCapabilityHeaders(),
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
    return requestJson('/api/script/generate', { body: buildCompletionPayload(payload), capability: true });
  },
  refineScript(payload) {
    return requestJson('/api/script/refine', { body: buildCompletionPayload(payload), capability: true });
  },
  generateExtemporeTopics(payload) {
    return requestJson('/api/extempore/topics', { body: buildCompletionPayload(payload), capability: true });
  },
  generateExtemporeCoachSuggestion(payload) {
    return requestJson('/api/extempore/coach', { body: buildCompletionPayload(payload), capability: true });
  },
  transcribeAudio(formData, options = {}) {
    return requestMultipart('/api/transcribe', formData, options);
  },
  generateSarvamTts(payload, options = {}) {
    return requestJson('/api/tts/sarvam', { body: payload, signal: options.signal, capability: true });
  },
  generateElevenLabsTts(voiceId, payload, options = {}) {
    return requestBinary(`/api/tts/elevenlabs/${encodeURIComponent(voiceId)}`, {
      body: payload,
      signal: options.signal
    });
  },
  submitFeedback(payload) {
    return requestJson('/api/feedback', { body: payload, capability: true });
  },
  listInterviewSessions() {
    return requestJson('/api/interview/sessions', { method: 'GET', capability: true });
  },
  createInterviewSession(payload) {
    return requestJson('/api/interview/sessions', { body: payload, capability: true });
  },
  getInterviewSession(id) {
    return requestJson(`/api/interview/sessions/${encodeURIComponent(id)}`, { method: 'GET', capability: true });
  },
  updateInterviewSession(id, payload) {
    return requestJson(`/api/interview/sessions/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, capability: true });
  },
  deleteInterviewSession(id) {
    return requestJson(`/api/interview/sessions/${encodeURIComponent(id)}`, { method: 'DELETE', capability: true });
  },
  async createInterviewLiveSession(payload) {
    const result = await requestJson('/api/interview/live-sessions', { body: payload, capability: true });
    if (result?.wsUrl && payload?.id) liveSessionWebSocketUrls.set(String(payload.id), result.wsUrl);
    return result;
  },
  getInterviewLiveSession(id) {
    return requestJson(`/api/interview/live-sessions/${encodeURIComponent(id)}`, { method: 'GET', capability: true });
  },
  getInterviewLiveSessionLog(id) {
    return requestJson(`/api/interview/live-sessions/${encodeURIComponent(id)}/log`, { method: 'GET', capability: true });
  },
  completeInterviewLiveSession(id, payload) {
    return requestJson(`/api/interview/live-sessions/${encodeURIComponent(id)}/complete`, { body: payload, capability: true });
  },
  failInterviewLiveSession(id, payload) {
    return requestJson(`/api/interview/live-sessions/${encodeURIComponent(id)}/fail`, { body: payload, capability: true });
  },
  getInterviewLiveSessionWebSocketUrl(id) {
    return liveSessionWebSocketUrls.get(String(id))
      || getWorkerWebSocketUrl(`/api/interview/live-sessions/${encodeURIComponent(id)}/ws`);
  }
};
