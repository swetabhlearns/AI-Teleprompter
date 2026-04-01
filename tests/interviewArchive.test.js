import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildInterviewReplayTurns,
  createInterviewArchiveSession,
  summarizeInterviewArchiveSession
} from '../src/utils/interviewArchive.js';

test('buildInterviewReplayTurns merges question, answer, and evaluation into a replay timeline', () => {
  const session = createInterviewArchiveSession({
    mode: 'live',
    config: {
      college: 'XLRI',
      interviewType: 'general',
      profile: { name: 'Arjun' }
    },
    questions: [
      {
        questionIndex: 0,
        text: 'Why do you want this program?',
        category: 'Motivation',
        askedAt: '2026-03-30T10:00:00.000Z'
      }
    ]
  });

  session.turnLog.push({
    id: 'turn-1',
    type: 'question',
    timestamp: '2026-03-30T10:00:00.000Z',
    questionIndex: 0,
    text: 'Why do you want this program?',
    category: 'Motivation',
    assistantText: 'Why do you want this program?'
  });

  session.answers = [
    {
      questionIndex: 0,
      transcript: 'I want to build leadership skills and learn from peers.',
      duration: 14,
      assistantText: 'Tell me more about your leadership goals.',
      answeredAt: '2026-03-30T10:00:18.000Z'
    }
  ];

  session.evaluations = [
    {
      questionIndex: 0,
      score: 9,
      feedback: 'Strong answer',
      strengths: ['Clear motivation'],
      improvements: ['Add one example']
    }
  ];

  const turns = buildInterviewReplayTurns(session);

  assert.equal(turns.length, 1);
  assert.equal(turns[0].status, 'answered');
  assert.equal(turns[0].assistantText, 'Tell me more about your leadership goals.');
  assert.match(turns[0].transcript, /leadership skills/);
  assert.equal(turns[0].score, 9);
});

test('summarizeInterviewArchiveSession exposes the session summary and preview fields', () => {
  const session = createInterviewArchiveSession({
    mode: 'groq',
    config: {
      college: 'ISB',
      interviewType: 'hr',
      profile: { name: 'Anika' }
    },
    questions: [
      {
        questionIndex: 0,
        text: 'What is your biggest strength?',
        category: 'Fit'
      }
    ]
  });

  session.answers = [
    {
      questionIndex: 0,
      transcript: 'My biggest strength is structured problem solving.',
      duration: 10
    }
  ];

  session.evaluations = [
    {
      questionIndex: 0,
      score: 7,
      strengths: ['Direct answer'],
      improvements: ['Mention a concrete example']
    }
  ];

  const summary = summarizeInterviewArchiveSession(session);

  assert.equal(summary.mode, 'groq');
  assert.equal(summary.college, 'ISB');
  assert.equal(summary.averageScore, 7);
  assert.equal(summary.turnCount, 1);
  assert.match(summary.firstPromptPreview, /biggest strength/);
  assert.match(summary.previewText, /biggest strength/);
  assert.match(summary.lastPromptPreview, /biggest strength/);
  assert.match(summary.lastAnswerPreview, /structured problem solving/);
});

test('summarizeInterviewArchiveSession reflects completed sessions cleanly', () => {
  const session = createInterviewArchiveSession({
    mode: 'live',
    config: {
      college: 'SPJIMR',
      interviewType: 'general',
      profile: { name: 'Asha' }
    }
  });

  session.questions = [
    {
      questionIndex: 0,
      text: 'Introduce yourself',
      category: 'Warmup',
      askedAt: '2026-03-30T10:00:00.000Z'
    }
  ];
  session.answers = [
    {
      questionIndex: 0,
      transcript: 'Hello, good morning.',
      duration: 8,
      answeredAt: '2026-03-30T10:00:10.000Z'
    }
  ];
  session.evaluations = [
    {
      questionIndex: 0,
      score: 8,
      strengths: ['Confident start'],
      improvements: ['Add a specific example']
    }
  ];
  session.status = 'completed';
  session.completedAt = '2026-03-30T10:01:00.000Z';

  const summary = summarizeInterviewArchiveSession(session);

  assert.equal(summary.status, 'completed');
  assert.equal(summary.completedAt, '2026-03-30T10:01:00.000Z');
  assert.equal(summary.turnCount, 1);
  assert.equal(summary.answerCount, 1);
  assert.equal(summary.averageScore, 8);
});
