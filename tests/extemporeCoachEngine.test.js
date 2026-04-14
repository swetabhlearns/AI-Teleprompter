import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildExtemporeSessionSummary,
  evaluateExtemporeCoachSignals,
  EXTEMPORE_COACH_STATES,
  EXTEMPORE_COACH_PROMPT_TYPES
} from '../src/utils/extemporeCoachEngine.js';

test('evaluateExtemporeCoachSignals prompts a starter after the opening silence', () => {
  const result = evaluateExtemporeCoachSignals({
    topic: 'Should remote work stay permanent?',
    isRecording: true,
    isSpeaking: false,
    silenceMs: 2000,
    hasSpoken: false,
    promptHistory: []
  });

  assert.equal(result.shouldPrompt, true);
  assert.equal(result.prompt.promptType, EXTEMPORE_COACH_PROMPT_TYPES.START_HERE);
  assert.equal(result.coachState, EXTEMPORE_COACH_STATES.PAUSED);
  assert.match(result.prompt.starter, /main point/i);
});

test('evaluateExtemporeCoachSignals escalates a long pause to a bridge prompt', () => {
  const result = evaluateExtemporeCoachSignals({
    topic: 'Is AI replacing jobs?',
    isRecording: true,
    isSpeaking: false,
    silenceMs: 3300,
    hasSpoken: true,
    promptHistory: []
  });

  assert.equal(result.shouldPrompt, true);
  assert.equal(result.prompt.promptType, EXTEMPORE_COACH_PROMPT_TYPES.BRIDGE);
  assert.equal(result.coachState, EXTEMPORE_COACH_STATES.PAUSED);
  assert.match(result.prompt.message, /bridge/i);
});

test('buildExtemporeSessionSummary merges pause and prompt history into a drill', () => {
  const summary = buildExtemporeSessionSummary({
    topic: 'Should AI replace creative work?',
    durationMs: 90000,
    promptHistory: [
      {
        promptType: EXTEMPORE_COACH_PROMPT_TYPES.START_HERE,
        issueType: 'opening',
        shownAt: Date.now() - 30000
      },
      {
        promptType: EXTEMPORE_COACH_PROMPT_TYPES.RETURN_TO_POINT,
        issueType: 'drift',
        shownAt: Date.now() - 10000
      }
    ],
    pauseSegments: [
      { start: 0, end: 1800, duration: 1800 },
      { start: 7000, end: 11800, duration: 4800 }
    ],
    transcriptText: 'I think, um, AI is helpful because it saves time.',
    transcriptAnalysis: {
      fluencyScore: 58,
      overallSeverity: 'moderate',
      issueCounts: {
        drift: 1
      }
    }
  });

  assert.equal(summary.longestPauseMs, 4800);
  assert.equal(summary.promptCount, 2);
  assert.equal(summary.recoveryPromptCount, 1);
  assert.equal(summary.mostCommonIssueType, 'drift');
  assert.match(summary.recommendedDrill, /main point/i);
  assert.equal(summary.fluencyScore, 58);
});
