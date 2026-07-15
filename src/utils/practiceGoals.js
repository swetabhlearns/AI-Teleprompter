export const PRACTICE_GOAL_STORAGE_KEY = 'ai-tracker.practice-goal.v1';

export const DEFAULT_PRACTICE_GOAL = {
  weeklyTarget: 3,
  focusMode: 'balanced'
};

export function normalizePracticeGoal(goal = {}) {
  const weeklyTarget = Math.min(7, Math.max(1, Math.round(Number(goal.weeklyTarget) || DEFAULT_PRACTICE_GOAL.weeklyTarget)));
  const focusMode = ['balanced', 'script', 'interview', 'extempore'].includes(goal.focusMode)
    ? goal.focusMode
    : DEFAULT_PRACTICE_GOAL.focusMode;
  return { weeklyTarget, focusMode };
}

export function loadPracticeGoal(storage = globalThis.localStorage) {
  try {
    return normalizePracticeGoal(JSON.parse(storage?.getItem(PRACTICE_GOAL_STORAGE_KEY) || '{}'));
  } catch {
    return DEFAULT_PRACTICE_GOAL;
  }
}

export function savePracticeGoal(goal, storage = globalThis.localStorage) {
  const normalized = normalizePracticeGoal(goal);
  try {
    storage?.setItem(PRACTICE_GOAL_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    return normalized;
  }
  return normalized;
}

export function buildNextPracticeRecommendation(activities = [], goal = DEFAULT_PRACTICE_GOAL) {
  const normalizedGoal = normalizePracticeGoal(goal);
  const modes = ['script', 'interview', 'extempore'];
  const counts = Object.fromEntries(modes.map((mode) => [mode, activities.filter((item) => item.mode === mode).length]));
  const targetMode = normalizedGoal.focusMode === 'balanced'
    ? modes.sort((a, b) => counts[a] - counts[b])[0]
    : normalizedGoal.focusMode;
  const latestGrounded = activities.find((item) => item.mode === targetMode && item.recommendation);
  const defaults = {
    script: 'Build and rehearse one focused two-minute script, then save the revised version.',
    interview: 'Repeat one interview answer using a conclusion-first structure and one specific example.',
    extempore: 'Complete one 90-second response with a clear opening, two supporting points, and a close.'
  };

  return {
    mode: targetMode,
    text: latestGrounded?.recommendation || defaults[targetMode],
    source: latestGrounded ? 'latest-session' : 'practice-plan'
  };
}
