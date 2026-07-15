import {
  createInterviewSession,
  deleteInterviewSession,
  getInterviewSession,
  listInterviewSessions,
  saveInterviewSession,
  summarizeInterviewSession,
  toInterviewSessionError
} from '../lib/db.js';
import { jsonResponse, parseJsonBody } from '../lib/http.js';
import { ownerErrorResponse, requireOwnerContext } from '../lib/ownership.js';

export async function handleInterviewSessions(request, env, url) {
  const isCollectionRoute = url.pathname === '/api/interview/sessions';
  const sessionMatch = url.pathname.match(/^\/api\/interview\/sessions\/([^/]+)$/);
  if (!isCollectionRoute && !sessionMatch) return null;

  let owner;
  try {
    owner = await requireOwnerContext(request);
  } catch (error) {
    return ownerErrorResponse(error);
  }

  if (request.method === 'GET' && url.pathname === '/api/interview/sessions') {
    try {
      const sessions = await listInterviewSessions(env, owner.ownerHash);
      return jsonResponse({ ok: true, sessions });
    } catch (error) {
      return toInterviewSessionError(
        'db_unavailable',
        error?.message || 'Interview sessions database is unavailable',
        { route: 'GET /api/interview/sessions' },
        501
      );
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/interview/sessions') {
    const payload = await parseJsonBody(request);
    if (!payload || typeof payload !== 'object') {
      return toInterviewSessionError('invalid_json', 'Request body must be valid JSON', null, 400);
    }

    try {
      const session = createInterviewSession({ ...payload, ownerHash: owner.ownerHash });
      const nextSession = await saveInterviewSession(env, session, owner.ownerHash);
      return jsonResponse({ ok: true, session: nextSession, summary: summarizeInterviewSession(nextSession) }, {
        status: 201,
      });
    } catch (error) {
      return toInterviewSessionError(
        'db_unavailable',
        error?.message || 'Interview session could not be created',
        { route: 'POST /api/interview/sessions' },
        501
      );
    }
  }

  if (!sessionMatch) return null;
  const sessionId = decodeURIComponent(sessionMatch[1]);

  if (request.method === 'GET') {
    try {
      const session = await getInterviewSession(env, sessionId, owner.ownerHash);
      if (!session) {
        return toInterviewSessionError('not_found', 'Interview session not found', { sessionId }, 404);
      }
      return jsonResponse({ ok: true, session });
    } catch (error) {
      return toInterviewSessionError(
        'db_unavailable',
        error?.message || 'Interview session could not be loaded',
        { sessionId },
        501
      );
    }
  }

  if (request.method === 'PATCH') {
    const payload = await parseJsonBody(request);
    if (!payload || typeof payload !== 'object') {
      return toInterviewSessionError('invalid_json', 'Request body must be valid JSON', null, 400);
    }

    try {
      const current = await getInterviewSession(env, sessionId, owner.ownerHash);
      if (!current) {
        return toInterviewSessionError('not_found', 'Interview session not found', { sessionId }, 404);
      }

      const nextSession = await saveInterviewSession(env, {
        ...current,
        ...payload,
        id: sessionId,
        ownerHash: owner.ownerHash,
        updatedAt: new Date().toISOString()
      }, owner.ownerHash);

      return jsonResponse({ ok: true, session: nextSession, summary: summarizeInterviewSession(nextSession) });
    } catch (error) {
      return toInterviewSessionError(
        'db_unavailable',
        error?.message || 'Interview session could not be updated',
        { sessionId },
        501
      );
    }
  }

  if (request.method === 'DELETE') {
    try {
      const deleted = await deleteInterviewSession(env, sessionId, owner.ownerHash);
      if (!deleted) {
        return toInterviewSessionError('not_found', 'Interview session not found', { sessionId }, 404);
      }

      return jsonResponse({ ok: true, deleted: true, sessionId });
    } catch (error) {
      return toInterviewSessionError(
        'db_unavailable',
        error?.message || 'Interview session could not be deleted',
        { sessionId },
        501
      );
    }
  }

  return null;
}
