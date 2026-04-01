import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GEMINI_LIVE_TURN_STATES,
  buildGeminiLiveTurnContext,
  buildGeminiLiveTurnFingerprint,
  describeGeminiLiveTurnState,
  transitionGeminiLiveTurnState
} from '../src/utils/geminiLive.js';

test('Gemini live turn state transitions cover prompt, listen, interruption, recovery, and completion', () => {
  let state = GEMINI_LIVE_TURN_STATES.IDLE;

  state = transitionGeminiLiveTurnState(state, 'prompt');
  assert.equal(state, GEMINI_LIVE_TURN_STATES.PROMPTING);

  state = transitionGeminiLiveTurnState(state, 'listen');
  assert.equal(state, GEMINI_LIVE_TURN_STATES.LISTENING);

  state = transitionGeminiLiveTurnState(state, 'interrupt');
  assert.equal(state, GEMINI_LIVE_TURN_STATES.INTERRUPTED);

  state = transitionGeminiLiveTurnState(state, 'reconnect');
  assert.equal(state, GEMINI_LIVE_TURN_STATES.RECONNECTING);

  state = transitionGeminiLiveTurnState(state, 'recovered');
  assert.equal(state, GEMINI_LIVE_TURN_STATES.RECOVERED);

  state = transitionGeminiLiveTurnState(state, 'complete');
  assert.equal(state, GEMINI_LIVE_TURN_STATES.IDLE);
  assert.equal(describeGeminiLiveTurnState(state), 'Idle');
});

test('Gemini live turn context includes the current prompt, prior answer, and interruption markers', () => {
  const context = buildGeminiLiveTurnContext(
    {
      turnId: 'session:3',
      turnIndex: 2,
      questionIndex: 2,
      questionText: 'Tell me about a time you led a team.',
      assistantText: 'Tell me about a time you led a team.',
      transcriptText: 'I coordinated three engineers on a launch.',
      interrupted: true,
      retryCount: 1
    },
    {
      assistantText: 'What is your biggest strength?',
      transcriptText: 'My biggest strength is structured problem solving.'
    }
  );

  assert.match(context, /Question: Tell me about a time you led a team\./);
  assert.match(context, /Previous assistant prompt: What is your biggest strength\?/);
  assert.match(context, /Previous candidate answer: My biggest strength is structured problem solving\./);
  assert.match(context, /Current candidate transcript: I coordinated three engineers on a launch\./);
  assert.match(context, /Interruption: yes/);
  assert.match(context, /Retry count: 1/);
});

test('Gemini live turn fingerprint changes when the phase or answer content changes', () => {
  const baseTurn = {
    turnId: 'session:1',
    turnIndex: 0,
    questionIndex: 0,
    questionText: 'Introduce yourself',
    assistantText: 'Introduce yourself'
  };

  const promptFingerprint = buildGeminiLiveTurnFingerprint(baseTurn, 'turn-start');
  const answerFingerprint = buildGeminiLiveTurnFingerprint({
    ...baseTurn,
    transcriptText: 'I am a software engineer.',
    interrupted: false
  }, 'turn-complete');

  assert.notEqual(promptFingerprint, answerFingerprint);
});
