import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNextPracticeRecommendation,
  loadPracticeGoal,
  normalizePracticeGoal,
  savePracticeGoal
} from '../src/utils/practiceGoals.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
}

test('practice goals remain within the supported weekly range', () => {
  assert.deepEqual(normalizePracticeGoal({ weeklyTarget: 99, focusMode: 'unknown' }), { weeklyTarget: 7, focusMode: 'balanced' });
  assert.deepEqual(normalizePracticeGoal({ weeklyTarget: 0, focusMode: 'interview' }), { weeklyTarget: 3, focusMode: 'interview' });
});

test('practice goals persist without requiring an account', () => {
  const storage = createStorage();
  savePracticeGoal({ weeklyTarget: 5, focusMode: 'extempore' }, storage);
  assert.deepEqual(loadPracticeGoal(storage), { weeklyTarget: 5, focusMode: 'extempore' });
});

test('next drill prefers grounded feedback for the selected focus', () => {
  const recommendation = buildNextPracticeRecommendation([
    { id: '1', mode: 'interview', recommendation: 'Lead with the conclusion, then give one quantified example.' },
    { id: '2', mode: 'script' }
  ], { weeklyTarget: 3, focusMode: 'interview' });

  assert.equal(recommendation.mode, 'interview');
  assert.equal(recommendation.source, 'latest-session');
  assert.match(recommendation.text, /quantified example/);
});

test('balanced focus recommends the least-practiced mode', () => {
  const recommendation = buildNextPracticeRecommendation([
    { id: '1', mode: 'script' },
    { id: '2', mode: 'script' },
    { id: '3', mode: 'interview' }
  ], { weeklyTarget: 3, focusMode: 'balanced' });

  assert.equal(recommendation.mode, 'extempore');
  assert.equal(recommendation.source, 'practice-plan');
});
