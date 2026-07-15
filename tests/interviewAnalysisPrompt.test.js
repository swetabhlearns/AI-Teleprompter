import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAnalysisPrompt } from '../worker/src/durableObjects/InterviewLiveSessionDO.js';

test('buildAnalysisPrompt includes recorded turns when available', () => {
  const prompt = buildAnalysisPrompt(
    { config: { college: 'IIM Ahmedabad' } },
    [
      {
        role: 'assistant',
        assistantText: 'Tell me about a time you led a team.',
        transcript: ''
      },
      {
        role: 'client',
        transcript: 'I led a 4-person team to launch a product on time.'
      }
    ]
  );

  assert.match(prompt, /Tell me about a time you led a team\./);
  assert.match(prompt, /I led a 4-person team to launch a product on time\./);
  assert.doesNotMatch(prompt, /\(no turns recorded yet\)/);
});

test('buildAnalysisPrompt summarizes long logs and skips transport noise', () => {
  const turns = [
    {
      role: 'client',
      eventType: 'prompt',
      transcript: 'Tell me about a time you led a team.'
    },
    {
      role: 'assistant',
      eventType: 'gemini-message',
      assistantText: 'Please tell me about a time you led a team.',
      transcript: ''
    },
    {
      role: 'client',
      eventType: 'audio-end',
      text: 'audio-end'
    }
  ];

  for (let index = 0; index < 30; index += 1) {
    turns.push({
      role: index % 2 === 0 ? 'client' : 'assistant',
      eventType: index % 2 === 0 ? 'prompt' : 'gemini-message',
      transcript: `Turn ${index + 1} content`
    });
  }

  const prompt = buildAnalysisPrompt(
    { config: { college: 'IIM Ahmedabad' } },
    turns
  );

  assert.match(prompt, /\.\.\. \d+ turns omitted \.\.\./);
  assert.doesNotMatch(prompt, /audio-end/);
});
