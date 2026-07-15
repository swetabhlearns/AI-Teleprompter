import { errorResponse } from './http.js';

function safeParse(value, fallback) {
  if (value == null || value === '') return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeProfile(profile = {}) {
  return {
    name: String(profile.name || ''),
    background: String(profile.background || ''),
    workExperience: String(profile.workExperience || ''),
    education: String(profile.education || ''),
    hobbies: String(profile.hobbies || ''),
    whyMba: String(profile.whyMba || '')
  };
}

function sanitizeConfig(config = {}) {
  return {
    college: String(config.college || ''),
    interviewType: String(config.interviewType || 'general'),
    interviewMode: String(config.interviewMode || 'live'),
    duration: Number(config.duration) || 0,
    profile: sanitizeProfile(config.profile)
  };
}

function formatTitle(config = {}) {
  const name = String(config.profile?.name || '').trim();
  const college = String(config.college || '').trim();
  const interviewType = String(config.interviewType || 'interview');

  if (name && college) {
    return `${name} · ${college}`;
  }

  if (college) {
    return `${college} · ${interviewType}`;
  }

  if (name) {
    return `${name} · ${interviewType}`;
  }

  return `${interviewType} Interview`;
}

function calculateAverageScore(evaluations = []) {
  const scores = evaluations
    .map((evaluation) => Number(evaluation?.score))
    .filter((score) => Number.isFinite(score));

  if (scores.length === 0) return 0;

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.round(average * 10) / 10;
}

function normalizeText(value = '') {
  return String(value || '').trim();
}

function collectTurnIndices(session = {}) {
  const indices = new Set();
  const collections = [
    session.questions,
    session.answers,
    session.evaluations,
    session.conversationTimeline,
    session.turnLog,
    session.turnLedger
  ];

  for (const collection of collections) {
    if (!Array.isArray(collection)) continue;

    for (const item of collection) {
      if (!item) continue;
      const turnIndex = Number(item.turnIndex ?? item.questionIndex);
      if (Number.isFinite(turnIndex)) {
        indices.add(turnIndex);
      }
    }
  }

  return [...indices].sort((a, b) => a - b);
}

function buildSummary(session = {}) {
  const questions = Array.isArray(session.questions) ? session.questions : [];
  const answers = Array.isArray(session.answers) ? session.answers : [];
  const evaluations = Array.isArray(session.evaluations) ? session.evaluations : [];
  const turnLedger = Array.isArray(session.turnLedger) ? session.turnLedger : [];

  return {
    turnCount: collectTurnIndices(session).length,
    answeredTurnCount: answers.filter((answer) => normalizeText(answer?.transcript) && answer?.transcript !== '[Skipped]').length,
    skippedTurnCount: answers.filter((answer) => answer?.transcript === '[Skipped]' || answer?.skipped).length,
    interruptedTurnCount: turnLedger.filter((turn) => turn?.interrupted).length,
    firstPromptPreview: normalizeText(session.turnLedger?.[0]?.assistantText || questions[0]?.text || ''),
    lastPromptPreview: normalizeText(turnLedger[turnLedger.length - 1]?.assistantText || answers[answers.length - 1]?.transcript || ''),
    firstAnswerPreview: normalizeText(answers[0]?.transcript || ''),
    lastAnswerPreview: normalizeText(answers[answers.length - 1]?.transcript || ''),
    totalTranscriptWords: answers.reduce((sum, answer) => {
      const transcript = normalizeText(answer?.transcript);
      return sum + (transcript ? transcript.split(/\s+/).filter(Boolean).length : 0);
    }, 0),
    averageScore: calculateAverageScore(evaluations.filter((evaluation) => !evaluation?.skipped)),
    mode: session.mode || session.config?.interviewMode || 'live'
  };
}

export function normalizeInterviewSessionRecord(input = {}) {
  const config = sanitizeConfig(input.config || {});
  const questions = Array.isArray(input.questions) ? input.questions : [];
  const answers = Array.isArray(input.answers) ? input.answers : [];
  const evaluations = Array.isArray(input.evaluations) ? input.evaluations : [];
  const turnLog = Array.isArray(input.turnLog) ? input.turnLog : [];
  const conversationTimeline = Array.isArray(input.conversationTimeline) ? input.conversationTimeline : [];
  const conversationLedger = Array.isArray(input.conversationLedger) ? input.conversationLedger : [];
  const transcriptTimeline = Array.isArray(input.transcriptTimeline) ? input.transcriptTimeline : [];
  const turnLedger = Array.isArray(input.turnLedger) ? input.turnLedger : [];
  const sessionSummary = input.sessionSummary && typeof input.sessionSummary === 'object' ? input.sessionSummary : {};
  const raw = input.raw && typeof input.raw === 'object' ? input.raw : {};

  return {
    id: String(input.id || generateId()),
    version: Number(input.version) || 1,
    title: String(input.title || formatTitle(config)),
    mode: String(input.mode || config.interviewMode || 'live'),
    source: String(input.source || 'interview'),
    status: String(input.status || 'active'),
    college: String(config.college || ''),
    interviewType: String(config.interviewType || 'general'),
    interviewMode: String(config.interviewMode || 'live'),
    createdAt: String(input.createdAt || nowIso()),
    updatedAt: String(input.updatedAt || nowIso()),
    endedAt: input.endedAt || null,
    completedAt: input.completedAt || null,
    config,
    processing: input.processing && typeof input.processing === 'object' ? input.processing : {},
    questions,
    answers,
    evaluations,
    turnLog,
    conversationTimeline,
    conversationLedger,
    transcriptTimeline,
    turnLedger,
    liveDiagnostics: input.liveDiagnostics || null,
    sessionSummary,
    error: input.error || null,
    raw
  };
}

function rowToSession(row) {
  if (!row) return null;

  const config = safeParse(row.config_json, {});
  const processing = safeParse(row.processing_json, {});
  const questions = safeParse(row.questions_json, []);
  const answers = safeParse(row.answers_json, []);
  const evaluations = safeParse(row.evaluations_json, []);
  const turnLog = safeParse(row.turn_log_json, []);
  const conversationTimeline = safeParse(row.conversation_timeline_json, []);
  const conversationLedger = safeParse(row.conversation_ledger_json, []);
  const transcriptTimeline = safeParse(row.transcript_timeline_json, []);
  const turnLedger = safeParse(row.turn_ledger_json, []);
  const liveDiagnostics = safeParse(row.live_diagnostics_json, null);
  const sessionSummary = safeParse(row.session_summary_json, {});
  const error = safeParse(row.error_json, null);
  const raw = safeParse(row.raw_json, {});

  return normalizeInterviewSessionRecord({
    ...raw,
    id: row.id,
    version: row.version,
    title: row.title,
    mode: row.mode,
    source: row.source,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    endedAt: row.ended_at,
    completedAt: row.completed_at,
    config,
    processing,
    questions,
    answers,
    evaluations,
    turnLog,
    conversationTimeline,
    conversationLedger,
    transcriptTimeline,
    turnLedger,
    liveDiagnostics,
    sessionSummary,
    error,
    raw
  });
}

function sessionToRow(session) {
  const rawPayload = session.raw && typeof session.raw === 'object' ? session.raw : {};
  const rawSession = {
    id: session.id,
    version: session.version || 1,
    title: session.title || '',
    mode: session.mode || 'live',
    source: session.source || 'interview',
    status: session.status || 'active',
    createdAt: session.createdAt || nowIso(),
    updatedAt: session.updatedAt || nowIso(),
    endedAt: session.endedAt || null,
    completedAt: session.completedAt || null,
    college: session.config?.college || '',
    interviewType: session.config?.interviewType || 'general',
    interviewMode: session.config?.interviewMode || 'live',
    config: session.config || {},
    processing: session.processing || {},
    liveDiagnostics: session.liveDiagnostics || null,
    sessionSummary: session.sessionSummary || {},
    error: session.error || null,
    ...rawPayload
  };

  return {
    id: session.id,
    version: session.version || 1,
    title: session.title || '',
    mode: session.mode || 'live',
    source: session.source || 'interview',
    status: session.status || 'active',
    college: session.config?.college || '',
    interview_type: session.config?.interviewType || 'general',
    interview_mode: session.config?.interviewMode || 'live',
    created_at: session.createdAt || nowIso(),
    updated_at: nowIso(),
    ended_at: session.endedAt || null,
    completed_at: session.completedAt || null,
    config_json: JSON.stringify(session.config || {}),
    processing_json: JSON.stringify(session.processing || {}),
    questions_json: JSON.stringify(session.questions || []),
    answers_json: JSON.stringify(session.answers || []),
    evaluations_json: JSON.stringify(session.evaluations || []),
    turn_log_json: JSON.stringify(session.turnLog || []),
    conversation_timeline_json: JSON.stringify(session.conversationTimeline || []),
    conversation_ledger_json: JSON.stringify(session.conversationLedger || []),
    transcript_timeline_json: JSON.stringify(session.transcriptTimeline || []),
    turn_ledger_json: JSON.stringify(session.turnLedger || []),
    live_diagnostics_json: session.liveDiagnostics == null ? null : JSON.stringify(session.liveDiagnostics),
    session_summary_json: JSON.stringify({
      ...buildSummary(session),
      ...(session.sessionSummary || {})
    }),
    error_json: session.error == null ? null : JSON.stringify(session.error),
    raw_json: JSON.stringify(rawSession)
  };
}

export async function requireDb(env) {
  if (!env?.DB) {
    throw new Error('D1 binding DB is not configured.');
  }

  return env.DB;
}

export async function listInterviewSessions(env) {
  const db = await requireDb(env);
  const result = await db.prepare(
    `SELECT
      id, version, title, mode, source, status, college, interview_type, interview_mode,
      created_at, updated_at, ended_at, completed_at,
      config_json, processing_json, questions_json, answers_json, evaluations_json,
      turn_log_json, conversation_timeline_json, conversation_ledger_json,
      transcript_timeline_json, turn_ledger_json, live_diagnostics_json,
      session_summary_json, error_json, raw_json
    FROM interview_sessions
    ORDER BY updated_at DESC, created_at DESC`
  ).all();

  return (result.results || []).map(rowToSession).map((session) => ({
    ...sessionSummaryFromSession(session),
    sessionId: session.id
  }));
}

function sessionSummaryFromSession(session = {}) {
  const questions = Array.isArray(session.questions) ? session.questions : [];
  const answers = Array.isArray(session.answers) ? session.answers : [];
  const evaluations = Array.isArray(session.evaluations) ? session.evaluations : [];

  return {
    id: session.id,
    version: session.version || 1,
    title: session.title || '',
    mode: session.mode || 'live',
    college: session.config?.college || '',
    interviewType: session.config?.interviewType || 'general',
    status: session.status || 'active',
    createdAt: session.createdAt || null,
    updatedAt: session.updatedAt || null,
    completedAt: session.completedAt || null,
    endedAt: session.endedAt || null,
    questionCount: questions.length,
    answerCount: answers.length,
    turnCount: collectTurnIndices(session).length,
    averageScore: calculateAverageScore(evaluations.filter((evaluation) => !evaluation?.skipped)),
    previewText: normalizeText(session.turnLedger?.[0]?.assistantText || questions[0]?.text || answers[answers.length - 1]?.transcript || ''),
    firstPromptPreview: normalizeText(session.turnLedger?.[0]?.assistantText || questions[0]?.text || ''),
    lastPromptPreview: normalizeText(session.turnLedger?.[session.turnLedger.length - 1]?.assistantText || answers[answers.length - 1]?.transcript || ''),
    firstAnswerPreview: normalizeText(answers[0]?.transcript || ''),
    lastAnswerPreview: normalizeText(answers[answers.length - 1]?.transcript || '')
  };
}

export async function getInterviewSession(env, id) {
  if (!id) return null;

  const db = await requireDb(env);
  const result = await db.prepare(
    `SELECT
      id, version, title, mode, source, status, college, interview_type, interview_mode,
      created_at, updated_at, ended_at, completed_at,
      config_json, processing_json, questions_json, answers_json, evaluations_json,
      turn_log_json, conversation_timeline_json, conversation_ledger_json,
      transcript_timeline_json, turn_ledger_json, live_diagnostics_json,
      session_summary_json, error_json, raw_json
    FROM interview_sessions
    WHERE id = ?`
  ).bind(id).first();

  return rowToSession(result);
}

export async function saveInterviewSession(env, sessionInput = {}) {
  const db = await requireDb(env);
  const nextSession = normalizeInterviewSessionRecord(sessionInput);
  const row = sessionToRow(nextSession);

  await db.prepare(
    `INSERT INTO interview_sessions (
      id, version, title, mode, source, status, college, interview_type, interview_mode,
      created_at, updated_at, ended_at, completed_at,
      config_json, processing_json, questions_json, answers_json, evaluations_json,
      turn_log_json, conversation_timeline_json, conversation_ledger_json,
      transcript_timeline_json, turn_ledger_json, live_diagnostics_json,
      session_summary_json, error_json, raw_json
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      version = excluded.version,
      title = excluded.title,
      mode = excluded.mode,
      source = excluded.source,
      status = excluded.status,
      college = excluded.college,
      interview_type = excluded.interview_type,
      interview_mode = excluded.interview_mode,
      updated_at = excluded.updated_at,
      ended_at = excluded.ended_at,
      completed_at = excluded.completed_at,
      config_json = excluded.config_json,
      processing_json = excluded.processing_json,
      questions_json = excluded.questions_json,
      answers_json = excluded.answers_json,
      evaluations_json = excluded.evaluations_json,
      turn_log_json = excluded.turn_log_json,
      conversation_timeline_json = excluded.conversation_timeline_json,
      conversation_ledger_json = excluded.conversation_ledger_json,
      transcript_timeline_json = excluded.transcript_timeline_json,
      turn_ledger_json = excluded.turn_ledger_json,
      live_diagnostics_json = excluded.live_diagnostics_json,
      session_summary_json = excluded.session_summary_json,
      error_json = excluded.error_json,
      raw_json = excluded.raw_json`
  ).bind(
    row.id,
    row.version,
    row.title,
    row.mode,
    row.source,
    row.status,
    row.college,
    row.interview_type,
    row.interview_mode,
    row.created_at,
    row.updated_at,
    row.ended_at,
    row.completed_at,
    row.config_json,
    row.processing_json,
    row.questions_json,
    row.answers_json,
    row.evaluations_json,
    row.turn_log_json,
    row.conversation_timeline_json,
    row.conversation_ledger_json,
    row.transcript_timeline_json,
    row.turn_ledger_json,
    row.live_diagnostics_json,
    row.session_summary_json,
    row.error_json,
    row.raw_json
  ).run();

  return nextSession;
}

export async function deleteInterviewSession(env, id) {
  if (!id) return false;

  const db = await requireDb(env);
  const result = await db.prepare('DELETE FROM interview_sessions WHERE id = ?').bind(id).run();
  return Number(result?.meta?.changes || 0) > 0;
}

export function createInterviewSession(input = {}) {
  return normalizeInterviewSessionRecord(input);
}

export function summarizeInterviewSession(session = {}) {
  return sessionSummaryFromSession(session);
}

export function toInterviewSessionError(code, message, details = null, status = 400) {
  return errorResponse(code, message, status, details);
}
