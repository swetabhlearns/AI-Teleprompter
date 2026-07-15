import { errorResponse, jsonResponse } from '../lib/http.js';
import { ownerErrorResponse, requireOwnerContext } from '../lib/ownership.js';

async function deleteOwnerData(env, ownerHash) {
  if (!env?.DB?.prepare || !env?.DB?.batch) throw new Error('D1 binding DB is not configured.');

  const statements = [
    env.DB.prepare(`
      DELETE FROM interview_live_turns
      WHERE session_id IN (
        SELECT id FROM interview_live_sessions
        WHERE archive_session_id IN (
          SELECT id FROM interview_sessions WHERE owner_hash = ?
        )
      )
    `).bind(ownerHash),
    env.DB.prepare(`
      DELETE FROM interview_live_sessions
      WHERE archive_session_id IN (
        SELECT id FROM interview_sessions WHERE owner_hash = ?
      )
    `).bind(ownerHash),
    env.DB.prepare('DELETE FROM interview_sessions WHERE owner_hash = ?').bind(ownerHash),
    env.DB.prepare('DELETE FROM beta_feedback WHERE owner_hash = ?').bind(ownerHash),
    env.DB.prepare('DELETE FROM beta_events WHERE owner_hash = ?').bind(ownerHash)
  ];

  const results = await env.DB.batch(statements);
  return {
    interviewTurns: results[0]?.meta?.changes || 0,
    liveSessions: results[1]?.meta?.changes || 0,
    interviewArchives: results[2]?.meta?.changes || 0,
    feedback: results[3]?.meta?.changes || 0,
    operationalEvents: results[4]?.meta?.changes || 0
  };
}

export async function handleDataRights(request, env, url) {
  if (url.pathname !== '/api/data') return null;
  if (request.method !== 'DELETE') {
    return errorResponse('method_not_allowed', 'Only DELETE is supported for beta data.', 405);
  }

  let owner;
  try {
    owner = await requireOwnerContext(request);
  } catch (error) {
    return ownerErrorResponse(error);
  }

  try {
    const deleted = await deleteOwnerData(env, owner.ownerHash);
    console.log(JSON.stringify({ message: 'owner_data_deleted', deleted }));
    return jsonResponse({ ok: true, deleted });
  } catch (error) {
    console.error(JSON.stringify({
      message: 'owner_data_delete_failed',
      error: error instanceof Error ? error.message : String(error)
    }));
    return errorResponse('data_deletion_unavailable', 'Your beta service data could not be deleted right now.', 503);
  }
}

export { deleteOwnerData };
