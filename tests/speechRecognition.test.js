import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSpeechRecognitionSnapshot } from '../src/utils/speechRecognition.js';

test('buildSpeechRecognitionSnapshot separates final and interim speech results', () => {
  const results = {
    0: {
      0: { transcript: 'The main point is' },
      isFinal: true
    },
    1: {
      0: { transcript: ' that AI is helpful' },
      isFinal: false
    },
    length: 2
  };

  const snapshot = buildSpeechRecognitionSnapshot(results);

  assert.equal(snapshot.transcriptText, 'The main point is');
  assert.equal(snapshot.interimTranscriptText, 'that AI is helpful');
  assert.equal(snapshot.combinedTranscriptText, 'The main point is that AI is helpful');
  assert.equal(snapshot.fragments.length, 2);
  assert.equal(snapshot.fragments[0].isFinal, true);
  assert.equal(snapshot.fragments[1].isFinal, false);
});

