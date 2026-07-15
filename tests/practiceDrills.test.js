import assert from 'node:assert/strict';
import test from 'node:test';

import {
  completeMatchingPracticeDrill,
  loadPracticeDrills,
  startPracticeDrill,
  summarizePracticeDrills
} from '../src/utils/practiceDrills.js';
import { savePracticeActivity } from '../src/utils/practiceHistory.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  };
}

test('starting a new drill supersedes the previous active commitment', () => {
  const storage = createStorage();
  startPracticeDrill({ mode: 'script', text: 'Rehearse once.' }, storage, new Date('2026-07-16T10:00:00Z'));
  startPracticeDrill({ mode: 'interview', text: 'Practice one answer.' }, storage, new Date('2026-07-16T11:00:00Z'));

  const drills = loadPracticeDrills(storage);
  assert.equal(drills[0].status, 'active');
  assert.equal(drills[0].mode, 'interview');
  assert.equal(drills[1].status, 'superseded');
});

test('a later activity in the same mode completes the active drill', () => {
  const storage = createStorage();
  startPracticeDrill({ mode: 'extempore', text: 'Deliver a structured response.' }, storage, new Date('2026-07-16T10:00:00Z'));
  const completed = completeMatchingPracticeDrill({
    id: 'extempore:1',
    mode: 'extempore',
    occurredAt: '2026-07-16T10:05:00.000Z'
  }, storage);

  assert.equal(completed.status, 'completed');
  assert.equal(completed.activityId, 'extempore:1');
  assert.equal(summarizePracticeDrills(loadPracticeDrills(storage)).completedCount, 1);
});

test('saving a completed activity closes a matching drill automatically', () => {
  const storage = createStorage();
  startPracticeDrill({ mode: 'script', text: 'Save a revised script.' }, storage, new Date('2026-07-16T10:00:00Z'));
  savePracticeActivity({ id: 'script:2', mode: 'script', occurredAt: '2026-07-16T10:10:00.000Z' }, storage);

  const summary = summarizePracticeDrills(loadPracticeDrills(storage));
  assert.equal(summary.active, null);
  assert.equal(summary.latestCompleted.activityId, 'script:2');
});

test('activities in another mode do not complete the active drill', () => {
  const storage = createStorage();
  startPracticeDrill({ mode: 'interview', text: 'Practice one answer.' }, storage, new Date('2026-07-16T10:00:00Z'));
  const completed = completeMatchingPracticeDrill({ id: 'script:3', mode: 'script', occurredAt: '2026-07-16T10:05:00.000Z' }, storage);

  assert.equal(completed, null);
  assert.equal(summarizePracticeDrills(loadPracticeDrills(storage)).active.mode, 'interview');
});
