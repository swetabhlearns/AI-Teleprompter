import assert from 'node:assert/strict';
import test from 'node:test';

import { clearPracticeHistory, loadPracticeActivities, savePracticeActivity, summarizePracticeActivities } from '../src/utils/practiceHistory.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

test('practice history upserts activities and keeps newest first', () => {
  const storage = createStorage();
  savePracticeActivity({ id: 'script:1', mode: 'script', title: 'First', occurredAt: '2026-01-01T00:00:00.000Z' }, storage);
  savePracticeActivity({ id: 'interview:1', mode: 'interview', title: 'Second', occurredAt: '2026-01-02T00:00:00.000Z' }, storage);
  savePracticeActivity({ id: 'script:1', mode: 'script', title: 'Updated', occurredAt: '2026-01-03T00:00:00.000Z' }, storage);

  const activities = loadPracticeActivities(storage);
  assert.equal(activities.length, 2);
  assert.equal(activities[0].title, 'Updated');
  assert.equal(activities[1].mode, 'interview');
});

test('practice history can clear its index without touching other storage', () => {
  const storage = createStorage();
  storage.setItem('saved-script', 'keep');
  savePracticeActivity({ id: 'extempore:1', mode: 'extempore' }, storage);

  assert.equal(clearPracticeHistory(storage), true);
  assert.deepEqual(loadPracticeActivities(storage), []);
  assert.equal(storage.getItem('saved-script'), 'keep');
});

test('practice insights compare recent activity without inventing performance scores', () => {
  const insights = summarizePracticeActivities([
    { id: '1', mode: 'interview', occurredAt: '2026-07-15T10:00:00.000Z' },
    { id: '2', mode: 'interview', occurredAt: '2026-07-14T10:00:00.000Z' },
    { id: '3', mode: 'script', occurredAt: '2026-07-07T10:00:00.000Z' }
  ], new Date('2026-07-16T10:00:00.000Z'));

  assert.equal(insights.activeDays, 3);
  assert.equal(insights.recentCount, 2);
  assert.equal(insights.previousCount, 1);
  assert.equal(insights.recentDelta, 1);
  assert.equal(insights.mostPracticedMode, 'interview');
  assert.deepEqual(insights.modeTrends.interview, { current: 2, previous: 0, delta: 2 });
  assert.deepEqual(insights.modeTrends.script, { current: 0, previous: 1, delta: -1 });
  assert.equal(insights.currentStreak, 2);
  assert.equal(insights.bestStreak, 2);
  assert.equal('score' in insights, false);
});

test('practice streak remains active when the latest session was yesterday', () => {
  const insights = summarizePracticeActivities([
    { id: '1', mode: 'script', occurredAt: '2026-07-15T08:00:00.000Z' },
    { id: '2', mode: 'interview', occurredAt: '2026-07-14T23:00:00.000Z' },
    { id: '3', mode: 'extempore', occurredAt: '2026-07-12T10:00:00.000Z' },
    { id: '4', mode: 'script', occurredAt: '2026-07-11T10:00:00.000Z' },
    { id: '5', mode: 'script', occurredAt: '2026-07-10T10:00:00.000Z' }
  ], new Date('2026-07-16T18:00:00.000Z'));

  assert.equal(insights.currentStreak, 2);
  assert.equal(insights.bestStreak, 3);
});
