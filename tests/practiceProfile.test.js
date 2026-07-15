import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPracticeProfile, detectPracticeThemes } from '../src/utils/practiceProfile.js';

test('practice themes are derived from saved coaching language', () => {
  const themes = detectPracticeThemes({
    recommendation: 'Use one specific quantified example and lead with the conclusion.'
  });

  assert.deepEqual(themes.map((theme) => theme.id), ['structure', 'examples']);
});

test('practice profile exposes repeated themes without a score', () => {
  const profile = buildPracticeProfile([
    { id: '1', mode: 'interview', recommendation: 'Use one specific example.' },
    { id: '2', mode: 'extempore', summary: 'Add a concrete example before the close.' },
    { id: '3', mode: 'script', recommendation: 'Slow the pacing.' }
  ]);

  assert.equal(profile.coverage, 3);
  assert.equal(profile.topThemes[0].id, 'examples');
  assert.equal(profile.topThemes[0].count, 2);
  assert.equal(profile.recurringThemes.length, 1);
  assert.equal('score' in profile, false);
});
