import { GoogleGenAI } from '@google/genai';
import {
  connectGeminiLiveSession,
  endGeminiAudioTurn,
  normalizeGeminiLiveClientError,
  sendGeminiAudioChunk,
  sendGeminiPrompt
} from '../../../src/utils/geminiLiveClient.js';
import { jsonResponse } from '../lib/http.js';
import {
  saveInterviewSession
} from '../lib/db.js';
import { validateInterviewDuration } from '../lib/protection.js';

const LIVE_SESSION_STORAGE_KEY = 'live-session';
const DEFAULT_LIVE_MODEL = 'gemini-3.1-flash-live-preview';

function nowIso() {
  return new Date().toISOString();
}

function safeClone(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function resolveConfiguredLiveModel(env = {}) {
  return String(env.GEMINI_LIVE_MODEL || DEFAULT_LIVE_MODEL).trim();
}

function summarizePayload(payload = {}) {
  const next = {};

  for (const [key, value] of Object.entries(payload || {})) {
    if (key === 'data' || key === 'raw' || key === 'serverContent' || key === 'server_content') {
      continue;
    }

    if (key === 'inlineData' || key === 'inline_data') {
      const inlineData = value && typeof value === 'object' ? value : {};
      next.inlineData = {
        mimeType: String(inlineData.mimeType || inlineData.mime_type || ''),
        byteLength: String(inlineData.data || '').length
      };
      continue;
    }

    if (typeof value === 'string' && value.length > 500) {
      next[key] = `${value.slice(0, 497).trimEnd()}...`;
      continue;
    }

    next[key] = safeClone(value);
  }

  return next;
}

function isBoundaryTurnEvent(eventType = '') {
  return !['audio-chunk', 'message'].includes(String(eventType || '').trim());
}

function normalizeLiveSession(input = {}) {
  const config = input.config && typeof input.config === 'object' ? input.config : {};
  const liveState = input.liveState && typeof input.liveState === 'object' ? input.liveState : {};
  const turnLog = Array.isArray(input.turnLog) ? input.turnLog : [];

  return {
    id: String(input.id || ''),
    archiveSessionId: String(input.archiveSessionId || input.id || ''),
    status: String(input.status || 'active'),
    phase: String(input.phase || 'interview'),
    analysisStatus: String(input.analysisStatus || 'idle'),
    liveModel: String(input.liveModel || input.liveState?.liveModel || input.raw?.liveModel || ''),
    createdAt: String(input.createdAt || nowIso()),
    updatedAt: String(input.updatedAt || nowIso()),
    completedAt: input.completedAt || null,
    lastEventAt: input.lastEventAt || null,
    error: input.error || null,
    config,
    liveState,
    turnLog,
    raw: input.raw && typeof input.raw === 'object' ? input.raw : {},
    ownerHash: String(input.ownerHash || ''),
    liveAccessTokenHash: String(input.liveAccessTokenHash || '')
  };
}

function base64ToBytes(value = '') {
  const text = String(value || '');
  if (!text) return new Uint8Array();

  if (typeof globalThis.Buffer !== 'undefined') {
    return new Uint8Array(globalThis.Buffer.from(text, 'base64'));
  }

  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function buildInterviewPrompt(config = {}) {
  const {
    college = 'a top B-school',
    interviewType = 'general',
    duration = 10,
    profile = {}
  } = config;

  return `You are an experienced MBA interviewer for ${college}.
You are running a ${interviewType} interview.
Interview duration target: about ${duration} minutes.
The candidate profile is background context only:
- Name: ${profile.name || 'Candidate'}
- Background: ${profile.background || 'Not specified'}
- Work Experience: ${profile.workExperience || 'Not specified'}
- Education: ${profile.education || 'Not specified'}
- Hobbies: ${profile.hobbies || 'Not specified'}
- Why MBA: ${profile.whyMba || 'Not specified'}

Interview behavior rules:
- Ask one concise question at a time.
- Keep it professional, warm, and realistic.
- Use the profile to personalize questions, verify claims, and probe inconsistencies.
- Wait for the candidate's opening greeting or introduction before beginning.
- After the candidate answers, acknowledge briefly and move to the next question or a follow-up.`;
}

export function buildAnalysisPrompt(session = {}, turns = []) {
  const interviewConfig = session.config || {};
  const meaningfulTurns = turns
    .filter((turn) => !['audio-chunk', 'audio-end', 'session-state', 'session-open', 'session-start'].includes(turn?.eventType))
    .map((turn) => {
      const role = turn?.role === 'assistant'
        ? 'Assistant'
        : turn?.role === 'system'
          ? 'System'
          : 'Candidate';
      const text = String(
        turn?.transcript
        || turn?.text
        || turn?.assistantText
        || turn?.questionText
        || turn?.payload?.transcript
        || ''
      ).trim();
      if (!text) {
        return '';
      }
      return `${role}: ${text.length > 220 ? `${text.slice(0, 217).trimEnd()}...` : text}`;
    })
    .filter(Boolean);

  let recentTurns = meaningfulTurns.join('\n');
  if (meaningfulTurns.length > 24) {
    const head = meaningfulTurns.slice(0, 6);
    const tail = meaningfulTurns.slice(-16);
    const omitted = meaningfulTurns.length - head.length - tail.length;
    recentTurns = [...head, `... ${omitted} turns omitted ...`, ...tail].join('\n');
  }

  return `Switch into post-interview analysis mode for the MBA admissions interview.
Use the conversation history to provide:
1. A concise overall assessment.
2. Key strengths and risks.
3. A read on fit for ${interviewConfig.college || 'the target school'}.
4. Specific follow-up recommendations for the candidate.

Keep the response structured and grounded in the actual interview. Do not start a new interview question.

Recent conversation:
${recentTurns || '(no turns recorded yet)'}`;
}

function extractGeneratedText(response) {
  const directText = String(response?.text || '').trim();
  if (directText) {
    return directText;
  }

  const parts = response?.candidates?.[0]?.content?.parts || [];
  return String(parts.map((part) => part?.text || '').filter(Boolean).join(' ') || '').trim();
}

function extractMessagePayload(message) {
  if (typeof message?.data === 'string') {
    try {
      return JSON.parse(message.data);
    } catch {
      return { type: 'text', text: message.data };
    }
  }

  return message?.data || null;
}

function buildWebSocketUrl(request, sessionId) {
  const url = new URL(request.url);
  url.pathname = `/api/interview/live-sessions/${encodeURIComponent(sessionId)}/ws`;
  url.search = '';
  return url.toString().replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
}

function extractSessionIdFromLiveSessionUrl(url) {
  const match = String(url?.pathname || '').match(/^\/api\/interview\/live-sessions\/([^/]+)(?:\/(ws|log|complete|fail))?$/);
  return match ? decodeURIComponent(match[1]) : '';
}

export class InterviewLiveSessionDO {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessionId = '';
    this.clients = new Set();
    this.liveSession = null;
    this.ai = null;
    this.liveModel = '';
    this.liveConnection = null;
    this.resolved = false;
    this.systemInstruction = '';
    this.config = {};
    this.phase = 'interview';
    this.analysisStatus = 'idle';
    this.turnSequence = 0;
    this.lastAssistantText = '';
    this.lastTranscript = '';
    this.pendingGeminiTurn = null;
    this.analysisCompleted = false;
    this.analysisAlarmAt = null;
    this.analysisTask = null;
  }

  getAnalysisDelayMs() {
    const durationMinutes = Number(this.config?.duration);
    const safeMinutes = Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 10;
    return Math.max(60_000, Math.round(safeMinutes * 60_000) + 30_000);
  }

  async scheduleAnalysisFallbackAlarm() {
    const alarmAt = Date.now() + this.getAnalysisDelayMs();
    this.analysisAlarmAt = alarmAt;

    if (typeof this.state?.storage?.setAlarm === 'function') {
      await this.state.storage.setAlarm(alarmAt);
    }

    return alarmAt;
  }

  async clearAnalysisFallbackAlarm() {
    this.analysisAlarmAt = null;

    if (typeof this.state?.storage?.deleteAlarm === 'function') {
      await this.state.storage.deleteAlarm();
    }
  }

  async loadLiveSessionRecord() {
    if (this.liveSession) {
      return this.liveSession;
    }

    const stored = typeof this.state?.storage?.get === 'function'
      ? await this.state.storage.get(LIVE_SESSION_STORAGE_KEY)
      : null;

    if (stored) {
      this.liveSession = normalizeLiveSession(stored);
      this.config = this.liveSession.config || {};
      this.phase = this.liveSession.phase || 'interview';
      this.analysisStatus = this.liveSession.analysisStatus || 'idle';
      this.liveModel = String(this.liveSession?.liveModel || this.liveSession?.liveState?.liveModel || this.liveSession?.raw?.liveModel || this.liveModel || '');
      this.turnSequence = Array.isArray(this.liveSession.turnLog) ? this.liveSession.turnLog.length : 0;
      return this.liveSession;
    }

    return null;
  }

  async ensureLiveSessionRecord() {
    const current = await this.loadLiveSessionRecord();
    if (current) {
      return current;
    }

    this.liveSession = normalizeLiveSession({
      id: this.sessionId,
      archiveSessionId: this.sessionId,
      status: 'active',
      phase: 'interview',
      analysisStatus: 'idle',
      config: this.config,
      liveState: {
        phase: 'interview',
        analysisStatus: 'idle'
      }
    });

    if (typeof this.state?.storage?.put === 'function') {
      await this.state.storage.put(LIVE_SESSION_STORAGE_KEY, this.liveSession);
    }

    return this.liveSession;
  }

  async persistLiveSessionRecord(sessionPatch = {}) {
    const current = await this.ensureLiveSessionRecord();
    this.liveSession = normalizeLiveSession({
      ...current,
      ...sessionPatch,
      id: this.sessionId,
      archiveSessionId: current.archiveSessionId || this.sessionId,
      updatedAt: nowIso()
    });

    if (typeof this.state?.storage?.put === 'function') {
      await this.state.storage.put(LIVE_SESSION_STORAGE_KEY, this.liveSession);
    }

    return this.liveSession;
  }

  async appendLiveTurn(turn = {}) {
    const current = await this.ensureLiveSessionRecord();

    const nextSequence = Number.isFinite(Number(turn.sequence))
      ? Number(turn.sequence)
      : Array.isArray(current.turnLog)
        ? current.turnLog.length
        : 0;

    const nextTurn = {
      id: String(turn.id || `${this.sessionId}:${String(nextSequence).padStart(6, '0')}`),
      sessionId: this.sessionId,
      sequence: nextSequence,
      phase: String(turn.phase || current.phase || 'interview'),
      role: String(turn.role || 'system'),
      eventType: String(turn.eventType || 'event'),
      turnIndex: Number.isFinite(Number(turn.turnIndex)) ? Number(turn.turnIndex) : null,
      questionIndex: Number.isFinite(Number(turn.questionIndex)) ? Number(turn.questionIndex) : null,
      text: String(turn.text || '').trim(),
      transcript: String(turn.transcript || '').trim(),
      payload: turn.payload && typeof turn.payload === 'object' ? summarizePayload(turn.payload) : {},
      createdAt: String(turn.createdAt || nowIso())
    };

    this.turnSequence = Math.max(this.turnSequence, nextSequence + 1);
    this.liveSession = normalizeLiveSession({
      ...current,
      turnLog: [...(Array.isArray(current.turnLog) ? current.turnLog : []), nextTurn],
      liveState: {
        ...(current.liveState || {}),
        lastEventAt: nextTurn.createdAt,
        lastEventType: nextTurn.eventType
      },
      updatedAt: nowIso(),
      lastEventAt: nextTurn.createdAt
    });

    if (isBoundaryTurnEvent(nextTurn.eventType) && typeof this.state?.storage?.put === 'function') {
      await this.state.storage.put(LIVE_SESSION_STORAGE_KEY, this.liveSession);
    }

    return nextTurn;
  }

  async flushPendingGeminiTurn(options = {}) {
    if (!this.pendingGeminiTurn) {
      return null;
    }

    const draft = this.pendingGeminiTurn;
    this.pendingGeminiTurn = null;

    return this.appendLiveTurn({
      sessionId: this.sessionId,
      phase: draft.phase || this.phase || 'interview',
      role: 'assistant',
      eventType: draft.turnComplete || options.force ? 'gemini-message-final' : 'gemini-message',
      text: draft.assistantText || '',
      transcript: draft.inputTranscript || draft.outputTranscript || '',
      payload: summarizePayload({
        turnComplete: draft.turnComplete,
        interrupted: draft.interrupted,
        assistantText: draft.assistantText || '',
        inputTranscript: draft.inputTranscript || '',
        outputTranscript: draft.outputTranscript || ''
      }),
      createdAt: draft.createdAt || nowIso(),
      turnIndex: Number.isFinite(Number(draft.turnIndex)) ? Number(draft.turnIndex) : null,
      questionIndex: Number.isFinite(Number(draft.questionIndex)) ? Number(draft.questionIndex) : null
    });
  }

  async listLiveTurns() {
    const current = await this.loadLiveSessionRecord();
    return Array.isArray(current?.turnLog) ? current.turnLog.map((turn) => ({ ...turn })) : [];
  }

  async ensureGeminiSession() {
    if (this.liveConnection) {
      return this.liveConnection;
    }

    if (!this.env?.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey: this.env.GEMINI_API_KEY });
    }

    if (!this.liveModel) {
      this.liveModel = resolveConfiguredLiveModel(this.env);
    }

    const model = this.liveModel;

    this.liveConnection = await connectGeminiLiveSession({
      ai: this.ai,
      model,
      config: {
        silenceDurationMs: 2200,
        systemInstruction: this.systemInstruction || buildInterviewPrompt(this.config)
      },
      callbacks: {
        onopen: () => {
          void this.persistAndBroadcast({
            type: 'session-open',
            phase: this.phase,
            analysisStatus: this.analysisStatus,
            model: this.liveModel
          });
        },
        onmessage: (message) => {
          void this.handleGeminiMessage(message);
        },
        onerror: (error) => {
          void this.handleGeminiError(error);
        },
        onclose: (event) => {
          void this.handleGeminiClose(event);
        }
      }
    });

    return this.liveConnection;
  }

  async persistSessionPatch(patch = {}) {
    return this.persistLiveSessionRecord(patch);
  }

  async persistAndBroadcast(payload = {}, turn = null, options = {}) {
    if (turn) {
      await this.appendLiveTurn(turn);
    }

    await this.persistSessionPatch({
      phase: payload.phase || this.phase,
      analysisStatus: payload.analysisStatus || this.analysisStatus,
      liveModel: this.liveModel,
      liveState: {
        ...(this.liveSession?.liveState || {}),
        phase: payload.phase || this.phase,
        analysisStatus: payload.analysisStatus || this.analysisStatus,
        liveModel: this.liveModel,
        lastEventType: payload.type || 'session-state',
        lastAssistantText: this.lastAssistantText,
        lastTranscript: this.lastTranscript
      }
    });

    const nextPayload = {
      type: payload.type || 'session-state',
      sessionId: this.sessionId,
      phase: payload.phase || this.phase,
      analysisStatus: payload.analysisStatus || this.analysisStatus,
      model: this.liveModel,
      lastAssistantText: this.lastAssistantText,
      lastTranscript: this.lastTranscript,
      serverContent: safeClone(payload?.serverContent || null),
      ...safeClone(payload)
    };

    if (options.silent) {
      return nextPayload;
    }

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(nextPayload));
      }
    }

    return nextPayload;
  }

  async broadcastSessionPayload(payload = {}) {
    const nextPayload = {
      type: payload.type || 'session-state',
      sessionId: this.sessionId,
      phase: payload.phase || this.phase,
      analysisStatus: payload.analysisStatus || this.analysisStatus,
      model: this.liveModel,
      lastAssistantText: this.lastAssistantText,
      lastTranscript: this.lastTranscript,
      serverContent: safeClone(payload?.serverContent || null),
      ...safeClone(payload)
    };

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(nextPayload));
      }
    }

    return nextPayload;
  }

  async beginAnalysis(source = 'client-complete') {
    if (this.analysisCompleted || this.phase === 'completed' || this.analysisStatus === 'running') {
      return;
    }

    this.phase = 'analysis';
    this.analysisStatus = 'running';
    await this.flushPendingGeminiTurn({ force: true });

    await this.persistSessionPatch({
      phase: this.phase,
      analysisStatus: this.analysisStatus,
      liveState: {
        ...(this.liveSession?.liveState || {}),
        phase: this.phase,
        analysisStatus: this.analysisStatus,
        lastEventType: source === 'alarm' ? 'analysis-started-fallback' : 'analysis-started'
      }
    });

    const turns = await this.listLiveTurns();
    const analysisPrompt = buildAnalysisPrompt(this.liveSession || {}, turns);
    if (!this.ai) {
      this.ai = new GoogleGenAI({ apiKey: this.env.GEMINI_API_KEY });
    }

    const analysisModel = this.env.GEMINI_ANALYSIS_MODEL || 'gemini-2.5-flash';
    const response = await this.ai.models.generateContent({
      model: analysisModel,
      contents: analysisPrompt
    });
    const analysisTranscript = extractGeneratedText(response);

    this.lastAssistantText = analysisTranscript;
    this.analysisCompleted = true;
    this.analysisStatus = 'completed';
    this.phase = 'completed';
    this.analysisTask = null;

    await this.clearAnalysisFallbackAlarm();
    await this.finalizeArchiveSession(analysisTranscript, turns);
    await this.persistLiveSessionRecord({
      status: 'completed',
      phase: 'completed',
      analysisStatus: 'completed',
      completedAt: nowIso(),
      liveState: {
        ...(this.liveSession?.liveState || {}),
        analysisTranscript,
        analysisStatus: 'completed',
        phase: 'completed'
      }
    });
  }

  async handleGeminiMessage(message) {
    const assistantText = String(message?.serverContent?.modelTurn?.parts?.map((part) => part?.text || '').filter(Boolean).join(' ') || '').trim();
    const inputTranscript = String(message?.serverContent?.inputTranscription?.text || '').trim();
    const outputTranscript = String(message?.serverContent?.outputTranscription?.text || '').trim();
    const turnComplete = Boolean(message?.serverContent?.turnComplete || message?.serverContent?.generationComplete || message?.serverContent?.waitingForInput);
    const interrupted = Boolean(message?.serverContent?.interrupted);

    if (assistantText) {
      this.lastAssistantText = assistantText;
    }

    if (inputTranscript) {
      this.lastTranscript = inputTranscript;
    } else if (outputTranscript) {
      this.lastTranscript = outputTranscript;
    }

    this.pendingGeminiTurn = {
      phase: this.phase,
      assistantText,
      inputTranscript,
      outputTranscript,
      turnComplete,
      interrupted,
      createdAt: nowIso(),
      turnIndex: null,
      questionIndex: null
    };

    await this.broadcastSessionPayload({
      type: 'gemini-message',
      phase: this.phase,
      analysisStatus: this.analysisStatus,
      assistantText,
      inputTranscript,
      outputTranscript,
      turnComplete,
      interrupted,
      serverContent: safeClone(message?.serverContent || message?.server_content || null),
      raw: safeClone(message)
    });

    if (turnComplete) {
      await this.flushPendingGeminiTurn({ force: true });
      await this.persistSessionPatch({
        phase: this.phase,
        analysisStatus: this.analysisStatus,
        liveState: {
          ...(this.liveSession?.liveState || {}),
          lastEventType: 'gemini-message-final',
          lastAssistantText: this.lastAssistantText,
          lastTranscript: this.lastTranscript
        }
      });
    }

  }

  async finalizeArchiveSession(analysisTranscript = '', liveTurns = []) {
    const interviewTurns = (Array.isArray(liveTurns) ? liveTurns : [])
      .filter((turn) => turn && (turn.assistantText || turn.inputTranscript || turn.outputTranscript || turn.text || turn.transcript))
      .map((turn, index) => {
        const turnIndex = Number.isFinite(Number(turn.turnIndex)) ? Number(turn.turnIndex) : index;
        const assistantText = String(turn.assistantText || turn.outputTranscript || turn.text || '').trim();
        const transcript = String(turn.inputTranscript || turn.transcript || '').trim();
        return {
          turnIndex,
          questionIndex: Number.isFinite(Number(turn.questionIndex)) ? Number(turn.questionIndex) : turnIndex,
          assistantText,
          transcript,
          interrupted: Boolean(turn.interrupted || turn.payload?.interrupted),
          createdAt: turn.createdAt || null
        };
      });
    const questions = interviewTurns
      .filter((turn) => turn.assistantText)
      .map((turn) => ({
        turnIndex: turn.turnIndex,
        questionIndex: turn.questionIndex,
        text: turn.assistantText,
        assistantText: turn.assistantText,
        askedAt: turn.createdAt
      }));
    const answers = interviewTurns
      .filter((turn) => turn.transcript)
      .map((turn) => ({
        turnIndex: turn.turnIndex,
        questionIndex: turn.questionIndex,
        transcript: turn.transcript,
        answeredAt: turn.createdAt,
        interrupted: turn.interrupted,
        source: 'gemini-live'
      }));

    return saveInterviewSession(this.env, {
      id: this.sessionId,
      version: 1,
      title: this.liveSession?.title || '',
      mode: 'live',
      source: 'interview',
      status: 'completed',
      college: this.config?.college || '',
      interviewType: this.config?.interviewType || 'general',
      interviewMode: this.config?.interviewMode || 'live',
      createdAt: this.liveSession?.createdAt || nowIso(),
      updatedAt: nowIso(),
      endedAt: nowIso(),
      completedAt: nowIso(),
      config: this.config,
      processing: {
        status: 'completed',
        startedAt: this.liveSession?.createdAt || nowIso(),
        finishedAt: nowIso(),
        error: null
      },
      questions,
      answers,
      evaluations: [],
      turnLog: [],
      conversationTimeline: interviewTurns,
      conversationLedger: [],
      transcriptTimeline: [],
      turnLedger: [],
      liveDiagnostics: {
        analysisStatus: 'completed',
        analysisTranscript
      },
      sessionSummary: {
        analysisStatus: 'completed',
        analysisTranscriptPreview: analysisTranscript.slice(0, 240),
        turnCount: interviewTurns.length,
        answeredTurnCount: answers.length
      },
      ownerHash: this.liveSession?.ownerHash || '',
      raw: {
        analysisTranscript,
        analysisCompletedAt: nowIso()
      }
    }, this.liveSession?.ownerHash || '');
  }

  async handleGeminiError(error) {
    const normalized = normalizeGeminiLiveClientError(error, 'Gemini Live session failed');
    this.liveConnection = null;
    await this.flushPendingGeminiTurn({ force: true });
    await this.persistSessionPatch({
      status: 'failed',
      analysisStatus: this.analysisStatus === 'running' ? 'failed' : this.analysisStatus,
      error: normalized.message,
      liveState: {
        ...(this.liveSession?.liveState || {}),
        error: normalized.message,
        errorCategory: normalized.category
      }
    });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'session-error',
          sessionId: this.sessionId,
          message: normalized.message,
          category: normalized.category
        }));
      }
    }
  }

  async handleGeminiClose(event) {
    const closeCode = event?.code ?? event?.closeCode ?? null;
    const closeReason = event?.reason ?? event?.message ?? '';
    const liveSession = await this.ensureLiveSessionRecord();
    const completed = liveSession?.status === 'completed';
    this.liveConnection = null;
    await this.flushPendingGeminiTurn({ force: true });

    if (!completed && this.phase === 'analysis' && this.analysisStatus === 'running') {
      await this.persistLiveSessionRecord({
        status: 'failed',
        error: closeReason || `Gemini connection closed (${closeCode || 'unknown'})`,
        liveState: {
          ...(this.liveSession?.liveState || {}),
          closeCode,
          closeReason
        }
      });
    } else if (!completed) {
      await this.persistLiveSessionRecord({
        status: 'active',
        liveState: {
          ...(this.liveSession?.liveState || {}),
          closeCode,
          closeReason,
          disconnected: true,
          waitingForAnalysis: true
        }
      });
    }

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: completed ? 'session-complete' : 'session-close',
          sessionId: this.sessionId,
          closeCode,
          closeReason
        }));
      }
    }
  }

  async handleClientMessage(payload = {}) {
    const type = String(payload.type || '').trim();

    if (type === 'start') {
      validateInterviewDuration(payload.config || {});
      this.config = payload.config && typeof payload.config === 'object' ? payload.config : this.config;
      this.systemInstruction = String(payload.systemInstruction || '').trim();
      this.phase = 'interview';
      this.analysisStatus = 'idle';
      await this.scheduleAnalysisFallbackAlarm();

      await this.persistLiveSessionRecord({
        config: this.config,
        phase: this.phase,
        analysisStatus: this.analysisStatus,
        liveState: {
          ...(this.liveSession?.liveState || {}),
          systemInstruction: this.systemInstruction
        }
      });

      await this.ensureGeminiSession();
      await this.persistAndBroadcast({
        type: 'session-ready',
        phase: this.phase,
        analysisStatus: this.analysisStatus,
        model: this.liveModel
      }, {
        sessionId: this.sessionId,
        sequence: this.turnSequence += 1,
        phase: this.phase,
        role: 'system',
        eventType: 'session-start',
        text: 'Live session started',
        transcript: '',
        payload: safeClone(payload),
        createdAt: nowIso()
      });
      return;
    }

    if (type === 'prompt') {
      const text = String(payload.text || '').trim();
      if (!text) return;

      await this.ensureGeminiSession();
      await this.appendLiveTurn({
        sessionId: this.sessionId,
        sequence: this.turnSequence += 1,
        phase: this.phase,
        role: 'client',
        eventType: 'prompt',
        text,
        transcript: text,
        payload: safeClone(payload),
        createdAt: nowIso()
      });
      sendGeminiPrompt(this.liveConnection, text);
      return;
    }

    if (type === 'audio-chunk') {
      const chunk = base64ToBytes(payload.data || '');
      if (chunk.length === 0) return;

      await this.ensureGeminiSession();
      sendGeminiAudioChunk(this.liveConnection, chunk, payload.mimeType || 'audio/pcm;rate=16000');
      return;
    }

    if (type === 'audio-end') {
      await this.ensureGeminiSession();
      await this.appendLiveTurn({
        sessionId: this.sessionId,
        sequence: this.turnSequence += 1,
        phase: this.phase,
        role: 'client',
        eventType: 'audio-end',
        text: 'audio-end',
        transcript: '',
        payload: safeClone(payload),
        createdAt: nowIso()
      });
      endGeminiAudioTurn(this.liveConnection);
      return;
    }

    if (type === 'complete-interview') {
      await this.clearAnalysisFallbackAlarm();
      void this.beginAnalysis('client-complete').catch((error) => {
        void this.handleGeminiError(error);
      });
      return;
    }

    if (type === 'fail') {
      const message = String(payload.message || payload.error || 'Live session failed');
      await this.persistLiveSessionRecord({
        status: 'failed',
        analysisStatus: this.analysisStatus === 'running' ? 'failed' : this.analysisStatus,
        error: message,
        liveState: {
          ...(this.liveSession?.liveState || {}),
          ...safeClone(payload)
        }
      });
      return;
    }

    if (type === 'ping') {
      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'pong',
            sessionId: this.sessionId,
            timestamp: nowIso()
          }));
        }
      }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const requestSessionId = extractSessionIdFromLiveSessionUrl(url);
    if (requestSessionId) {
      this.sessionId = requestSessionId;
    }

    if (request.headers.get('upgrade') === 'websocket') {
      const current = await this.loadLiveSessionRecord();
      if (!current || !current.liveAccessTokenHash || url.searchParams.get('access_token_hash') !== current.liveAccessTokenHash) {
        return jsonResponse({ ok: false, error: 'live_access_denied' }, { status: 403 });
      }
      const WebSocketPairCtor = globalThis.WebSocketPair;
      if (!WebSocketPairCtor) {
        return jsonResponse({ ok: false, error: 'websocket_unavailable' }, { status: 501 });
      }

      const pair = new WebSocketPairCtor();
      const [client, server] = Object.values(pair);

      server.accept();
      this.clients.add(server);
      server.addEventListener('message', (event) => {
        const payload = extractMessagePayload({ data: event?.data }) || {};
        void this.handleClientMessage(payload).catch((error) => {
          void this.handleGeminiError(error);
        });
      });
      server.addEventListener('close', () => {
        this.clients.delete(server);
      });
      server.addEventListener('error', () => {
        this.clients.delete(server);
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === 'POST' && requestSessionId && url.pathname === `/api/interview/live-sessions/${encodeURIComponent(requestSessionId)}`) {
      const payload = await request.json().catch(() => ({}));
      this.config = payload?.config && typeof payload.config === 'object' ? payload.config : this.config;
      this.systemInstruction = String(payload?.systemInstruction || this.systemInstruction || '').trim();
      this.phase = String(payload?.phase || this.phase || 'interview');
      this.analysisStatus = String(payload?.analysisStatus || this.analysisStatus || 'idle');

      const session = await this.persistLiveSessionRecord({
        ownerHash: String(payload?.ownerHash || ''),
        liveAccessTokenHash: String(payload?.liveAccessTokenHash || ''),
        archiveSessionId: String(payload?.archiveSessionId || this.sessionId),
        status: String(payload?.status || 'active'),
        phase: this.phase,
        analysisStatus: this.analysisStatus,
        config: this.config,
        liveState: {
          ...(this.liveSession?.liveState || {}),
          ...(payload?.liveState || {}),
          phase: this.phase,
          analysisStatus: this.analysisStatus,
          systemInstruction: this.systemInstruction
        },
        raw: payload && typeof payload === 'object' ? payload : {}
      });

      return jsonResponse({
        ok: true,
        session,
        wsUrl: buildWebSocketUrl(request, this.sessionId)
      }, { status: 201 });
    }

    const current = await this.loadLiveSessionRecord();
    if (!current || !current.ownerHash || url.searchParams.get('owner_hash') !== current.ownerHash) {
      return jsonResponse({ ok: false, error: 'not_found' }, { status: 404 });
    }

    if (request.method === 'GET') {
      const liveSession = await this.ensureLiveSessionRecord();
      const turns = await this.listLiveTurns();
      return jsonResponse({
        ok: true,
        session: {
          ...liveSession,
          turnCount: turns.length
        },
        turns
      });
    }

    if (request.method === 'POST' && url.pathname.endsWith('/complete')) {
      const payload = await request.json().catch(() => ({}));
      await this.handleClientMessage({
        type: 'complete-interview',
        ...payload
      });
      return jsonResponse({ ok: true, sessionId: this.sessionId, phase: this.phase, analysisStatus: this.analysisStatus });
    }

    if (request.method === 'POST' && url.pathname.endsWith('/fail')) {
      const payload = await request.json().catch(() => ({}));
      await this.handleClientMessage({
        type: 'fail',
        ...payload
      });
      return jsonResponse({ ok: true, sessionId: this.sessionId, status: 'failed' });
    }

    return jsonResponse({ ok: false, error: 'not_found' }, { status: 404 });
  }

  async alarm() {
    if (this.analysisCompleted || this.phase === 'completed' || this.analysisStatus === 'running') {
      return;
    }

    const liveSession = await this.ensureLiveSessionRecord();
    if (!liveSession || liveSession.status !== 'active') {
      return;
    }

    await this.beginAnalysis('alarm');
  }
}

export default InterviewLiveSessionDO;
