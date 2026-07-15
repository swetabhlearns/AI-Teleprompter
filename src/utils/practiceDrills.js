export const PRACTICE_DRILLS_STORAGE_KEY = 'ai-tracker.practice-drills.v1';

function readDrills(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(PRACTICE_DRILLS_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDrills(drills, storage = globalThis.localStorage) {
  try {
    storage?.setItem(PRACTICE_DRILLS_STORAGE_KEY, JSON.stringify(drills.slice(0, 50)));
  } catch {
    return false;
  }
  return true;
}

export function loadPracticeDrills(storage) {
  return readDrills(storage).sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')));
}

export function startPracticeDrill({ mode, text, source = 'practice-plan' }, storage, now = new Date()) {
  if (!mode || !text) return null;
  const drills = loadPracticeDrills(storage);
  const existing = drills.find((drill) => drill.status === 'active' && drill.mode === mode && drill.text === text);
  if (existing) return existing;

  const startedAt = new Date(now).toISOString();
  const drill = {
    id: `drill:${globalThis.crypto?.randomUUID?.() || `${Date.now()}`}`,
    mode,
    text,
    source,
    status: 'active',
    startedAt,
    completedAt: null,
    activityId: null
  };
  const next = [drill, ...drills.map((item) => item.status === 'active' ? { ...item, status: 'superseded' } : item)];
  writeDrills(next, storage);
  return drill;
}

export function completeMatchingPracticeDrill(activity, storage) {
  if (!activity?.mode || !activity?.id) return null;
  const drills = loadPracticeDrills(storage);
  const activeIndex = drills.findIndex((drill) => drill.status === 'active' && drill.mode === activity.mode);
  if (activeIndex < 0) return null;

  const drill = drills[activeIndex];
  const activityTime = new Date(activity.occurredAt || 0).getTime();
  const startedTime = new Date(drill.startedAt || 0).getTime();
  if (!Number.isFinite(activityTime) || activityTime < startedTime) return null;

  const completed = {
    ...drill,
    status: 'completed',
    completedAt: activity.occurredAt,
    activityId: activity.id
  };
  drills[activeIndex] = completed;
  writeDrills(drills, storage);
  return completed;
}

export function summarizePracticeDrills(drills = []) {
  return {
    active: drills.find((drill) => drill.status === 'active') || null,
    completedCount: drills.filter((drill) => drill.status === 'completed').length,
    latestCompleted: drills.find((drill) => drill.status === 'completed') || null
  };
}
