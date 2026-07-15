import {
  toInterviewSessionError
} from '../lib/db.js';
import { parseJsonBody } from '../lib/http.js';
import { createLiveAccessToken, ownerErrorResponse, requireOwnerContext, sha256 } from '../lib/ownership.js';

function buildDurableObjectRequestUrl(request, sessionId, suffix = '', internalParams = {}) {
  const url = new URL(request.url);
  url.pathname = `/api/interview/live-sessions/${encodeURIComponent(sessionId)}${suffix}`;
  url.search = '';
  for (const [key, value] of Object.entries(internalParams)) url.searchParams.set(key, value);
  return url;
}

function getDurableObjectStub(env, sessionId) {
  return env.INTERVIEW_LIVE_SESSION.get(env.INTERVIEW_LIVE_SESSION.idFromName(sessionId));
}

async function forwardJsonToDurableObject(env, request, sessionId, suffix = '', payload = null, internalParams = {}) {
  const stub = getDurableObjectStub(env, sessionId);
  const url = buildDurableObjectRequestUrl(request, sessionId, suffix, internalParams);
  return stub.fetch(new Request(url.toString(), {
    method: request.method,
    headers: {
      'Content-Type': 'application/json'
    },
    body: payload == null ? undefined : JSON.stringify(payload)
  }));
}

async function forwardRequestToDurableObject(env, request, sessionId, suffix = '', internalParams = {}) {
  const stub = getDurableObjectStub(env, sessionId);
  const url = buildDurableObjectRequestUrl(request, sessionId, suffix, internalParams);
  return stub.fetch(new Request(url.toString(), request));
}

export async function handleInterviewLiveSessions(request, env, url) {
  let owner;
  try {
    owner = await requireOwnerContext(request);
  } catch (error) {
    if (!url.pathname.endsWith('/ws')) return ownerErrorResponse(error);
  }

  if (request.method === 'POST' && url.pathname === '/api/interview/live-sessions') {
    try {
      const payload = await parseJsonBody(request);
      if (!payload || typeof payload !== 'object') {
        return toInterviewSessionError('invalid_json', 'Request body must be valid JSON', null, 400);
      }

      const sessionId = String(payload.id || payload.sessionId || crypto.randomUUID());
      const liveAccessToken = createLiveAccessToken();
      const response = await forwardJsonToDurableObject(env, request, sessionId, '', {
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
        raw: payload,
        ownerHash: owner.ownerHash,
        liveAccessTokenHash: await sha256(liveAccessToken)
      });
      const result = await response.json();
      const publicSession = structuredClone(result.session || {});
      delete publicSession.ownerHash;
      delete publicSession.liveAccessTokenHash;
      delete publicSession.raw?.ownerHash;
      delete publicSession.raw?.liveAccessTokenHash;
      const wsUrl = new URL(`/api/interview/live-sessions/${encodeURIComponent(sessionId)}/ws`, request.url);
      wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl.searchParams.set('access_token', liveAccessToken);
      return new Response(JSON.stringify({ ...result, session: publicSession, wsUrl: wsUrl.toString() }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
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
    const token = String(url.searchParams.get('access_token') || '');
    if (token.length < 40) return ownerErrorResponse({ code: 'live_access_required', message: 'Live session access token required', status: 401 });
    return forwardRequestToDurableObject(env, request, sessionId, '/ws', { access_token_hash: await sha256(token) });
  }

  if (action === 'log' && request.method === 'GET') {
    return forwardRequestToDurableObject(env, request, sessionId, '/log', { owner_hash: owner.ownerHash });
  }

  if (action === 'complete' || action === 'fail') {
    return forwardRequestToDurableObject(env, request, sessionId, `/${action}`, { owner_hash: owner.ownerHash });
  }

  if (request.method === 'GET') {
    return forwardRequestToDurableObject(env, request, sessionId, '', { owner_hash: owner.ownerHash });
  }

  if (request.method === 'PATCH') {
    return forwardRequestToDurableObject(env, request, sessionId, '', { owner_hash: owner.ownerHash });
  }

  return null;
}

export async function handleInterviewLiveSessionsManifest(env) {
  void env;
  return [];
}
