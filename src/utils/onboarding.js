import { PRACTICE_GOAL_STORAGE_KEY } from './practiceGoals.js';
import { PRACTICE_HISTORY_STORAGE_KEY } from './practiceHistory.js';

export const ONBOARDING_STORAGE_KEY = 'ai-tracker.onboarding.v1';

export function loadOnboardingState(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(ONBOARDING_STORAGE_KEY) || '{}');
    if (parsed?.status === 'completed' || parsed?.status === 'dismissed') return parsed;
  } catch {
    // A malformed local value should behave like a first visit.
  }
  return { status: 'new' };
}

export function saveOnboardingState(state, storage = globalThis.localStorage) {
  const normalized = {
    status: state?.status === 'completed' ? 'completed' : 'dismissed',
    updatedAt: new Date().toISOString()
  };
  try {
    storage?.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    return normalized;
  }
  return normalized;
}

export function shouldShowOnboarding(storage = globalThis.localStorage) {
  if (loadOnboardingState(storage).status !== 'new') return false;
  try {
    if (storage?.getItem(PRACTICE_GOAL_STORAGE_KEY)) return false;
    const activities = JSON.parse(storage?.getItem(PRACTICE_HISTORY_STORAGE_KEY) || '[]');
    return !Array.isArray(activities) || activities.length === 0;
  } catch {
    return true;
  }
}
