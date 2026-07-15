import { errorResponse, jsonResponse, parseJsonBody } from '../lib/http.js';
import { ownerErrorResponse, requireOwnerContext } from '../lib/ownership.js';

const FEEDBACK_KINDS = new Set(['session', 'beta']);
const FEEDBACK_SENTIMENTS = new Set(['', 'helpful', 'not_helpful']);
const FEEDBACK_CATEGORIES = new Set(['session_quality', 'technical_issue', 'feature_request', 'other']);
const FEEDBACK_MODES = new Set(['', 'script', 'interview', 'extempore']);

function boundedText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function validIsoDate(value) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

export function normalizeFeedbackRecord(payload = {}, ownerHash = '') {
  const kind = FEEDBACK_KINDS.has(payload.kind) ? payload.kind : '';
  const sentiment = FEEDBACK_SENTIMENTS.has(payload.sentiment) ? payload.sentiment : '';
  const category = FEEDBACK_CATEGORIES.has(payload.category) ? payload.category : 'other';
  const mode = FEEDBACK_MODES.has(payload.mode) ? payload.mode : '';
  const id = boundedText(payload.id, 128);

  if (!id || !kind) return null;
  if (kind === 'session' && !sentiment) return null;

  return {
    id,
    ownerHash,
    kind,
    sentiment,
    category,
    mode,
    activityId: boundedText(payload.activityId, 160),
    message: boundedText(payload.message, 1000),
    appVersion: boundedText(payload.appVersion, 64),
    pagePath: boundedText(payload.pagePath, 200),
    createdAt: validIsoDate(payload.createdAt),
    receivedAt: new Date().toISOString()
  };
}

async function insertFeedback(env, feedback) {
  if (!env?.DB?.prepare) throw new Error('D1 binding DB is not configured.');
  await env.DB.prepare(`
    INSERT INTO beta_feedback (
      id, owner_hash, kind, sentiment, category, mode, activity_id,
      message, app_version, page_path, created_at, received_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).bind(
    feedback.id,
    feedback.ownerHash,
    feedback.kind,
    feedback.sentiment,
    feedback.category,
    feedback.mode,
    feedback.activityId,
    feedback.message,
    feedback.appVersion,
    feedback.pagePath,
    feedback.createdAt,
    feedback.receivedAt
  ).run();
}

export async function handleFeedback(request, env, url) {
  if (url.pathname !== '/api/feedback') return null;
  if (request.method !== 'POST') return errorResponse('method_not_allowed', 'Only POST is supported for feedback.', 405);

  let owner;
  try {
    owner = await requireOwnerContext(request);
  } catch (error) {
    return ownerErrorResponse(error);
  }

  const payload = await parseJsonBody(request, 16 * 1024);
  const feedback = normalizeFeedbackRecord(payload, owner.ownerHash);
  if (!feedback) {
    return errorResponse('invalid_feedback', 'Feedback must include a valid id, kind, and session rating when applicable.', 400);
  }

  try {
    await insertFeedback(env, feedback);
    return jsonResponse({ ok: true, feedbackId: feedback.id }, { status: 201 });
  } catch (error) {
    console.error(JSON.stringify({
      message: 'feedback_insert_failed',
      error: error instanceof Error ? error.message : String(error)
    }));
    return errorResponse('feedback_unavailable', 'Feedback could not be saved right now.', 503);
  }
}
