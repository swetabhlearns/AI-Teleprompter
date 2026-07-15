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

export function summarizePracticeActivities(activities = [], now = new Date()) {
  const currentTime = new Date(now).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const counts = {};
  const activeDays = new Set();
  let recentCount = 0;
  let previousCount = 0;

  for (const activity of activities) {
    counts[activity.mode] = (counts[activity.mode] || 0) + 1;
    const timestamp = new Date(activity.occurredAt || 0).getTime();
    if (!Number.isFinite(timestamp)) continue;
    activeDays.add(new Date(timestamp).toISOString().slice(0, 10));
    const age = currentTime - timestamp;
    if (age >= 0 && age < sevenDays) recentCount += 1;
    else if (age >= sevenDays && age < sevenDays * 2) previousCount += 1;
  }

  const mostPracticedMode = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return {
    activeDays: activeDays.size,
    recentCount,
    previousCount,
    recentDelta: recentCount - previousCount,
    mostPracticedMode,
    counts
  };
}
