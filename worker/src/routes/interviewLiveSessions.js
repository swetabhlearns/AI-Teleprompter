import {
  toInterviewSessionError
} from '../lib/db.js';
import { parseJsonBody } from '../lib/http.js';

function buildDurableObjectRequestUrl(request, sessionId, suffix = '') {
  const url = new URL(request.url);
  url.pathname = `/api/interview/live-sessions/${encodeURIComponent(sessionId)}${suffix}`;
  url.search = '';
  return url;
}

function getDurableObjectStub(env, sessionId) {
  return env.INTERVIEW_LIVE_SESSION.get(env.INTERVIEW_LIVE_SESSION.idFromName(sessionId));
}

async function forwardJsonToDurableObject(env, request, sessionId, suffix = '', payload = null) {
  const stub = getDurableObjectStub(env, sessionId);
  const url = buildDurableObjectRequestUrl(request, sessionId, suffix);
  return stub.fetch(new Request(url.toString(), {
    method: request.method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: payload == null ? undefined : JSON.stringify(payload)
  }));
}

async function forwardRequestToDurableObject(env, request, sessionId, suffix = '') {
  const stub = getDurableObjectStub(env, sessionId);
  const url = buildDurableObjectRequestUrl(request, sessionId, suffix);
  return stub.fetch(new Request(url.toString(), request));
}

export async function handleInterviewLiveSessions(request, env, url) {
  if (request.method === 'POST' && url.pathname === '/api/interview/live-sessions') {
    try {
      const payload = await parseJsonBody(request);
      if (!payload || typeof payload !== 'object') {
        return toInterviewSessionError('invalid_json', 'Request body must be valid JSON', null, 400);
      }

      const sessionId = String(payload.id || payload.sessionId || crypto.randomUUID());
      return forwardJsonToDurableObject(env, request, sessionId, '', {
        id: sessionId,
        archiveSessionId: String(payload.archiveSessionId || sessionId),
        status: 'active',
        phase: String(payload.phase || 'interview'),
        analysisStatus: String(payload.analysisStatus || 'idle'),
        config: payload.config || {},
        liveState: {
          ...(payload.liveState || {}),
          phase: String(payload.phase || 'interview'),
          analysisStatus: String(payload.analysisStatus || 'idle')
        },
        raw: payload
      });
    } catch (error) {
      return toInterviewSessionError(
        'live_session_create_failed',
        error?.message || 'Live interview session could not be created',
        { route: 'POST /api/interview/live-sessions' },
        500
      );
    }
  }

  const match = url.pathname.match(/^\/api\/interview\/live-sessions\/([^/]+)(?:\/(ws|log|complete|fail))?$/);
  if (!match) {
    return null;
  }

  const sessionId = decodeURIComponent(match[1]);
  const action = match[2] || '';

  if (action === 'ws') {
    return forwardRequestToDurableObject(env, request, sessionId, '/ws');
  }

  if (action === 'log' && request.method === 'GET') {
    return forwardRequestToDurableObject(env, request, sessionId, '/log');
  }

  if (action === 'complete' || action === 'fail') {
    return forwardRequestToDurableObject(env, request, sessionId, `/${action}`);
  }

  if (request.method === 'GET') {
    return forwardRequestToDurableObject(env, request, sessionId, '');
  }

  if (request.method === 'PATCH') {
    return forwardRequestToDurableObject(env, request, sessionId, '');
  }

  return null;
}

export async function handleInterviewLiveSessionsManifest(env) {
  void env;
  return [];
}
