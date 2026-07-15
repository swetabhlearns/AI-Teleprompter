export const PRACTICE_HISTORY_STORAGE_KEY = 'ai-tracker.practice-history.v1';
export const PRACTICE_HISTORY_EVENT = 'ai-tracker:practice-history-change';

function storageOrDefault(storage) {
  return storage || globalThis.localStorage;
}

export function loadPracticeActivities(storage) {
  try {
    const parsed = JSON.parse(storageOrDefault(storage)?.getItem(PRACTICE_HISTORY_STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item) => item?.id && item?.mode).sort((a, b) => String(b.occurredAt || '').localeCompare(String(a.occurredAt || '')))
      : [];
  } catch {
    return [];
  }
}

export function savePracticeActivity(activity, storage) {
  if (!activity?.id || !activity?.mode) return null;
  const target = storageOrDefault(storage);
  const normalized = {
    status: 'completed',
    occurredAt: new Date().toISOString(),
    ...activity,
    id: String(activity.id),
    mode: String(activity.mode)
  };
  const next = [normalized, ...loadPracticeActivities(target).filter((item) => item.id !== normalized.id)].slice(0, 100);

  try {
    target?.setItem(PRACTICE_HISTORY_STORAGE_KEY, JSON.stringify(next));
    globalThis.dispatchEvent?.(new CustomEvent(PRACTICE_HISTORY_EVENT));
  } catch {
    return null;
  }
  return normalized;
}

export function clearPracticeHistory(storage) {
  try {
    storageOrDefault(storage)?.removeItem(PRACTICE_HISTORY_STORAGE_KEY);
    globalThis.dispatchEvent?.(new CustomEvent(PRACTICE_HISTORY_EVENT));
    return true;
  } catch {
    return false;
  }
}
