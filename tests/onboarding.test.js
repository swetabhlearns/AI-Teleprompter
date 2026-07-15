import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadOnboardingState,
  saveOnboardingState,
  shouldShowOnboarding
} from '../src/utils/onboarding.js';
import { PRACTICE_GOAL_STORAGE_KEY } from '../src/utils/practiceGoals.js';
import { PRACTICE_HISTORY_STORAGE_KEY } from '../src/utils/practiceHistory.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
}

test('onboarding appears only for an untouched browser', () => {
  const storage = createStorage();
  assert.equal(shouldShowOnboarding(storage), true);

  storage.setItem(PRACTICE_GOAL_STORAGE_KEY, JSON.stringify({ weeklyTarget: 3, focusMode: 'script' }));
  assert.equal(shouldShowOnboarding(storage), false);
});

test('existing activity prevents onboarding from interrupting a returning user', () => {
  const storage = createStorage();
  storage.setItem(PRACTICE_HISTORY_STORAGE_KEY, JSON.stringify([{ id: '1', mode: 'interview' }]));
  assert.equal(shouldShowOnboarding(storage), false);
});

test('onboarding completion and dismissal persist locally', () => {
  const completedStorage = createStorage();
  saveOnboardingState({ status: 'completed' }, completedStorage);
  assert.equal(loadOnboardingState(completedStorage).status, 'completed');
  assert.equal(shouldShowOnboarding(completedStorage), false);

  const dismissedStorage = createStorage();
  saveOnboardingState({ status: 'dismissed' }, dismissedStorage);
  assert.equal(loadOnboardingState(dismissedStorage).status, 'dismissed');
  assert.equal(shouldShowOnboarding(dismissedStorage), false);
});
