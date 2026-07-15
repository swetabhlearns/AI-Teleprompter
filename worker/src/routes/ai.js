import { errorResponse, jsonResponse, parseJsonBody } from '../lib/http.js';

function withCorsHeaders(headers = {}) {
  const next = new Headers(headers);
  next.set('Access-Control-Allow-Origin', '*');
  next.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  next.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  return next;
}

async function proxyGroqJson(env, path, body) {
  if (!env?.GROQ_API_KEY) {
    return errorResponse('missing_config', 'Groq API key is not configured on the Worker', 501);
  }

  const response = await fetch(`https://api.groq.com/openai/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return errorResponse(
      'groq_request_failed',
      payload?.error?.message || payload?.message || `Groq request failed with status ${response.status}`,
      response.status,
      payload
    );
  }

  return jsonResponse(payload, { status: response.status });
}

async function proxyGroqTranscription(env, request) {
  if (!env?.GROQ_API_KEY) {
    return errorResponse('missing_config', 'Groq API key is not configured on the Worker', 501);
  }

  const incoming = await request.formData();
  const outgoing = new FormData();

  for (const [key, value] of incoming.entries()) {
    outgoing.append(key, value);
  }

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`
    },
    body: outgoing
  });

  const payload = await response.json().catch(async () => {
    const text = await response.text().catch(() => '');
    return text ? { text } : null;
  });

  if (!response.ok) {
    return errorResponse(
      'groq_request_failed',
      payload?.error?.message || payload?.message || `Groq transcription failed with status ${response.status}`,
      response.status,
      payload
    );
  }

  return jsonResponse(payload, { status: response.status });
}

async function proxySarvamTts(env, body) {
  if (!env?.SARVAM_API_KEY) {
    return errorResponse('missing_config', 'Sarvam API key is not configured on the Worker', 501);
  }

  const response = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': env.SARVAM_API_KEY
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return errorResponse(
      'sarvam_request_failed',
      payload?.detail?.message || payload?.message || payload?.error || `Sarvam TTS failed with status ${response.status}`,
      response.status,
      payload
    );
  }

  return jsonResponse(payload, { status: response.status });
}

async function proxyElevenLabsTts(env, body, voiceIdOverride = '') {
  if (!env?.ELEVENLABS_API_KEY) {
    return errorResponse('missing_config', 'ElevenLabs API key is not configured on the Worker', 501);
  }

  const voiceId = String(voiceIdOverride || body.voiceId || body.voice_id || '21m00Tcm4TlvDq8ikWAM');
  const outputFormat = String(body.outputFormat || body.output_format || 'mp3_44100_128');
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': env.ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text: body.text || '',
      model_id: body.modelId || body.model_id || 'eleven_turbo_v2_5',
      voice_settings: body.voiceSettings || body.voice_settings || {
        stability: 0.5,
        similarity_boost: 0.75
      }
    })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    return errorResponse(
      'elevenlabs_request_failed',
      payload?.detail?.message || payload?.message || payload?.error || `ElevenLabs TTS failed with status ${response.status}`,
      response.status,
      payload
    );
  }

  const headers = withCorsHeaders({
    'Content-Type': response.headers.get('content-type') || 'audio/mpeg'
  });

  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers
  });
}

function buildTextRequestPayload(body = {}) {
  return {
    model: body.model || 'llama-3.3-70b-versatile',
    messages: Array.isArray(body.messages) ? body.messages : [],
    temperature: Number.isFinite(Number(body.temperature)) ? Number(body.temperature) : 0.7,
    max_tokens: Number.isFinite(Number(body.max_tokens)) ? Number(body.max_tokens) : 1000,
    response_format: body.response_format || undefined
  };
}

export async function handleAiRoutes(request, env, url) {
  if (request.method !== 'POST') {
    return null;
  }

  if (url.pathname === '/api/script/generate' || url.pathname === '/api/script/refine' || url.pathname === '/api/extempore/topics' || url.pathname === '/api/extempore/coach') {
    const payload = await parseJsonBody(request);
    if (!payload || typeof payload !== 'object') {
      return errorResponse('invalid_json', 'Request body must be valid JSON', 400);
    }

    return proxyGroqJson(env, '/chat/completions', buildTextRequestPayload(payload));
  }

  if (url.pathname === '/api/transcribe') {
    return proxyGroqTranscription(env, request);
  }

  if (url.pathname === '/api/tts/sarvam') {
    const payload = await parseJsonBody(request);
    if (!payload || typeof payload !== 'object') {
      return errorResponse('invalid_json', 'Request body must be valid JSON', 400);
    }

    return proxySarvamTts(env, payload);
  }

  const elevenMatch = url.pathname.match(/^\/api\/tts\/elevenlabs(?:\/([^/]+))?$/);
  if (elevenMatch) {
    const payload = await parseJsonBody(request);
    if (!payload || typeof payload !== 'object') {
      return errorResponse('invalid_json', 'Request body must be valid JSON', 400);
    }

    return proxyElevenLabsTts(env, payload, elevenMatch[1] || '');
  }

  return null;
}
