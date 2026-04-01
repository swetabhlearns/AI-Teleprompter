import { openDB } from 'idb';

export const INTERVIEW_ARCHIVE_DB_NAME = 'ai-tracker-interview-archive';
export const INTERVIEW_ARCHIVE_DB_VERSION = 1;
export const INTERVIEW_ARCHIVE_STORE = 'interview-sessions';
export const INTERVIEW_ARCHIVE_VERSION = 1;

let dbPromise;

function nowIso() {
    return new Date().toISOString();
}

function generateArchiveId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return `interview-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeClone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
}

function sanitizeProfile(profile = {}) {
    return {
        name: profile.name || '',
        background: profile.background || '',
        workExperience: profile.workExperience || '',
        education: profile.education || '',
        hobbies: profile.hobbies || '',
        whyMba: profile.whyMba || ''
    };
}

function sanitizeConfig(config = {}) {
    return {
        college: config.college || '',
        interviewType: config.interviewType || 'general',
        interviewMode: config.interviewMode || 'groq',
        duration: Number(config.duration) || 0,
        profile: sanitizeProfile(config.profile)
    };
}

function formatArchiveTitle(config = {}) {
    const name = config.profile?.name?.trim();
    const college = config.college?.trim();
    const interviewType = config.interviewType || 'interview';

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

    if (scores.length === 0) {
        return 0;
    }

    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return Math.round(average * 10) / 10;
}

function normalizePromptText(value = '') {
    return String(value || '').trim();
}

function normalizeStringList(values = []) {
    if (!Array.isArray(values)) return [];

    const seen = new Set();
    const result = [];

    for (const value of values) {
        const text = normalizePromptText(value);
        if (!text || seen.has(text)) continue;
        seen.add(text);
        result.push(text);
    }

    return result;
}

function countWords(value = '') {
    return normalizePromptText(value).split(/\s+/).filter(Boolean).length;
}

function getTurnKey(item = {}) {
    const turnIndex = Number(item?.turnIndex);
    if (Number.isFinite(turnIndex)) {
        return turnIndex;
    }

    const questionIndex = Number(item?.questionIndex);
    if (Number.isFinite(questionIndex)) {
        return questionIndex;
    }

    return null;
}

function collectTurnIndices(session = {}) {
    const indices = new Set();
    const collections = [session.questions, session.answers, session.evaluations, session.conversationTimeline, session.turnLog, session.turnLedger];

    for (const collection of collections) {
        if (!Array.isArray(collection)) continue;

        for (const item of collection) {
            if (!item) continue;
            const key = getTurnKey(item);
            if (Number.isFinite(key)) {
                indices.add(key);
            }
        }
    }

    return [...indices].sort((a, b) => a - b);
}

function buildConversationTurn(session = {}, questionIndex = 0) {
    const questions = Array.isArray(session.questions) ? session.questions : [];
    const answers = Array.isArray(session.answers) ? session.answers : [];
    const evaluations = Array.isArray(session.evaluations) ? session.evaluations : [];
    const existingTurns = Array.isArray(session.conversationTimeline) ? session.conversationTimeline : [];
    const turnLedger = Array.isArray(session.turnLedger) ? session.turnLedger : [];
    const turnLog = Array.isArray(session.turnLog) ? session.turnLog : [];

    const question = questions.find((item) => getTurnKey(item) === questionIndex) || questions[questionIndex] || null;
    const answer = answers.find((item) => getTurnKey(item) === questionIndex) || answers[questionIndex] || null;
    const evaluation = evaluations.find((item) => getTurnKey(item) === questionIndex) || evaluations[questionIndex] || null;
    const existingTurn = existingTurns.find((item) => getTurnKey(item) === questionIndex) || turnLedger.find((item) => getTurnKey(item) === questionIndex) || null;
    const questionEvent = turnLog.slice().reverse().find((item) => item?.type === 'question' && getTurnKey(item) === questionIndex) || null;
    const answerEvent = turnLog.slice().reverse().find((item) => item?.type === 'answer' && getTurnKey(item) === questionIndex) || null;
    const liveDiagnostics = answer?.liveDiagnostics
        || question?.liveDiagnostics
        || existingTurn?.liveDiagnostics
        || questionEvent?.liveDiagnostics
        || answerEvent?.liveDiagnostics
        || null;
    const turnContext = answer?.turnContext
        || question?.turnContext
        || existingTurn?.turnContext
        || questionEvent?.turnContext
        || answerEvent?.turnContext
        || null;
    const keyPoints = normalizeStringList(
        question?.keyPoints
        || questionEvent?.keyPoints
        || existingTurn?.keyPoints
        || []
    );
    const transcript = normalizePromptText(answer?.transcript || answerEvent?.transcript || existingTurn?.transcriptText || existingTurn?.transcript || '');

    const assistantText = normalizePromptText(
        answer?.assistantText ||
        existingTurn?.assistantText ||
        answerEvent?.assistantText ||
        questionEvent?.assistantText ||
        question?.assistantText ||
        question?.text ||
        ''
    );

    const askedAt = question?.askedAt || existingTurn?.askedAt || questionEvent?.timestamp || answer?.answeredAt || null;
    const answeredAt = answer?.answeredAt || existingTurn?.answeredAt || answerEvent?.timestamp || null;
    const skipped = Boolean(answer?.skipped || existingTurn?.skipped || evaluation?.skipped);
    const hasTranscript = Boolean(transcript);

    const turn = {
        questionIndex,
        turnIndex: question?.turnIndex ?? answer?.turnIndex ?? evaluation?.turnIndex ?? existingTurn?.turnIndex ?? questionEvent?.turnIndex ?? answerEvent?.turnIndex ?? questionIndex,
        status: skipped ? 'skipped' : (answer || hasTranscript || existingTurn?.transcriptText || existingTurn?.transcript) ? 'answered' : 'pending',
        mode: session.mode || session.config?.interviewMode || 'groq',
        askedAt,
        answeredAt,
        questionText: normalizePromptText(question?.text || questionEvent?.text || ''),
        questionCategory: normalizePromptText(question?.category || questionEvent?.category || existingTurn?.questionCategory || ''),
        keyPoints,
        question: question ? safeClone(question) : (questionEvent ? safeClone(questionEvent) : null),
        assistantText,
        transcript,
        answer: answer ? safeClone(answer) : (answerEvent ? safeClone(answerEvent) : null),
        evaluation: evaluation ? safeClone(evaluation) : null,
        duration: Number(answer?.duration || answerEvent?.duration || existingTurn?.duration || 0),
        score: Number.isFinite(Number(evaluation?.score)) ? Number(evaluation.score) : Number.isFinite(Number(answerEvent?.evaluation?.score)) ? Number(answerEvent.evaluation.score) : null,
        skipped,
        interrupted: Boolean(existingTurn?.interrupted || answer?.interrupted || answerEvent?.interrupted || question?.interrupted),
        liveDiagnostics: safeClone(liveDiagnostics),
        turnContext: safeClone(turnContext),
        transcriptWordCount: countWords(transcript),
        transcriptPreview: transcript.slice(0, 180),
        source: normalizePromptText(answer?.source || question?.source || existingTurn?.source || ''),
        captureMode: normalizePromptText(answer?.captureMode || question?.captureMode || existingTurn?.captureMode || ''),
        questionType: normalizePromptText(question?.type || questionEvent?.type || existingTurn?.questionType || ''),
        turnLabel: normalizePromptText(question?.label || questionEvent?.label || existingTurn?.turnLabel || '')
    };

    if (turn.answer) {
        turn.answer.assistantText = assistantText;
        if (!turn.answer.transcript) {
            turn.answer.transcript = turn.transcript;
        }
        if (!turn.answer.turnContext && turnContext) {
            turn.answer.turnContext = safeClone(turnContext);
        }
        if (!turn.answer.liveDiagnostics && liveDiagnostics) {
            turn.answer.liveDiagnostics = safeClone(liveDiagnostics);
        }
    }

    if (turn.question && !turn.question.assistantText) {
        turn.question.assistantText = assistantText;
    }

    if (turn.question && !turn.question.turnContext && turnContext) {
        turn.question.turnContext = safeClone(turnContext);
    }

    if (turn.question && !turn.question.liveDiagnostics && liveDiagnostics) {
        turn.question.liveDiagnostics = safeClone(liveDiagnostics);
    }

    return turn;
}

export function buildInterviewReplayTurns(session = {}) {
    const indices = collectTurnIndices(session);
    if (indices.length === 0) {
        return [];
    }

    return indices.map((questionIndex) => buildConversationTurn(session, questionIndex));
}

function buildInterviewSessionSummary(session = {}) {
    const turns = buildInterviewReplayTurns(session);
    const questions = Array.isArray(session.questions) ? session.questions : [];
    const answers = Array.isArray(session.answers) ? session.answers : [];
    const answeredTurns = turns.filter((turn) => turn.status === 'answered' && normalizePromptText(turn.transcript));
    const skippedTurns = turns.filter((turn) => turn.status === 'skipped' || turn.skipped);
    const interruptedTurns = turns.filter((turn) => turn.interrupted);
    const firstTurn = turns[0] || null;
    const lastTurn = turns[turns.length - 1] || null;
    const firstQuestion = questions[0] || null;
    const lastAnswer = answers[answers.length - 1] || null;
    const totalTranscriptWords = answeredTurns.reduce((sum, turn) => sum + countWords(turn.transcript), 0);
    const totalDuration = answeredTurns.reduce((sum, turn) => sum + (Number(turn.duration) || 0), 0);

    return {
        turnCount: turns.length,
        answeredTurnCount: answeredTurns.length,
        skippedTurnCount: skippedTurns.length,
        interruptedTurnCount: interruptedTurns.length,
        firstPromptPreview: normalizePromptText(firstTurn?.assistantText || firstTurn?.question?.text || firstQuestion?.text || ''),
        lastPromptPreview: normalizePromptText(lastTurn?.assistantText || lastTurn?.question?.text || lastAnswer?.transcript || ''),
        firstAnswerPreview: normalizePromptText(firstTurn?.answer?.transcript || ''),
        lastAnswerPreview: normalizePromptText(lastTurn?.answer?.transcript || lastAnswer?.transcript || ''),
        firstAskedAt: firstTurn?.askedAt || null,
        lastAnsweredAt: lastTurn?.answeredAt || lastAnswer?.answeredAt || null,
        totalTranscriptWords,
        averageWordsPerAnswer: answeredTurns.length > 0 ? Math.round((totalTranscriptWords / answeredTurns.length) * 10) / 10 : 0,
        averageAnswerDuration: answeredTurns.length > 0 ? Math.round((totalDuration / answeredTurns.length) * 10) / 10 : 0,
        mode: session.mode || session.config?.interviewMode || 'groq'
    };
}

export function createInterviewArchiveSession({
    id = generateArchiveId(),
    mode = 'groq',
    config = {},
    questions = [],
    source = 'interview'
} = {}) {
    const timestamp = nowIso();

    return {
        id,
        version: INTERVIEW_ARCHIVE_VERSION,
        createdAt: timestamp,
        updatedAt: timestamp,
        endedAt: null,
        completedAt: null,
        mode,
        source,
        title: formatArchiveTitle(config),
        config: sanitizeConfig(config),
        status: 'active',
        processing: {
            status: 'idle',
            startedAt: timestamp,
            finishedAt: null,
            error: null
        },
        questions: safeClone(questions) || [],
        turnLog: [],
        conversationTimeline: [],
        conversationLedger: [],
        transcriptTimeline: [],
        turnLedger: [],
        liveDiagnostics: null,
        sessionSummary: {},
        answers: [],
        evaluations: [],
        error: null
    };
}

export function summarizeInterviewArchiveSession(session = {}) {
    const answers = Array.isArray(session.answers) ? session.answers : [];
    const turns = buildInterviewReplayTurns(session);
    const firstQuestion = Array.isArray(session.questions) && session.questions.length > 0 ? session.questions[0] : null;
    const lastAnswer = answers.length > 0 ? answers[answers.length - 1] : null;
    const firstTurn = turns[0] || null;
    const lastTurn = turns[turns.length - 1] || null;
    const evaluations = Array.isArray(session.evaluations) ? session.evaluations : [];

    return {
        id: session.id,
        version: session.version || INTERVIEW_ARCHIVE_VERSION,
        title: session.title || formatArchiveTitle(session.config || {}),
        mode: session.mode || session.config?.interviewMode || 'groq',
        college: session.config?.college || '',
        interviewType: session.config?.interviewType || 'general',
        status: session.status || 'active',
        createdAt: session.createdAt || null,
        updatedAt: session.updatedAt || null,
        completedAt: session.completedAt || null,
        endedAt: session.endedAt || null,
        questionCount: Array.isArray(session.questions) ? session.questions.length : 0,
        answerCount: answers.length,
        turnCount: turns.length,
        averageScore: calculateAverageScore(evaluations.filter((evaluation) => !evaluation?.skipped)),
        previewText: firstTurn?.assistantText || firstQuestion?.text || lastAnswer?.transcript || '',
        firstPromptPreview: firstTurn?.assistantText || firstQuestion?.text || '',
        lastPromptPreview: lastTurn?.assistantText || lastAnswer?.transcript || '',
        firstAnswerPreview: firstTurn?.answer?.transcript || '',
        lastAnswerPreview: lastTurn?.answer?.transcript || lastAnswer?.transcript || ''
    };
}

async function getDb() {
    if (!dbPromise) {
        dbPromise = openDB(INTERVIEW_ARCHIVE_DB_NAME, INTERVIEW_ARCHIVE_DB_VERSION, {
            upgrade(db) {
                const store = db.createObjectStore(INTERVIEW_ARCHIVE_STORE, { keyPath: 'id' });
                store.createIndex('byUpdatedAt', 'updatedAt');
                store.createIndex('byCreatedAt', 'createdAt');
                store.createIndex('byStatus', 'status');
            }
        });
    }

    return dbPromise;
}

export async function saveInterviewArchiveSession(session) {
    const db = await getDb();
    const next = {
        ...safeClone(session),
        updatedAt: nowIso()
    };

    await db.put(INTERVIEW_ARCHIVE_STORE, next);
    return next;
}

export async function getInterviewArchiveSession(id) {
    if (!id) return null;

    const db = await getDb();
    const session = await db.get(INTERVIEW_ARCHIVE_STORE, id);
    return session ? safeClone(session) : null;
}

export async function listInterviewArchiveSessions() {
    const db = await getDb();
    const sessions = await db.getAll(INTERVIEW_ARCHIVE_STORE);

    return sessions
        .map((session) => safeClone(session))
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .map((session) => ({
            ...summarizeInterviewArchiveSession(session),
            sessionId: session.id
        }));
}

async function updateInterviewArchiveSession(id, updater) {
    const db = await getDb();
    const current = await db.get(INTERVIEW_ARCHIVE_STORE, id);

    if (!current) {
        return null;
    }

    const next = typeof updater === 'function'
        ? updater(safeClone(current))
        : { ...safeClone(current), ...safeClone(updater) };

    if (!next) {
        return null;
    }

    next.updatedAt = nowIso();
    await db.put(INTERVIEW_ARCHIVE_STORE, next);
    return next;
}

function upsertArrayByQuestionIndex(collection = [], item = {}) {
    const key = getTurnKey(item);
    const index = collection.findIndex((entry) => getTurnKey(entry) === key);
    const next = safeClone(collection) || [];

    if (index >= 0) {
        next[index] = item;
        return next;
    }

    next.push(item);
    return next;
}

function upsertConversationTimeline(collection = [], item = {}) {
    const key = getTurnKey(item);
    const index = collection.findIndex((entry) => getTurnKey(entry) === key);
    const next = safeClone(collection) || [];
    const merged = {
        ...(index >= 0 ? next[index] : {}),
        ...safeClone(item),
        question: item.question || (index >= 0 ? next[index]?.question : null),
        answer: item.answer || (index >= 0 ? next[index]?.answer : null),
        evaluation: item.evaluation || (index >= 0 ? next[index]?.evaluation : null)
    };

    if (index >= 0) {
        next[index] = merged;
        return next;
    }

    next.push(merged);
    return next;
}

function mergeConversationSnapshot(session = {}, snapshot = {}) {
    const conversationLedger = Array.isArray(snapshot.conversationLedger)
        ? safeClone(snapshot.conversationLedger)
        : Array.isArray(snapshot.conversationEvents)
            ? safeClone(snapshot.conversationEvents)
            : [];
    const transcriptTimeline = Array.isArray(snapshot.transcriptTimeline)
        ? safeClone(snapshot.transcriptTimeline)
        : [];
    const turnLedger = Array.isArray(snapshot.turnLedger)
        ? safeClone(snapshot.turnLedger)
        : Array.isArray(snapshot.turnLog)
            ? safeClone(snapshot.turnLog)
            : [];
    const liveDiagnostics = snapshot.liveDiagnostics && typeof snapshot.liveDiagnostics === 'object'
        ? safeClone(snapshot.liveDiagnostics)
        : Array.isArray(snapshot.liveDiagnostics)
            ? safeClone(snapshot.liveDiagnostics)
            : normalizePromptText(snapshot.liveDiagnostics || '') || null;
    const sessionSummary = snapshot.sessionSummary && typeof snapshot.sessionSummary === 'object'
        ? safeClone(snapshot.sessionSummary)
        : {};

    if (conversationLedger.length > 0) {
        session.conversationLedger = conversationLedger;
    }

    if (transcriptTimeline.length > 0) {
        session.transcriptTimeline = transcriptTimeline;
    }

    if (turnLedger.length > 0) {
        session.turnLedger = turnLedger;
    }

    if (liveDiagnostics) {
        session.liveDiagnostics = liveDiagnostics;
    }

    if (Object.keys(sessionSummary).length > 0) {
        session.sessionSummary = {
            ...(session.sessionSummary || {}),
            ...sessionSummary
        };
    }

    if (normalizePromptText(snapshot.transcriptText || '')) {
        session.sessionSummary = {
            ...(session.sessionSummary || {}),
            transcriptText: normalizePromptText(snapshot.transcriptText || ''),
            transcriptWordCount: Number.isFinite(Number(snapshot.transcriptWordCount))
                ? Number(snapshot.transcriptWordCount)
                : countWords(snapshot.transcriptText || '')
        };
    }

    if (normalizePromptText(snapshot.sessionTranscriptText || '')) {
        session.sessionSummary = {
            ...(session.sessionSummary || {}),
            sessionTranscriptText: normalizePromptText(snapshot.sessionTranscriptText || ''),
            sessionTranscriptWordCount: Number.isFinite(Number(snapshot.sessionTranscriptWordCount))
                ? Number(snapshot.sessionTranscriptWordCount)
                : countWords(snapshot.sessionTranscriptText || '')
        };
    }

    if (normalizePromptText(snapshot.latestAssistantText || '')) {
        session.sessionSummary = {
            ...(session.sessionSummary || {}),
            latestAssistantText: normalizePromptText(snapshot.latestAssistantText || '')
        };
    }

    if (normalizePromptText(snapshot.latestTranscript || '')) {
        session.sessionSummary = {
            ...(session.sessionSummary || {}),
            latestTranscript: normalizePromptText(snapshot.latestTranscript || '')
        };
    }

    if (normalizePromptText(snapshot.currentTurnTranscript || '')) {
        session.sessionSummary = {
            ...(session.sessionSummary || {}),
            currentTurnTranscript: normalizePromptText(snapshot.currentTurnTranscript || '')
        };
    }

    if (snapshot.currentTurn) {
        session.currentTurn = safeClone(snapshot.currentTurn);
    }

    return session;
}

export async function updateInterviewArchiveConversation(sessionId, snapshot = {}) {
    return updateInterviewArchiveSession(sessionId, (session) => {
        return mergeConversationSnapshot(session, snapshot);
    });
}

function createTurnEntry(type, payload = {}) {
    return {
        id: generateArchiveId(),
        type,
        timestamp: nowIso(),
        ...safeClone(payload)
    };
}

export async function appendInterviewQuestion(sessionId, payload = {}) {
    return updateInterviewArchiveSession(sessionId, (session) => {
        mergeConversationSnapshot(session, payload.conversationSnapshot || payload.liveConversation || payload);
        const questionIndex = Number.isFinite(Number(payload.questionIndex))
            ? Number(payload.questionIndex)
            : session.questions.length;
        const turnIndex = Number.isFinite(Number(payload.turnIndex))
            ? Number(payload.turnIndex)
            : questionIndex;
        const question = {
            questionIndex,
            turnIndex,
            text: String(payload.text || payload.question || '').trim(),
            category: payload.category || '',
            keyPoints: Array.isArray(payload.keyPoints) ? safeClone(payload.keyPoints) : [],
            askedAt: payload.askedAt || nowIso()
        };

        session.questions = upsertArrayByQuestionIndex(session.questions, question);
        session.conversationTimeline = upsertConversationTimeline(session.conversationTimeline, {
            questionIndex,
            turnIndex,
            askedAt: question.askedAt,
            question,
            assistantText: normalizePromptText(payload.assistantText || question.text),
            status: 'asked'
        });
        session.turnLog = [...session.turnLog, createTurnEntry('question', {
            questionIndex,
            turnIndex,
            text: question.text,
            category: question.category,
            keyPoints: question.keyPoints,
            assistantText: normalizePromptText(payload.assistantText || question.text)
        })];

        return session;
    });
}

export async function appendInterviewAnswer(sessionId, payload = {}) {

    return updateInterviewArchiveSession(sessionId, (session) => {
        mergeConversationSnapshot(session, payload.conversationSnapshot || payload.liveConversation || payload);
        const questionIndex = Number.isFinite(Number(payload.questionIndex))
            ? Number(payload.questionIndex)
            : session.answers.length;
        const turnIndex = Number.isFinite(Number(payload.turnIndex))
            ? Number(payload.turnIndex)
            : questionIndex;
        const evaluation = payload.evaluation ? safeClone(payload.evaluation) : null;
        const assistantText = normalizePromptText(payload.assistantText || payload.question?.text || '');
        const answer = {
            questionIndex,
            turnIndex,
            transcript: String(payload.transcript || '').trim(),
            duration: Number(payload.duration) || 0,
            question: payload.question ? safeClone(payload.question) : null,
            category: payload.category || '',
            skipped: Boolean(payload.skipped),
            answeredAt: payload.answeredAt || nowIso(),
            assistantText,
            evaluation
        };

        session.answers = upsertArrayByQuestionIndex(session.answers, answer);

        if (evaluation) {
            const normalizedEvaluation = {
                ...evaluation,
                questionIndex,
                turnIndex
            };
            session.evaluations = upsertArrayByQuestionIndex(session.evaluations, normalizedEvaluation);
        }

        session.conversationTimeline = upsertConversationTimeline(session.conversationTimeline, {
            questionIndex,
            turnIndex,
            askedAt: payload.question?.askedAt || session.conversationTimeline?.find((item) => getTurnKey(item) === turnIndex)?.askedAt || null,
            answeredAt: answer.answeredAt,
            duration: answer.duration,
            question: answer.question,
            assistantText,
            answer,
            evaluation: evaluation ? {
                ...evaluation,
                questionIndex,
                turnIndex
            } : null,
            skipped: answer.skipped,
            status: answer.skipped ? 'skipped' : 'answered'
        });

        session.turnLog = [...session.turnLog, createTurnEntry('answer', {
            questionIndex,
            turnIndex,
            transcript: answer.transcript,
            duration: answer.duration,
            skipped: answer.skipped,
            assistantText,
            evaluation
        })];

        return session;
    });
}

export async function updateInterviewArchiveQuestions(sessionId, questions = []) {
    return updateInterviewArchiveSession(sessionId, (session) => {
        session.questions = safeClone(questions) || [];
        session.turnLog = [...session.turnLog, createTurnEntry('question-bank', {
            questionCount: session.questions.length
        })];
        return session;
    });
}

export async function completeInterviewArchiveSession(sessionId, results = null) {
    return updateInterviewArchiveSession(sessionId, (session) => {
        mergeConversationSnapshot(session, results?.conversationSnapshot || results?.liveConversation || results || {});

        session.status = 'completed';
        session.processing = {
            ...session.processing,
            status: 'completed',
            finishedAt: nowIso(),
            error: null
        };
        session.completedAt = nowIso();
        session.endedAt = session.completedAt;
        session.conversationTimeline = Array.isArray(session.conversationTimeline) && session.conversationTimeline.length > 0
            ? session.conversationTimeline
            : buildInterviewReplayTurns(session);
        session.sessionSummary = buildInterviewSessionSummary(session);

        return session;
    });
}

export async function failInterviewArchiveSession(sessionId, errorMessage = '', results = null) {
    return updateInterviewArchiveSession(sessionId, (session) => {
        mergeConversationSnapshot(session, results?.conversationSnapshot || results?.liveConversation || results || {});

        session.status = 'error';
        session.processing = {
            ...session.processing,
            status: 'error',
            finishedAt: nowIso(),
            error: String(errorMessage || 'Interview failed')
        };
        session.endedAt = nowIso();
        session.error = String(errorMessage || 'Interview failed');
        session.conversationTimeline = Array.isArray(session.conversationTimeline) && session.conversationTimeline.length > 0
            ? session.conversationTimeline
            : buildInterviewReplayTurns(session);
        session.sessionSummary = buildInterviewSessionSummary(session);

        return session;
    });
}

export async function deleteInterviewArchiveSession(sessionId) {
    if (!sessionId) return false;

    const db = await getDb();
    await db.delete(INTERVIEW_ARCHIVE_STORE, sessionId);
    return true;
}

export async function exportInterviewArchiveSession(sessionId) {
    const session = await getInterviewArchiveSession(sessionId);
    if (!session) return null;

    return safeClone(session);
}

export function downloadInterviewArchiveSession(session, fileName = '') {
    if (!session) return false;

    const payload = safeClone(session);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const timestamp = session.completedAt || session.endedAt || session.updatedAt || session.createdAt || nowIso();
    const safeStamp = String(timestamp).replace(/[:.]/g, '-');

    anchor.href = url;
    anchor.download = fileName || `interview-archive-${safeStamp}.json`;
    anchor.rel = 'noopener';
    anchor.click();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 0);

    return true;
}
