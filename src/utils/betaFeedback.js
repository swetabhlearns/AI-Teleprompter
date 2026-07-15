import { workerApi } from '../api/workerClient.js';

export const FEEDBACK_QUEUE_STORAGE_KEY = 'ai-tracker.feedback-queue.v1';
export const FEEDBACK_RECEIPTS_STORAGE_KEY = 'ai-tracker.feedback-receipts.v1';

function readJson(storage, key, fallback) {
  try {
    return JSON.parse(storage?.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJson(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function createId() {
  return `feedback:${globalThis.crypto?.randomUUID?.() || Date.now()}`;
}

export function normalizeBetaFeedback(input = {}) {
  return {
    id: String(input.id || createId()),
    kind: input.kind === 'session' ? 'session' : 'beta',
    sentiment: ['helpful', 'not_helpful'].includes(input.sentiment) ? input.sentiment : '',
    category: ['session_quality', 'technical_issue', 'feature_request', 'other'].includes(input.category)
      ? input.category
      : 'other',
    mode: ['script', 'interview', 'extempore'].includes(input.mode) ? input.mode : '',
    activityId: String(input.activityId || '').slice(0, 160),
    message: String(input.message || '').trim().slice(0, 1000),
    appVersion: String(import.meta.env?.VITE_APP_VERSION || 'beta').slice(0, 64),
    pagePath: String(input.pagePath || globalThis.location?.pathname || '').slice(0, 200),
    createdAt: input.createdAt || new Date().toISOString()
  };
}

export function loadFeedbackReceipts(storage = globalThis.localStorage) {
  const receipts = readJson(storage, FEEDBACK_RECEIPTS_STORAGE_KEY, {});
  return receipts && typeof receipts === 'object' && !Array.isArray(receipts) ? receipts : {};
}

function saveReceipt(feedback, status, storage) {
  if (!feedback.activityId) return;
  const receipts = loadFeedbackReceipts(storage);
  const next = Object.fromEntries([
    [feedback.activityId, { status, feedbackId: feedback.id, updatedAt: new Date().toISOString() }],
    ...Object.entries(receipts).filter(([activityId]) => activityId !== feedback.activityId)
  ].slice(0, 100));
  writeJson(storage, FEEDBACK_RECEIPTS_STORAGE_KEY, next);
}

export function loadQueuedFeedback(storage = globalThis.localStorage) {
  const queued = readJson(storage, FEEDBACK_QUEUE_STORAGE_KEY, []);
  return Array.isArray(queued) ? queued.filter((item) => item?.id).slice(0, 20) : [];
}

function queueFeedback(feedback, storage) {
  const next = [feedback, ...loadQueuedFeedback(storage).filter((item) => item.id !== feedback.id)].slice(0, 20);
  writeJson(storage, FEEDBACK_QUEUE_STORAGE_KEY, next);
  saveReceipt(feedback, 'queued', storage);
}

export async function submitBetaFeedback(input, {
  storage = globalThis.localStorage,
  submitter = (feedback) => workerApi.submitFeedback(feedback)
} = {}) {
  const feedback = normalizeBetaFeedback(input);
  if (feedback.kind === 'session' && !feedback.sentiment) {
    throw new Error('Choose whether this session was helpful.');
  }

  try {
    await submitter(feedback);
    saveReceipt(feedback, 'sent', storage);
    return { status: 'sent', feedback };
  } catch {
    queueFeedback(feedback, storage);
    return { status: 'queued', feedback };
  }
}

export async function flushQueuedFeedback({
  storage = globalThis.localStorage,
  submitter = (feedback) => workerApi.submitFeedback(feedback)
} = {}) {
  const queued = loadQueuedFeedback(storage);
  const remaining = [];
  let sentCount = 0;

  for (const feedback of queued) {
    try {
      await submitter(feedback);
      saveReceipt(feedback, 'sent', storage);
      sentCount += 1;
    } catch {
      remaining.push(feedback);
    }
  }

  writeJson(storage, FEEDBACK_QUEUE_STORAGE_KEY, remaining);
  return { sentCount, remainingCount: remaining.length };
}
