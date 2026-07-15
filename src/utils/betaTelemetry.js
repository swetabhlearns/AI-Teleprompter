import { workerApi } from '../api/workerClient.js';

const EVENT_NAMES = new Set([
  'page_view',
  'client_error',
  'onboarding_completed',
  'onboarding_dismissed',
  'feedback_submitted',
  'drill_started',
  'practice_goal_updated'
]);
const ROUTES = new Set(['/script', '/interview', '/extempore', '/extempore/live', '/practice', '/history', '/privacy']);

function createEventId() {
  return `event:${globalThis.crypto?.randomUUID?.() || Date.now()}`;
}

export function modeFromRoute(route = '') {
  const segment = String(route).split('/').filter(Boolean)[0] || '';
  return ['script', 'interview', 'extempore', 'practice', 'history', 'privacy'].includes(segment) ? segment : '';
}

export function classifyClientError(error) {
  const name = String(error?.name || '');
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('dynamically imported') || message.includes('loading chunk')) return 'ChunkLoadError';
  if (name === 'NotAllowedError' || name === 'NotFoundError' || name === 'NotReadableError') return 'MediaError';
  if (name === 'NetworkError' || message.includes('network') || message.includes('fetch')) return 'NetworkError';
  return 'UnhandledError';
}

export function normalizeBetaEvent(eventName, details = {}) {
  if (!EVENT_NAMES.has(eventName)) return null;
  const currentRoute = String(details.route || globalThis.location?.pathname || '');
  const route = ROUTES.has(currentRoute) ? currentRoute : '';
  return {
    id: createEventId(),
    eventName,
    mode: details.mode || modeFromRoute(route),
    route,
    errorName: eventName === 'client_error' ? classifyClientError(details.error) : '',
    appVersion: String(import.meta.env?.VITE_APP_VERSION || 'beta').slice(0, 64),
    createdAt: new Date().toISOString()
  };
}

export async function trackBetaEvent(eventName, details = {}, submitter = (event) => workerApi.submitEvent(event)) {
  const event = normalizeBetaEvent(eventName, details);
  if (!event) return false;
  try {
    await submitter(event);
    return true;
  } catch {
    return false;
  }
}
