import { errorResponse, jsonResponse, parseJsonBody } from '../lib/http.js';
import { ownerErrorResponse, requireOwnerContext } from '../lib/ownership.js';

const EVENT_NAMES = new Set([
  'page_view',
  'client_error',
  'onboarding_completed',
  'onboarding_dismissed',
  'feedback_submitted',
  'drill_started',
  'practice_goal_updated'
]);
const MODES = new Set(['', 'script', 'interview', 'extempore', 'history', 'privacy']);
const ROUTES = new Set(['/script', '/interview', '/extempore', '/extempore/live', '/practice', '/history', '/privacy']);
const ERROR_NAMES = new Set(['', 'NetworkError', 'ChunkLoadError', 'MediaError', 'UnhandledError']);

function validIsoDate(value) {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

export function normalizeBetaEvent(payload = {}, ownerHash = '') {
  const eventName = EVENT_NAMES.has(payload.eventName) ? payload.eventName : '';
  const id = String(payload.id || '').trim().slice(0, 128);
  if (!id || !eventName) return null;

  return {
    id,
    ownerHash,
    eventName,
    mode: MODES.has(payload.mode) ? payload.mode : '',
    route: ROUTES.has(payload.route) ? payload.route : '',
    errorName: ERROR_NAMES.has(payload.errorName) ? payload.errorName : '',
    appVersion: String(payload.appVersion || '').trim().slice(0, 64),
    createdAt: validIsoDate(payload.createdAt),
    receivedAt: new Date().toISOString()
  };
}

async function insertEvent(env, event) {
  if (!env?.DB?.prepare) throw new Error('D1 binding DB is not configured.');
  await env.DB.prepare(`
    INSERT INTO beta_events (
      id, owner_hash, event_name, mode, route, error_name,
      app_version, created_at, received_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).bind(
    event.id,
    event.ownerHash,
    event.eventName,
    event.mode,
    event.route,
    event.errorName,
    event.appVersion,
    event.createdAt,
    event.receivedAt
  ).run();
}

export async function handleEvents(request, env, url) {
  if (url.pathname !== '/api/events') return null;
  if (request.method !== 'POST') return errorResponse('method_not_allowed', 'Only POST is supported for events.', 405);

  let owner;
  try {
    owner = await requireOwnerContext(request);
  } catch (error) {
    return ownerErrorResponse(error);
  }

  const payload = await parseJsonBody(request, 8 * 1024);
  const event = normalizeBetaEvent(payload, owner.ownerHash);
  if (!event) return errorResponse('invalid_event', 'Event name or identifier is invalid.', 400);

  try {
    await insertEvent(env, event);
    return jsonResponse({ ok: true }, { status: 202 });
  } catch (error) {
    console.error(JSON.stringify({
      message: 'beta_event_insert_failed',
      error: error instanceof Error ? error.message : String(error)
    }));
    return errorResponse('events_unavailable', 'Operational event could not be recorded.', 503);
  }
}
