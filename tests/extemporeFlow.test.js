import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildRollingDeck,
  getBlueprintStageIndex,
  getSelectionPhaseCopy,
  EXTEMPORE_CENTER_INDEX
} from '../src/utils/extemporeFlow.js';

function createRandomSequence(values) {
  let index = 0;

  return () => {
    const value = values[index % values.length];
    index += 1;
    return value;
  };
}

test('buildRollingDeck keeps the chosen topic in the final center lock', () => {
  const topics = ['Topic A', 'Topic B', 'Topic C', 'Topic D'];
  const randomFn = createRandomSequence([0.75, 0.2, 0.9, 0.1, 0.6, 0.3, 0.8, 0.05]);

  const { deck, targetIndex, winningTopic } = buildRollingDeck(topics, randomFn, 6);

  assert.equal(deck.length, topics.length * 6);
  assert.equal(deck[targetIndex], winningTopic);
  assert.ok(targetIndex >= EXTEMPORE_CENTER_INDEX);
  assert.ok(topics.includes(winningTopic));
});

test('getBlueprintStageIndex advances the active cue with speaking progress', () => {
  assert.equal(getBlueprintStageIndex(0, false), 1);
  assert.equal(getBlueprintStageIndex(0, true), 0);
  assert.equal(getBlueprintStageIndex(20000, true), 0);
  assert.equal(getBlueprintStageIndex(59000, true), 1);
  assert.equal(getBlueprintStageIndex(90000, true), 2);
  assert.equal(getBlueprintStageIndex(120000, true), 3);
});

test('getSelectionPhaseCopy explains the explicit start flow', () => {
  const idleCopy = getSelectionPhaseCopy('idle', true, false);
  const loadingCopy = getSelectionPhaseCopy('idle', false, true);
  const randomizingCopy = getSelectionPhaseCopy('randomizing', true, false);
  const lockedCopy = getSelectionPhaseCopy('locked', true, false);

  assert.equal(idleCopy.badge, 'Idle');
  assert.equal(idleCopy.actionLabel, 'Start Random Topic');
  assert.equal(idleCopy.isActionDisabled, false);
  assert.equal(loadingCopy.actionLabel, 'Loading Topics...');
  assert.equal(loadingCopy.isActionDisabled, true);
  assert.equal(randomizingCopy.badge, 'Randomizing');
  assert.equal(randomizingCopy.isActionDisabled, true);
  assert.equal(lockedCopy.badge, 'Locked');
  assert.equal(lockedCopy.actionLabel, 'Selected');
});
