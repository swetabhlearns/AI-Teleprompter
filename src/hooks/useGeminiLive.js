import { useCallback, useEffect, useRef, useState } from 'react';
import {
    GEMINI_LIVE_ERROR_CATEGORIES,
    GEMINI_LIVE_PRODUCT_LABEL,
    GEMINI_LIVE_TURN_STATES,
    buildGeminiLiveTurnFingerprint,
    classifyGeminiLiveError,
    describeGeminiLiveTurnState,
    extractLiveInputTranscript,
    extractLiveOutputTranscript,
    extractLiveText,
    extractLiveTranscript,
    isLiveInterrupted,
    isLiveTurnComplete
} from '../utils/geminiLive';
import {
    normalizeGeminiLiveClientError,
} from '../utils/geminiLiveClient';
import {
    calculateGeminiAudioStartTime,
    decodeBase64Pcm16ToFloat32,
    parseGeminiAudioMimeType
} from '../utils/geminiAudio';
import { workerApi } from '../api/workerClient';

const GEMINI_INPUT_SAMPLE_RATE = 16000;
const GEMINI_PROMPT_AUDIO_GRACE_MS = 2500;

function getAssistantPrompt(config = {}) {
    const {
        college = 'a top B-school',
        interviewType = 'general',
        duration = 10,
        profile = {}
    } = config;

    const interviewTypeGuidance = {
        general: `Conduct a realistic MBA admissions interview. Use the profile only as background context, not as a script. Focus on the candidate's story, motivation, leadership, judgment, self-awareness, strengths, weaknesses, and ability to think clearly under pressure. Spend only part of the interview on resume validation; the rest should probe fit, impact, values, and goals.`,
        hr: `Conduct a fit and judgment interview like a strong admissions panel. Probe teamwork, conflict handling, communication style, ethics, leadership maturity, and self-awareness. Use behavioral questions anchored in past actions, then follow up for evidence, trade-offs, and reflection.`,
        stress: `Conduct a realistic stress interview without becoming random or hostile. Keep questions sharp, concise, and challenging. Push on inconsistencies, weak claims, gaps in reasoning, and composure. Still stay anchored to admissions-relevant traits such as clarity, resilience, and integrity.`,
        case: `Conduct an MBA-style case interview focused on structured thinking, not consulting theatrics. Give a business problem or ambiguity, ask the candidate to frame the issue, state assumptions, choose a framework, and synthesize a recommendation. Probe how they think, not just whether they know jargon.`,
        'wat-pi': `Blend a concise written-answer style with a personal admissions interview. Ask for structured opinions, concise arguments, and examples, then transition into behavioral follow-ups that test depth, coherence, and judgment.`,
    };

    const durationMinutes = Number.isFinite(Number(duration)) ? Number(duration) : 10;
    const targetQuestions = durationMinutes <= 5
        ? '3-4'
        : durationMinutes <= 10
            ? '5-6'
            : durationMinutes <= 15
                ? '7-8'
                : '9-10';

    return `You are an experienced MBA interviewer for ${college}.
You are running a ${interviewType} interview.
Interview duration target: about ${durationMinutes} minutes.
Target question count: about ${targetQuestions} questions including follow-ups.
Interview type guidance: ${interviewTypeGuidance[interviewType] || interviewTypeGuidance.general}

The candidate profile is background context only:
- Name: ${profile.name || 'Candidate'}
- Background: ${profile.background || 'Not specified'}
- Work Experience: ${profile.workExperience || 'Not specified'}
- Education: ${profile.education || 'Not specified'}
- Hobbies: ${profile.hobbies || 'Not specified'}
- Why MBA: ${profile.whyMba || 'Not specified'}

Interview behavior rules:
- Run this like a real B-school interview, not a resume walkthrough.
- Use the profile to personalize questions, verify claims, and probe inconsistencies, but do not ask only about the profile.
- Balance the interview across these areas: opening introduction, career story, leadership, teamwork, conflict, failures, strengths/weaknesses, motivation for MBA, school fit, post-MBA goals, and a few follow-up probes.
- Ask about concrete past actions more than hypothetical answers.
- When the candidate gives a vague answer, ask for a specific example, metric, decision, or trade-off.
- Keep at least one question centered on why this school and why now.
- Keep at least one question centered on what the candidate will contribute to the cohort.
- If the interview type is stress or case, still remain admissions-relevant and avoid becoming nonsensical.
- Ask one concise question at a time.
- Keep it professional, warm, and realistic.
- Keep the pace appropriate for the target duration. If the conversation is moving too slowly, ask tighter questions. If the candidate is giving short answers, use focused follow-ups. If the conversation is moving quickly, deepen the probe instead of adding filler.
- Do not provide long explanations unless the candidate directly asks for clarification.
- Wait for the candidate's opening greeting or introduction before beginning the interview.
- If the candidate starts with hello or an introduction, begin by asking the first interview question.
- When responding to a candidate answer, acknowledge briefly and move to the next question or a follow-up.
- Try to finish naturally within the target duration by controlling depth and number of follow-ups.`;
}

function float32ToPcm16Bytes(float32) {
    const buffer = new ArrayBuffer(float32.length * 2);
    const view = new DataView(buffer);

    for (let i = 0; i < float32.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, float32[i]));
        view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    }

    return new Uint8Array(buffer);
}

function downsampleBuffer(buffer, sampleRate, targetRate = 16000) {
    if (targetRate === sampleRate || targetRate > sampleRate) {
        return buffer;
    }

    const ratio = sampleRate / targetRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
        const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
        let accum = 0;
        let count = 0;

        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
            accum += buffer[i];
            count += 1;
        }

        result[offsetResult] = count > 0 ? accum / count : 0;
        offsetResult += 1;
        offsetBuffer = nextOffsetBuffer;
    }

    return result;
}

function pcm16ToBlob(chunks, sampleRate = GEMINI_INPUT_SAMPLE_RATE) {
    if (!chunks.length) {
        return null;
    }

    return new Blob(chunks, { type: `audio/pcm;rate=${sampleRate}` });
}

function buildNormalizedError(error, fallbackMessage) {
    const normalized = normalizeGeminiLiveClientError(error, fallbackMessage);
    return normalized.message || fallbackMessage || `${GEMINI_LIVE_PRODUCT_LABEL} failed`;
}

function safeClone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
}

function bytesToBase64(bytes) {
    const array = bytes instanceof Uint8Array
        ? bytes
        : bytes instanceof ArrayBuffer
            ? new Uint8Array(bytes)
            : bytes?.buffer instanceof ArrayBuffer
                ? new Uint8Array(bytes.buffer)
                : new Uint8Array();

    if (typeof globalThis.Buffer !== 'undefined') {
        return globalThis.Buffer.from(array).toString('base64');
    }

    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < array.length; i += chunkSize) {
        binary += String.fromCharCode(...array.subarray(i, i + chunkSize));
    }

    return btoa(binary);
}

function isGeminiLiveDebugEnabled() {
    try {
        if (globalThis.__AI_TRACKER_GEMINI_LIVE_DEBUG__ === true) {
            return true;
        }

        return globalThis.localStorage?.getItem('gemini-live-debug') === '1';
    } catch {
        return false;
    }
}

function logLiveDebug(event, payload = {}) {
    if (!isGeminiLiveDebugEnabled()) {
        return;
    }

    console.debug(`[GeminiLive] ${event}`, payload);
}

export function useGeminiLive() {
    const [isReady, setIsReady] = useState(workerApi.hasWorkerApi());
    const [isConnecting, setIsConnecting] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [error, setError] = useState(null);
    const [lastAssistantText, setLastAssistantText] = useState('');
    const [lastTranscript, setLastTranscript] = useState('');
    const [lastInterrupted, setLastInterrupted] = useState(false);
    const [usesFallback, setUsesFallback] = useState(false);
    const [resolvedModel, setResolvedModel] = useState('');
    const [modelStatus, setModelStatus] = useState(workerApi.hasWorkerApi() ? 'checking' : 'missing');
    const [turnState, setTurnState] = useState(GEMINI_LIVE_TURN_STATES.IDLE);
    const [turnStatus, setTurnStatus] = useState(describeGeminiLiveTurnState(GEMINI_LIVE_TURN_STATES.IDLE));
    const [diagnostics, setDiagnostics] = useState({
        lastEvent: '',
        lastCloseCode: '',
        lastCloseReason: '',
        messagesReceived: 0,
        audioChunksPlayed: 0,
        lastResponseHadAudio: false,
        turnState: GEMINI_LIVE_TURN_STATES.IDLE,
        turnStatus: describeGeminiLiveTurnState(GEMINI_LIVE_TURN_STATES.IDLE),
        modelStatus: workerApi.hasWorkerApi() ? 'checking' : 'missing'
    });

    const wsRef = useRef(null);
    const sessionRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const captureMediaRecorderRef = useRef(null);
    const captureMediaChunksRef = useRef([]);
    const captureAudioContextRef = useRef(null);
    const captureSourceRef = useRef(null);
    const captureProcessorRef = useRef(null);
    const captureGainRef = useRef(null);
    const captureChunksRef = useRef([]);
    const pendingPromptRef = useRef(null);
    const latestAssistantTextRef = useRef('');
    const latestTranscriptRef = useRef('');
    const audioContextRef = useRef(null);
    const playbackScheduleRef = useRef(Promise.resolve());
    const playbackCursorRef = useRef(0);
    const playbackPromisesRef = useRef(new Set());
    const receivedAudioRef = useRef(false);
    const closingReasonRef = useRef('');
    const heartbeatTimerRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const lastConnectConfigRef = useRef({});
    const sessionIdRef = useRef('');
    const resolvedModelRef = useRef('');
    const turnStateRef = useRef(GEMINI_LIVE_TURN_STATES.IDLE);
    const reconnectAttemptRef = useRef(0);
    const reconnectLiveSessionRef = useRef(async () => ({ ok: false, reason: 'Recovery unavailable' }));
    const diagnosticsRef = useRef(null);
    const turnLedgerRef = useRef([]);
    const conversationEventsRef = useRef([]);
    const transcriptFragmentsRef = useRef([]);
    const activeTurnRef = useRef(null);
    const pendingContextQueueRef = useRef([]);
    const lastSentContextFingerprintRef = useRef('');
    const turnSequenceRef = useRef(0);
    const conversationSequenceRef = useRef(0);

    const clearPlaybackState = useCallback(() => {
        playbackScheduleRef.current = Promise.resolve();
        playbackCursorRef.current = 0;
        playbackPromisesRef.current = new Set();
    }, []);

    const clearTurnState = useCallback(() => {
        turnLedgerRef.current = [];
        conversationEventsRef.current = [];
        transcriptFragmentsRef.current = [];
        activeTurnRef.current = null;
        pendingContextQueueRef.current = [];
        lastSentContextFingerprintRef.current = '';
        turnSequenceRef.current = 0;
        conversationSequenceRef.current = 0;
    }, []);

    const trackPlaybackPromise = useCallback((promise) => {
        playbackPromisesRef.current.add(promise);
        promise.finally(() => {
            playbackPromisesRef.current.delete(promise);
        });
    }, []);

    const waitForPlaybackDrain = useCallback(async () => {
        while (playbackPromisesRef.current.size > 0) {
            await Promise.race(Array.from(playbackPromisesRef.current));
        }
    }, []);

    const setTurnDiagnostics = useCallback((nextState, nextStatus = null) => {
        const resolvedStatus = nextStatus || describeGeminiLiveTurnState(nextState);
        turnStateRef.current = nextState;
        setTurnState(nextState);
        setTurnStatus(resolvedStatus);
        setDiagnostics((prev) => ({
            ...prev,
            turnState: nextState,
            turnStatus: resolvedStatus
        }));
    }, []);

    useEffect(() => {
        diagnosticsRef.current = diagnostics;
    }, [diagnostics]);

    const upsertTurnLedger = useCallback((turnRecord) => {
        if (!turnRecord) return null;

        if (Number.isFinite(Number(turnRecord.turnIndex))) {
            turnSequenceRef.current = Math.max(turnSequenceRef.current, Number(turnRecord.turnIndex) + 1);
        } else {
            turnSequenceRef.current += 1;
        }

        const nextRecord = {
            ...turnRecord,
            turnId: turnRecord.turnId || `turn-${turnSequenceRef.current}`,
            updatedAt: new Date().toISOString()
        };

        const existingIndex = turnLedgerRef.current.findIndex(
            (item) => item.turnId === nextRecord.turnId || item.turnIndex === nextRecord.turnIndex
        );

        if (existingIndex >= 0) {
            turnLedgerRef.current = [
                ...turnLedgerRef.current.slice(0, existingIndex),
                { ...turnLedgerRef.current[existingIndex], ...nextRecord },
                ...turnLedgerRef.current.slice(existingIndex + 1)
            ];
        } else {
            turnLedgerRef.current = [...turnLedgerRef.current, nextRecord];
        }

        return nextRecord;
    }, []);

    const appendConversationEvent = useCallback((event = {}) => {
        const nextEvent = {
            id: event.id || `conversation-event-${conversationSequenceRef.current + 1}`,
            timestamp: event.timestamp || new Date().toISOString(),
            type: event.type || 'message',
            turnId: event.turnId || activeTurnRef.current?.turnId || null,
            turnIndex: Number.isFinite(Number(event.turnIndex))
                ? Number(event.turnIndex)
                : Number.isFinite(Number(activeTurnRef.current?.turnIndex))
                    ? Number(activeTurnRef.current.turnIndex)
                    : null,
            questionIndex: Number.isFinite(Number(event.questionIndex))
                ? Number(event.questionIndex)
                : Number.isFinite(Number(activeTurnRef.current?.questionIndex))
                    ? Number(activeTurnRef.current.questionIndex)
                    : null,
            phase: event.phase || null,
            assistantText: String(event.assistantText || '').trim(),
            transcriptText: String(event.transcriptText || '').trim(),
            inputTranscript: String(event.inputTranscript || '').trim(),
            outputTranscript: String(event.outputTranscript || '').trim(),
            turnComplete: Boolean(event.turnComplete),
            generationComplete: Boolean(event.generationComplete),
            waitingForInput: Boolean(event.waitingForInput),
            interrupted: Boolean(event.interrupted),
            source: String(event.source || 'gemini-live').trim(),
            diagnostics: safeClone(event.diagnostics || null),
            turnSnapshot: safeClone(event.turnSnapshot || null),
            raw: safeClone(event.raw || null)
        };

        conversationSequenceRef.current += 1;
        conversationEventsRef.current = [...conversationEventsRef.current, nextEvent];
        return nextEvent;
    }, []);

    const appendTranscriptFragment = useCallback((fragment = {}) => {
        const text = String(fragment.text || '').trim();
        if (!text) {
            return null;
        }

        const nextFragment = {
            id: fragment.id || `transcript-fragment-${conversationSequenceRef.current + 1}`,
            timestamp: fragment.timestamp || new Date().toISOString(),
            type: fragment.type || 'transcript-fragment',
            source: fragment.source || 'gemini-live',
            turnId: fragment.turnId || activeTurnRef.current?.turnId || null,
            turnIndex: Number.isFinite(Number(fragment.turnIndex))
                ? Number(fragment.turnIndex)
                : Number.isFinite(Number(activeTurnRef.current?.turnIndex))
                    ? Number(activeTurnRef.current.turnIndex)
                    : null,
            questionIndex: Number.isFinite(Number(fragment.questionIndex))
                ? Number(fragment.questionIndex)
                : Number.isFinite(Number(activeTurnRef.current?.questionIndex))
                    ? Number(activeTurnRef.current.questionIndex)
                    : null,
            speaker: fragment.speaker || 'candidate',
            text
        };

        transcriptFragmentsRef.current = [...transcriptFragmentsRef.current, nextFragment];
        if (nextFragment.speaker === 'candidate') {
            latestTranscriptRef.current = text;
            setLastTranscript(text);
        }
        return nextFragment;
    }, []);

    const pruneCompletedTurnArtifacts = useCallback((turnId = null) => {
        if (!turnId) {
            conversationEventsRef.current = [];
            transcriptFragmentsRef.current = [];
            return;
        }

        conversationEventsRef.current = conversationEventsRef.current.filter((event) => event?.turnId !== turnId);
        transcriptFragmentsRef.current = transcriptFragmentsRef.current.filter((fragment) => fragment?.turnId !== turnId);
    }, []);

    const getTurnTranscript = useCallback((turnId = null, speaker = 'candidate') => {
        const fragments = transcriptFragmentsRef.current.filter((fragment) => {
            if (!fragment) return false;
            if (speaker && fragment.speaker !== speaker) return false;
            if (turnId && fragment.turnId === turnId) return true;
            return false;
        });

        return fragments.map((fragment) => fragment?.text || '').filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    }, []);

    const getActiveTurnTranscript = useCallback(() => {
        const activeTurn = activeTurnRef.current;
        const fragments = transcriptFragmentsRef.current.filter((fragment) => {
            if (!fragment) return false;
            if (fragment.speaker !== 'candidate') return false;
            if (activeTurn?.turnId && fragment.turnId === activeTurn.turnId) return true;
            if (Number.isFinite(Number(activeTurn?.turnIndex)) && Number(fragment.turnIndex) === Number(activeTurn.turnIndex)) return true;
            if (Number.isFinite(Number(activeTurn?.questionIndex)) && Number(fragment.questionIndex) === Number(activeTurn.questionIndex)) return true;
            return false;
        });

        const transcript = fragments.map((fragment) => fragment?.text || '').filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
        return transcript || latestTranscriptRef.current || lastTranscript || '';
    }, [lastTranscript]);

    const buildConversationSnapshot = useCallback(() => {
        const turnLedger = safeClone(turnLedgerRef.current || []);
        const conversationEvents = safeClone(conversationEventsRef.current || []);
        const transcriptTimeline = safeClone(transcriptFragmentsRef.current || []);
        const sessionTranscriptText = transcriptTimeline
            .filter((fragment) => fragment?.speaker === 'candidate')
            .map((fragment) => fragment?.text || '')
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        const transcriptText = getTurnTranscript(activeTurnRef.current?.turnId, 'candidate');
        const transcriptWordCount = sessionTranscriptText ? sessionTranscriptText.split(/\s+/).filter(Boolean).length : 0;
        const interruptedTurns = turnLedger.filter((turn) => turn?.interrupted);

        return {
            turnLedger,
            conversationEvents,
            transcriptTimeline,
            transcriptText,
            sessionTranscriptText,
            currentTurnTranscript: getActiveTurnTranscript(),
            transcriptWordCount,
            sessionTranscriptWordCount: transcriptWordCount,
            currentTurn: safeClone(activeTurnRef.current || null),
            latestAssistantText: latestAssistantTextRef.current || '',
            latestTranscript: latestTranscriptRef.current || '',
            lastInterrupted,
            diagnostics: safeClone(diagnosticsRef.current || diagnostics || null),
            sessionSummary: {
                turnCount: turnLedger.length,
                interruptedTurnCount: interruptedTurns.length,
                conversationEventCount: conversationEvents.length,
                transcriptFragmentCount: transcriptTimeline.length,
                transcriptWordCount
            }
        };
    }, [diagnostics, getActiveTurnTranscript, getTurnTranscript, lastInterrupted]);

    const queueTurnContextSync = useCallback((turnRecord, phase = 'context', { force = false } = {}) => {
        if (!turnRecord) return;

        const fingerprint = buildGeminiLiveTurnFingerprint(turnRecord, phase);
        if (!force && lastSentContextFingerprintRef.current === fingerprint) {
            return;
        }

        lastSentContextFingerprintRef.current = fingerprint;
        setDiagnostics((prev) => ({
            ...prev,
            lastEvent: phase === 'turn-complete' ? 'turn-context-complete' : 'turn-context-sync'
        }));
    }, []);

    const flushPendingTurnContextSync = useCallback((force = false) => {
        if (pendingContextQueueRef.current.length === 0) {
            if (force) {
                lastSentContextFingerprintRef.current = '';
            }
            return;
        }

        const pendingQueue = [...pendingContextQueueRef.current];
        pendingContextQueueRef.current = [];

        for (const entry of pendingQueue) {
            queueTurnContextSync(entry.turnRecord, entry.phase, { force: force || entry.force });
        }

        if (force) {
            lastSentContextFingerprintRef.current = '';
        }
    }, [queueTurnContextSync]);

    const markTurnInterrupted = useCallback((reason = `${GEMINI_LIVE_PRODUCT_LABEL} interrupted`) => {
        setLastInterrupted(true);
        setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.INTERRUPTED, 'Turn interrupted');
        setDiagnostics((prev) => ({
            ...prev,
            lastEvent: 'turn-interrupted',
            lastCloseReason: reason
        }));
        appendConversationEvent({
            type: 'turn-interrupted',
            phase: 'interrupted',
            interrupted: true,
            assistantText: latestAssistantTextRef.current,
            transcriptText: latestTranscriptRef.current,
            diagnostics: diagnosticsRef.current || diagnostics,
            raw: { reason }
        });

        if (activeTurnRef.current) {
            const nextRecord = {
                ...activeTurnRef.current,
                interrupted: true,
                status: 'interrupted',
                interruptionReason: reason
            };
            activeTurnRef.current = nextRecord;
            upsertTurnLedger(nextRecord);
            queueTurnContextSync(nextRecord, 'turn-interrupted', { force: true });
        }
    }, [appendConversationEvent, diagnostics, queueTurnContextSync, setTurnDiagnostics, upsertTurnLedger]);

    const beginTurnContext = useCallback((context = {}) => {
        const nextRecord = {
            turnId: context.turnId || `turn-${turnSequenceRef.current + 1}`,
            turnIndex: Number.isFinite(Number(context.turnIndex)) ? Number(context.turnIndex) : turnSequenceRef.current,
            questionIndex: Number.isFinite(Number(context.questionIndex)) ? Number(context.questionIndex) : turnSequenceRef.current,
            questionText: String(context.questionText || context.question?.text || '').trim(),
            assistantText: String(context.assistantText || context.question?.text || context.questionText || '').trim(),
            transcriptText: String(context.transcriptText || '').trim(),
            previousAssistantText: String(context.previousAssistantText || '').trim(),
            previousTranscriptText: String(context.previousTranscriptText || '').trim(),
            interrupted: Boolean(context.interrupted),
            retryCount: Number.isFinite(Number(context.retryCount)) ? Number(context.retryCount) : 0,
            status: context.status || 'prompting',
            startedAt: context.startedAt || new Date().toISOString()
        };

        activeTurnRef.current = upsertTurnLedger(nextRecord);
        setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.PROMPTING, 'Preparing live turn');
        appendConversationEvent({
            type: 'turn-start',
            phase: 'start',
            assistantText: nextRecord.assistantText,
            transcriptText: nextRecord.transcriptText,
            turnSnapshot: nextRecord,
            diagnostics: diagnosticsRef.current || diagnostics,
            raw: { context: safeClone(context) }
        });
        queueTurnContextSync(activeTurnRef.current, 'turn-start', { force: Boolean(context.force) });

        return activeTurnRef.current;
    }, [appendConversationEvent, diagnostics, queueTurnContextSync, setTurnDiagnostics, upsertTurnLedger]);

    const completeTurnContext = useCallback((context = {}) => {
        const existingTurn = activeTurnRef.current || turnLedgerRef.current.find((item) => item.turnIndex === context.turnIndex) || null;
        const nextRecord = {
            ...(existingTurn || {}),
            turnId: context.turnId || existingTurn?.turnId || `turn-${turnSequenceRef.current + 1}`,
            turnIndex: Number.isFinite(Number(context.turnIndex)) ? Number(context.turnIndex) : (existingTurn?.turnIndex ?? turnSequenceRef.current),
            questionIndex: Number.isFinite(Number(context.questionIndex)) ? Number(context.questionIndex) : (existingTurn?.questionIndex ?? context.turnIndex ?? turnSequenceRef.current),
            questionText: String(context.questionText || existingTurn?.questionText || '').trim(),
            assistantText: String(context.assistantText || existingTurn?.assistantText || '').trim(),
            transcriptText: String(context.transcriptText || existingTurn?.transcriptText || '').trim(),
            previousAssistantText: String(context.previousAssistantText || existingTurn?.previousAssistantText || '').trim(),
            previousTranscriptText: String(context.previousTranscriptText || existingTurn?.previousTranscriptText || '').trim(),
            interrupted: Boolean(context.interrupted || existingTurn?.interrupted),
            retryCount: Number.isFinite(Number(context.retryCount)) ? Number(context.retryCount) : (existingTurn?.retryCount || 0),
            status: context.skipped ? 'skipped' : 'complete',
            skipped: Boolean(context.skipped),
            duration: Number.isFinite(Number(context.duration)) ? Number(context.duration) : (existingTurn?.duration || 0),
            evaluation: context.evaluation || existingTurn?.evaluation || null,
            answeredAt: context.answeredAt || new Date().toISOString()
        };

        activeTurnRef.current = upsertTurnLedger(nextRecord);
        appendConversationEvent({
            type: 'turn-complete',
            phase: 'complete',
            assistantText: nextRecord.assistantText,
            transcriptText: nextRecord.transcriptText,
            interrupted: Boolean(nextRecord.interrupted),
            turnComplete: true,
            generationComplete: false,
            waitingForInput: false,
            turnSnapshot: nextRecord,
            diagnostics: diagnosticsRef.current || diagnostics,
            raw: { context: safeClone(context) }
        });
        queueTurnContextSync(activeTurnRef.current, 'turn-complete', { force: Boolean(context.force) });
        setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.IDLE, 'Turn complete');
        return activeTurnRef.current;
    }, [appendConversationEvent, diagnostics, queueTurnContextSync, setTurnDiagnostics, upsertTurnLedger]);

    const acknowledgeRecovery = useCallback(() => {
        if (turnState === GEMINI_LIVE_TURN_STATES.RECOVERED) {
            setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.LISTENING, 'Recovered and listening');
        }
    }, [setTurnDiagnostics, turnState]);

    const cleanupCapture = useCallback(() => {
        const processor = captureProcessorRef.current;
        const source = captureSourceRef.current;
        const gain = captureGainRef.current;
        const audioContext = captureAudioContextRef.current;

        if (processor) {
            try {
                if (processor.port) {
                    processor.port.onmessage = null;
                }
                processor.disconnect();
            } catch {
                // ignore cleanup errors
            }
        }

        if (source) {
            try {
                source.disconnect();
            } catch {
                // ignore cleanup errors
            }
        }

        if (gain) {
            try {
                gain.disconnect();
            } catch {
                // ignore cleanup errors
            }
        }

        captureProcessorRef.current = null;
        captureSourceRef.current = null;
        captureGainRef.current = null;
        captureMediaRecorderRef.current = null;

        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => {
                try {
                    track.stop();
                } catch {
                    // ignore cleanup errors
                }
            });
        }

        mediaStreamRef.current = null;
        captureMediaChunksRef.current = [];

        if (audioContext) {
            void audioContext.close().catch(() => {});
        }

        captureAudioContextRef.current = null;
        captureChunksRef.current = [];
        setIsCapturing(false);
    }, []);

    const cleanupSession = useCallback(() => {
        clearPlaybackState();
        cleanupCapture();
        closingReasonRef.current = '';
        sessionIdRef.current = '';
        reconnectAttemptRef.current = 0;
        pendingPromptRef.current = null;
        activeTurnRef.current = null;
        latestAssistantTextRef.current = '';
        latestTranscriptRef.current = '';
        reconnectLiveSessionRef.current = async () => ({ ok: false, reason: 'Recovery unavailable' });
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        if (heartbeatTimerRef.current) {
            clearInterval(heartbeatTimerRef.current);
            heartbeatTimerRef.current = null;
        }
        pendingPromptRef.current = null;
        receivedAudioRef.current = false;
        setIsConnected(false);
        setIsSpeaking(false);
        setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.IDLE, 'Idle');
        clearTurnState();

        if (audioContextRef.current) {
            try {
                audioContextRef.current.close().catch(() => {});
            } catch {
                // ignore close errors
            }
        }

        audioContextRef.current = null;

        if (wsRef.current) {
            try {
                closingReasonRef.current = 'cleanup';
                wsRef.current.close();
            } catch {
                // ignore close errors
            }
        }

        wsRef.current = null;
        sessionRef.current = null;
    }, [clearPlaybackState, clearTurnState, cleanupCapture, setTurnDiagnostics]);

    useEffect(() => cleanupSession, [cleanupSession]);

    const setNormalizedError = useCallback((nextError, fallbackMessage) => {
        const message = buildNormalizedError(nextError, fallbackMessage);
        const category = classifyGeminiLiveError(nextError);
        setError(message);
        setDiagnostics((prev) => ({
            ...prev,
            lastEvent: 'error',
            lastCloseReason: message,
            errorCategory: category
        }));
        return { category, message };
    }, []);

    const ensureModelResolved = useCallback(async () => {
        if (!workerApi.hasWorkerApi()) {
            const errorMessage = 'Worker API base URL is missing';
            setModelStatus('missing');
            setResolvedModel('');
            setIsReady(false);
            setUsesFallback(true);
            setError(errorMessage);
            return { ok: false, reason: errorMessage };
        }

        const backendModel = 'worker-managed Gemini Live';
        resolvedModelRef.current = backendModel;
        setResolvedModel(backendModel);
        setModelStatus('ready');
        setIsReady(true);
        setUsesFallback(false);
        setError(null);
        setDiagnostics((prev) => ({
            ...prev,
            lastEvent: 'model-ready',
            modelStatus: 'ready',
            lastCloseReason: ''
        }));
        return { ok: true, model: backendModel };
    }, []);

    useEffect(() => {
        let cancelled = false;

        if (!workerApi.hasWorkerApi()) {
            resolvedModelRef.current = '';
            setResolvedModel('');
            setModelStatus('missing');
            setIsReady(false);
            setUsesFallback(true);
            setError(null);
            setDiagnostics((prev) => ({
                ...prev,
                modelStatus: 'missing'
            }));
            return () => {
                cancelled = true;
            };
        }

        resolvedModelRef.current = '';
        setResolvedModel('');
        setModelStatus('checking');
        setIsReady(false);
        setUsesFallback(false);
        setError(null);
        setDiagnostics((prev) => ({
            ...prev,
            lastEvent: 'model-check',
            modelStatus: 'checking',
            lastCloseReason: ''
        }));

        void ensureModelResolved().finally(() => {
            if (cancelled) {
                return;
            }
        });

        return () => {
            cancelled = true;
        };
    }, [ensureModelResolved]);

    const finalizeTurn = useCallback(async (interrupted = false) => {
        logLiveDebug('finalizeTurn:start', {
            interrupted,
            receivedAudio: receivedAudioRef.current,
            assistantText: latestAssistantTextRef.current,
            transcriptText: latestTranscriptRef.current,
            turnState: turnStateRef.current
        });
        try {
            await playbackScheduleRef.current;
        } catch {
            // ignore playback schedule errors
        }

        try {
            await waitForPlaybackDrain();
        } catch {
            // ignore drain errors
        }

        setIsSpeaking(false);
        if (activeTurnRef.current) {
            const completedTurnId = activeTurnRef.current.turnId || null;
            completeTurnContext({
                ...activeTurnRef.current,
                interrupted: Boolean(interrupted || activeTurnRef.current.interrupted),
                evaluation: activeTurnRef.current.evaluation || null,
                force: true
            });
            pruneCompletedTurnArtifacts(completedTurnId);
        }
        activeTurnRef.current = null;
        setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.IDLE, interrupted ? 'Turn complete after interruption' : 'Turn complete');
        setDiagnostics((prev) => ({
            ...prev,
            lastEvent: interrupted ? 'turn-complete-interrupted' : 'turn-complete',
            lastResponseHadAudio: receivedAudioRef.current || prev.lastResponseHadAudio
        }));

        if (pendingPromptRef.current) {
            pendingPromptRef.current.resolve({
                assistantText: latestAssistantTextRef.current,
                transcriptText: latestTranscriptRef.current,
                interrupted
            });
            pendingPromptRef.current = null;
        }

        receivedAudioRef.current = false;
        logLiveDebug('finalizeTurn:done', {
            interrupted,
            nextTurnState: GEMINI_LIVE_TURN_STATES.IDLE
        });
    }, [completeTurnContext, pruneCompletedTurnArtifacts, setTurnDiagnostics, waitForPlaybackDrain]);

    const scheduleReconnectAttempt = useCallback((details = {}) => {
        if (closingReasonRef.current === 'cleanup') {
            return;
        }

        if (reconnectTimerRef.current || reconnectAttemptRef.current >= 1) {
            return;
        }

        const hasActiveSession = Boolean(
            pendingPromptRef.current
            || activeTurnRef.current
            || isCapturing
            || turnStateRef.current !== GEMINI_LIVE_TURN_STATES.IDLE
        );

        if (!hasActiveSession) {
            return;
        }

        reconnectAttemptRef.current = 1;
        setIsConnected(false);
        setIsSpeaking(false);
        setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.RECONNECTING, 'Reconnecting live session');
        setDiagnostics((prev) => ({
            ...prev,
            lastEvent: 'reconnecting',
            lastCloseCode: details.closeCode ? String(details.closeCode) : prev.lastCloseCode,
            lastCloseReason: details.closeReason || prev.lastCloseReason
        }));

        reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;

            void (async () => {
                try {
                    const recovery = await reconnectLiveSessionRef.current({
                        sessionId: sessionIdRef.current,
                        archiveSessionId: lastConnectConfigRef.current?.archiveSessionId || sessionIdRef.current,
                        ...safeClone(lastConnectConfigRef.current || {})
                    });

                    if (recovery?.ok) {
                        reconnectAttemptRef.current = 0;
                        setError(null);
                        setLastInterrupted(true);
                        setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.RECOVERED, 'Recovered and listening');
                        setDiagnostics((prev) => ({
                            ...prev,
                            lastEvent: 'recovered',
                            lastCloseCode: '',
                            lastCloseReason: ''
                        }));
                        return;
                    }

                    throw new Error(recovery?.reason || 'Recovery failed');
                } catch (reconnectErr) {
                    reconnectAttemptRef.current = 0;
                    const normalized = normalizeGeminiLiveClientError(
                        reconnectErr,
                        `${GEMINI_LIVE_PRODUCT_LABEL} connection dropped. Please try again.`
                    );

                    if (pendingPromptRef.current || activeTurnRef.current) {
                        await finalizeTurn(true);
                    }

                    setError(normalized.message);
                    setDiagnostics((prev) => ({
                        ...prev,
                        lastEvent: 'close-error',
                        lastCloseReason: normalized.message,
                        errorCategory: normalized.category
                    }));
                    setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.IDLE, normalized.message);
                }
            })();
        }, 250);
    }, [finalizeTurn, isCapturing, setError, setIsConnected, setIsSpeaking, setTurnDiagnostics]);

    /* eslint-disable react-hooks/exhaustive-deps */
    const handleMessage = useCallback((message) => {
        const parts = message?.serverContent?.modelTurn?.parts || [];
        const hasAudioPart = parts.some((part) => Boolean(part?.inlineData?.data));
        const hasTextPart = parts.some((part) => Boolean(part?.text));
        const turnComplete = Boolean(message?.serverContent?.turnComplete);
        const generationComplete = Boolean(message?.serverContent?.generationComplete);
        const waitingForInput = Boolean(message?.serverContent?.waitingForInput);
        logLiveDebug('message', {
            hasAudioPart,
            hasTextPart,
            turnComplete,
            generationComplete,
            waitingForInput,
            interrupted: Boolean(message?.serverContent?.interrupted)
        });

        setDiagnostics((prev) => ({
            ...prev,
            messagesReceived: prev.messagesReceived + 1,
            lastEvent: 'message'
        }));

        const assistantText = extractLiveText(message);
        const transcriptText = extractLiveTranscript(message);
        const inputTranscript = extractLiveInputTranscript(message);
        const outputTranscript = extractLiveOutputTranscript(message);
        const interrupted = isLiveInterrupted(message);
        const liveTurnComplete = isLiveTurnComplete(message);
        const currentTurnSnapshot = activeTurnRef.current ? safeClone(activeTurnRef.current) : null;

        appendConversationEvent({
            type: 'message',
            phase: liveTurnComplete ? 'turn-update' : 'stream',
            assistantText,
            transcriptText,
            inputTranscript,
            outputTranscript,
            turnComplete,
            generationComplete,
            waitingForInput,
            interrupted,
            turnSnapshot: currentTurnSnapshot,
            diagnostics: diagnosticsRef.current || diagnostics,
            raw: {
                hasAudioPart,
                hasTextPart,
                turnComplete,
                generationComplete,
                waitingForInput,
                interrupted
            }
        });

        if (assistantText) {
            latestAssistantTextRef.current = assistantText;
            setLastAssistantText(assistantText);
        }

        if (inputTranscript) {
            appendTranscriptFragment({
                type: 'input-transcription',
                source: 'inputTranscription',
                speaker: 'candidate',
                text: inputTranscript,
                turnId: currentTurnSnapshot?.turnId,
                turnIndex: currentTurnSnapshot?.turnIndex,
                questionIndex: currentTurnSnapshot?.questionIndex
            });
        }

        if (outputTranscript && outputTranscript !== inputTranscript) {
            appendTranscriptFragment({
                type: 'output-transcription',
                source: 'outputTranscription',
                speaker: 'assistant',
                text: outputTranscript,
                turnId: currentTurnSnapshot?.turnId,
                turnIndex: currentTurnSnapshot?.turnIndex,
                questionIndex: currentTurnSnapshot?.questionIndex
            });
        }

        if (!inputTranscript && !outputTranscript && transcriptText) {
            appendTranscriptFragment({
                type: 'transcript',
                source: 'liveTranscript',
                speaker: 'candidate',
                text: transcriptText,
                turnId: currentTurnSnapshot?.turnId,
                turnIndex: currentTurnSnapshot?.turnIndex,
                questionIndex: currentTurnSnapshot?.questionIndex
            });
        }

        for (const part of parts) {
            const inlineData = part?.inlineData;
            const audioData = inlineData?.data;
            const mimeType = inlineData?.mimeType || inlineData?.mime_type || '';
            const parsedAudioMimeType = parseGeminiAudioMimeType(mimeType);

            if (!audioData || !parsedAudioMimeType) continue;
            receivedAudioRef.current = true;
            setIsSpeaking(true);
            void queueAudioPlayback(audioData, mimeType);
        }

        if (interrupted) {
            markTurnInterrupted(`${GEMINI_LIVE_PRODUCT_LABEL} interrupted the current turn`);
        }

        if (message?.sessionResumptionUpdate?.resumable) {
            setDiagnostics((prev) => ({
                ...prev,
                lastEvent: 'resumption-update'
            }));
            appendConversationEvent({
                type: 'session-resumption',
                phase: 'recovery',
                assistantText,
                transcriptText,
                turnSnapshot: currentTurnSnapshot,
                diagnostics: diagnosticsRef.current || diagnostics,
                raw: safeClone(message?.sessionResumptionUpdate || null)
            });
        }

        if (message?.goAway?.timeLeft) {
            setDiagnostics((prev) => ({
                ...prev,
                lastEvent: 'go-away',
                lastCloseReason: `GoAway in ${message.goAway.timeLeft}`
            }));
            appendConversationEvent({
                type: 'session-go-away',
                phase: 'shutdown',
                assistantText,
                transcriptText,
                turnSnapshot: currentTurnSnapshot,
                diagnostics: diagnosticsRef.current || diagnostics,
                raw: safeClone(message?.goAway || null)
            });
        }

        if (turnComplete || generationComplete || waitingForInput) {
            logLiveDebug('turn-finalize-requested', {
                turnComplete,
                generationComplete,
                waitingForInput,
                receivedAudio: receivedAudioRef.current,
                assistantText: Boolean(latestAssistantTextRef.current),
                transcriptText: Boolean(latestTranscriptRef.current)
            });
            void finalizeTurn(interrupted);
        }
    }, [appendConversationEvent, appendTranscriptFragment, diagnostics, finalizeTurn, markTurnInterrupted]);
    /* eslint-enable react-hooks/exhaustive-deps */

    const handleTransportMessage = useCallback((message = {}) => {
        if (message?.serverContent) {
            handleMessage(message);
            return;
        }

        const type = String(message?.type || '').trim();
        if (!type) {
            return;
        }

        setDiagnostics((prev) => ({
            ...prev,
            messagesReceived: prev.messagesReceived + 1,
            lastEvent: type
        }));

        if (type === 'session-ready') {
            setIsConnected(true);
            setIsReady(true);
            setUsesFallback(false);
            setResolvedModel(message?.model || resolvedModelRef.current || 'worker-managed Gemini Live');
            setModelStatus('ready');
            setError(null);
            setDiagnostics((prev) => ({
                ...prev,
                lastEvent: 'open',
                lastCloseReason: '',
                modelStatus: 'ready'
            }));
            appendConversationEvent({
                type: 'session-open',
                phase: 'connected',
                assistantText: latestAssistantTextRef.current,
                transcriptText: latestTranscriptRef.current,
                diagnostics: diagnosticsRef.current || diagnostics,
                raw: safeClone(message)
            });
            flushPendingTurnContextSync(true);
            return;
        }

        if (type === 'session-state' || type === 'analysis-started') {
            if (message?.phase === 'analysis') {
                setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.PROCESSING, 'Running post-interview analysis');
            }

            if (message?.analysisStatus) {
                setDiagnostics((prev) => ({
                    ...prev,
                    lastEvent: type,
                    lastCloseReason: '',
                    analysisStatus: message.analysisStatus
                }));
            }
            return;
        }

        if (type === 'session-error') {
            const reason = message?.message || 'Live session failed';
            const category = message?.category || classifyGeminiLiveError({
                code: message?.code || message?.status || message?.statusCode || '',
                message: reason
            });
            if (category === GEMINI_LIVE_ERROR_CATEGORIES.CONNECTION_DROPPED) {
                closingReasonRef.current = 'reconnect';
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    try {
                        wsRef.current.close(1012, 'reconnect');
                    } catch {
                        // ignore close errors; onclose will handle the reconnect path.
                    }
                }
                return;
            }
            setIsSpeaking(false);
            if (pendingPromptRef.current || activeTurnRef.current) {
                void finalizeTurn(true);
            }
            setIsConnected(false);
            setError(reason);
            setDiagnostics((prev) => ({
                ...prev,
                lastEvent: 'error',
                lastCloseReason: reason,
                errorCategory: message?.category || GEMINI_LIVE_ERROR_CATEGORIES.UNKNOWN
            }));
            return;
        }

        if (type === 'session-complete') {
            setIsConnected(false);
            setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.IDLE, 'Analysis complete');
            setDiagnostics((prev) => ({
                ...prev,
                lastEvent: 'analysis-complete',
                lastCloseReason: ''
            }));
            return;
        }

        if (type === 'session-close') {
            const category = classifyGeminiLiveError({
                code: message?.closeCode || message?.code || '',
                message: message?.closeReason || ''
            });
            if (category === GEMINI_LIVE_ERROR_CATEGORIES.CONNECTION_DROPPED) {
                closingReasonRef.current = 'reconnect';
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    try {
                        wsRef.current.close(1012, 'reconnect');
                    } catch {
                        // ignore close errors; onclose will handle the reconnect path.
                    }
                }
                return;
            }
            setIsSpeaking(false);
            if (pendingPromptRef.current || activeTurnRef.current) {
                void finalizeTurn(true);
            }
            setIsConnected(false);
            setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.IDLE, 'Session closed');
            setDiagnostics((prev) => ({
                ...prev,
                lastEvent: 'close',
                lastCloseReason: message?.closeReason || prev.lastCloseReason,
                lastCloseCode: message?.closeCode || prev.lastCloseCode
            }));
            return;
        }

        if (type === 'pong') {
            setDiagnostics((prev) => ({
                ...prev,
                lastEvent: 'pong'
            }));
        }
    }, [appendConversationEvent, diagnostics, finalizeTurn, flushPendingTurnContextSync, handleMessage, setTurnDiagnostics]);

    const queueAudioPlayback = useCallback((base64Data, mimeType = '') => {
        const parsedAudioMimeType = parseGeminiAudioMimeType(mimeType);
        if (!parsedAudioMimeType) {
            setDiagnostics((prev) => ({
                ...prev,
                lastEvent: 'audio-skip-unsupported-mime'
            }));
            return Promise.resolve(false);
        }

        setDiagnostics((prev) => ({
            ...prev,
            audioChunksPlayed: prev.audioChunksPlayed + 1,
            lastResponseHadAudio: true,
            lastEvent: 'audio-chunk',
            lastCloseReason: ''
        }));

        playbackScheduleRef.current = playbackScheduleRef.current
            .then(async () => {
                let audioContext = audioContextRef.current;
                if (!audioContext || audioContext.state === 'closed') {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    audioContextRef.current = audioContext;
                }

                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }

                const float32 = decodeBase64Pcm16ToFloat32(base64Data);
                if (!float32.length) {
                    return false;
                }

                const audioBuffer = audioContext.createBuffer(1, float32.length, parsedAudioMimeType.sampleRate);
                audioBuffer.copyToChannel(float32, 0);

                const source = audioContext.createBufferSource();
                let settlePlayback = () => {};
                const playbackDone = new Promise((resolve) => {
                    let settled = false;
                    const settle = () => {
                        if (settled) return;
                        settled = true;
                        clearTimeout(timeoutId);
                        try {
                            source.onended = null;
                            source.onerror = null;
                            source.disconnect();
                        } catch {
                            // ignore cleanup errors
                        }
                        resolve(true);
                    };
                    settlePlayback = settle;
                    const timeoutMs = Math.max(15000, Math.ceil(audioBuffer.duration * 1000) + 5000);
                    const timeoutId = setTimeout(() => {
                        settle();
                    }, timeoutMs);

                    source.onended = settle;
                    source.onerror = settle;
                });

                const startAt = calculateGeminiAudioStartTime(audioContext.currentTime, playbackCursorRef.current);
                const nextCursor = startAt + audioBuffer.duration;
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);

                try {
                    source.start(startAt);
                    playbackCursorRef.current = nextCursor;
                    trackPlaybackPromise(playbackDone);
                } catch (startErr) {
                    settlePlayback();
                    throw startErr;
                }

                return true;
            })
            .catch((playbackErr) => {
                setNormalizedError(playbackErr, 'Gemini audio playback failed');
            });

        return playbackScheduleRef.current;
    }, [setNormalizedError, trackPlaybackPromise]);

    const connect = useCallback(async (config = {}) => {
        if (!workerApi.hasWorkerApi()) {
            const reason = 'Worker API base URL is missing';
            setError(reason);
            return { ok: false, reason };
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            return { ok: true, session: wsRef.current, model: resolvedModelRef.current };
        }

        setIsConnecting(true);
        setError(null);
        setLastInterrupted(false);
        closingReasonRef.current = '';
        lastConnectConfigRef.current = config;
        const sessionId = config.sessionId || config.archiveSessionId || `live-${crypto.randomUUID()}`;
        sessionIdRef.current = sessionId;
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        resolvedModelRef.current = 'worker-managed Gemini Live';
        setResolvedModel(resolvedModelRef.current);
        logLiveDebug('connect:start', {
            sessionId,
            hasSystemInstruction: Boolean(config?.systemInstruction),
            attachExistingSession: Boolean(config.attachExistingSession)
        });

        try {
            const wsUrl = config.attachExistingSession
                ? workerApi.getInterviewLiveSessionWebSocketUrl(sessionId)
                : (await workerApi.createInterviewLiveSession({
                    id: sessionId,
                    archiveSessionId: config.archiveSessionId || sessionId
                }))?.wsUrl || workerApi.getInterviewLiveSessionWebSocketUrl(sessionId);
            const socket = new WebSocket(wsUrl);
            wsRef.current = socket;

            await new Promise((resolve, reject) => {
                socket.onopen = () => {
                    logLiveDebug('session:open', { sessionId });
                    setIsConnected(true);
                    setIsReady(true);
                    setUsesFallback(false);
                    setDiagnostics((prev) => ({ ...prev, lastEvent: 'open', lastCloseReason: '', modelStatus: 'ready' }));
                    setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.IDLE, 'Connected');
                    appendConversationEvent({
                        type: 'session-open',
                        phase: 'connected',
                        assistantText: latestAssistantTextRef.current,
                        transcriptText: latestTranscriptRef.current,
                        diagnostics: diagnosticsRef.current || diagnostics,
                        raw: { sessionId }
                    });
                    socket.send(JSON.stringify({
                        type: 'start',
                        config,
                        systemInstruction: getAssistantPrompt(config)
                    }));
                    if (heartbeatTimerRef.current) {
                        clearInterval(heartbeatTimerRef.current);
                    }
                    heartbeatTimerRef.current = setInterval(() => {
                        try {
                            if (socket.readyState === WebSocket.OPEN) {
                                socket.send(JSON.stringify({
                                    type: 'ping',
                                    timestamp: new Date().toISOString()
                                }));
                            }
                        } catch {
                            // Ignore heartbeat failures; onclose will handle real disconnects.
                        }
                    }, 25000);
                    resolve(true);
                };

                socket.onmessage = (event) => {
                    let payload = event?.data;
                    if (typeof payload === 'string') {
                        try {
                            payload = JSON.parse(payload);
                        } catch {
                            payload = { type: 'text', text: payload };
                        }
                    }
                    handleTransportMessage(payload || {});
                };

                socket.onerror = (event) => {
                    const normalized = normalizeGeminiLiveClientError(event, `${GEMINI_LIVE_PRODUCT_LABEL} transport error`);
                    const recoverable = socket.readyState === WebSocket.OPEN && normalized.category === GEMINI_LIVE_ERROR_CATEGORIES.CONNECTION_DROPPED;
                    if (recoverable) {
                        closingReasonRef.current = 'reconnect';
                        try {
                            socket.close(1012, 'reconnect');
                        } catch {
                            // ignore close errors; onclose will handle recovery.
                        }
                        return;
                    }
                    setError(normalized.message);
                    setDiagnostics((prev) => ({
                        ...prev,
                        lastEvent: 'error',
                        lastCloseReason: normalized.message,
                        errorCategory: normalized.category
                    }));
                    reject(normalized);
                };

                socket.onclose = (closeEvent) => {
                    const closeCode = closeEvent?.code ?? '';
                    const closeReason = closeEvent?.reason ?? '';
                    const isCleanupClose = closingReasonRef.current === 'cleanup';
                    const shouldRecover = closingReasonRef.current === 'reconnect' || (!isCleanupClose && classifyGeminiLiveError({
                        code: closeCode,
                        message: closeReason
                    }) === GEMINI_LIVE_ERROR_CATEGORIES.CONNECTION_DROPPED);
                    wsRef.current = null;
                    sessionRef.current = null;
                    if (heartbeatTimerRef.current) {
                        clearInterval(heartbeatTimerRef.current);
                        heartbeatTimerRef.current = null;
                    }
                    setDiagnostics((prev) => ({
                        ...prev,
                        lastEvent: isCleanupClose ? 'cleanup-close' : 'close',
                        lastCloseCode: closeCode ? String(closeCode) : prev.lastCloseCode,
                        lastCloseReason: closeReason ? String(closeReason) : prev.lastCloseReason
                    }));
                    setIsConnected(false);
                    setIsSpeaking(false);
                    if (shouldRecover) {
                        scheduleReconnectAttempt({
                            closeCode,
                            closeReason
                        });
                        return;
                    }
                    if (!isCleanupClose && (pendingPromptRef.current || activeTurnRef.current)) {
                        void finalizeTurn(true);
                    }
                    appendConversationEvent({
                        type: isCleanupClose ? 'session-close-cleanup' : 'session-close',
                        phase: isCleanupClose ? 'cleanup' : 'close',
                        assistantText: latestAssistantTextRef.current,
                        transcriptText: latestTranscriptRef.current,
                        diagnostics: diagnosticsRef.current || diagnostics,
                        raw: {
                            closeCode: closeCode ? String(closeCode) : '',
                            closeReason: closeReason ? String(closeReason) : '',
                            isCleanupClose
                        }
                    });

                    if (isCleanupClose) {
                        return;
                    }

                    const normalized = normalizeGeminiLiveClientError({
                        code: closeCode,
                        message: closeReason || `${GEMINI_LIVE_PRODUCT_LABEL} connection dropped`
                    }, `${GEMINI_LIVE_PRODUCT_LABEL} connection dropped. Please try again.`);

                    setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.IDLE, normalized.message);
                    setError(normalized.message);
                    setDiagnostics((prev) => ({
                        ...prev,
                        lastEvent: 'close-error',
                        lastCloseReason: normalized.message,
                        errorCategory: normalized.category
                    }));
                };
            });

            sessionRef.current = socket;
            return { ok: true, session: socket, model: resolvedModelRef.current, sessionId };
        } catch (connectErr) {
            const normalized = normalizeGeminiLiveClientError(connectErr, `Failed to connect to ${GEMINI_LIVE_PRODUCT_LABEL}`);
            setError(normalized.message);
            setIsConnected(false);
            setDiagnostics((prev) => ({
                ...prev,
                lastEvent: 'connect-error',
                lastCloseReason: normalized.message,
                errorCategory: normalized.category
            }));
            return { ok: false, reason: normalized.message, category: normalized.category };
        } finally {
            setIsConnecting(false);
        }
    }, [appendConversationEvent, diagnostics, finalizeTurn, handleTransportMessage, scheduleReconnectAttempt, setTurnDiagnostics]);

    reconnectLiveSessionRef.current = async (overrides = {}) => connect({
        ...(lastConnectConfigRef.current || {}),
        ...overrides,
        attachExistingSession: true,
        sessionId: overrides.sessionId || sessionIdRef.current || lastConnectConfigRef.current?.sessionId || lastConnectConfigRef.current?.archiveSessionId,
        archiveSessionId: overrides.archiveSessionId || lastConnectConfigRef.current?.archiveSessionId || sessionIdRef.current
    });

    const sendTransportMessage = useCallback((payload) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            throw new Error(`${GEMINI_LIVE_PRODUCT_LABEL} session unavailable`);
        }

        wsRef.current.send(JSON.stringify(payload));
    }, []);

    const sendPrompt = useCallback(async (text) => {
        if (!text?.trim()) return '';

        const connection = !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN
            ? await connect(lastConnectConfigRef.current || {})
            : { ok: true, session: wsRef.current };

        if (!connection.ok || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            const reason = connection.reason || `${GEMINI_LIVE_PRODUCT_LABEL} session unavailable`;
            setError(reason);
            setDiagnostics((prev) => ({
                ...prev,
                lastEvent: 'prompt-error',
                lastCloseReason: reason
            }));
            throw new Error(reason);
        }

        latestAssistantTextRef.current = '';
        setLastAssistantText('');
        setIsSpeaking(true);
        receivedAudioRef.current = false;
        clearPlaybackState();
        setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.PROMPTING, 'Sending prompt');
        logLiveDebug('prompt:start', {
            text,
            model: resolvedModelRef.current,
            connected: Boolean(wsRef.current && wsRef.current.readyState === WebSocket.OPEN)
        });
        setDiagnostics((prev) => ({
            ...prev,
            lastEvent: 'prompt-sent',
            lastResponseHadAudio: false
        }));
        appendConversationEvent({
            type: 'prompt-sent',
            phase: 'prompt',
            assistantText: text,
            transcriptText: latestTranscriptRef.current,
            turnSnapshot: safeClone(activeTurnRef.current || null),
            diagnostics: diagnosticsRef.current || diagnostics,
            raw: { text }
        });

        const responsePromise = new Promise((resolve) => {
            pendingPromptRef.current = { resolve };
        });

        sendTransportMessage({ type: 'prompt', text });

        const timeoutResult = new Promise((resolve) => {
            setTimeout(() => resolve({
                assistantText: '',
                transcriptText: '',
                interrupted: false
            }), 10000);
        });

        const result = await Promise.race([responsePromise, timeoutResult]);
        logLiveDebug('prompt:resolved', {
            assistantText: result?.assistantText,
            transcriptText: result?.transcriptText,
            interrupted: result?.interrupted,
            receivedAudio: receivedAudioRef.current
        });
        await playbackScheduleRef.current.catch(() => {});
        await waitForPlaybackDrain().catch(() => {});

        if (!receivedAudioRef.current) {
            await new Promise((resolve) => setTimeout(resolve, GEMINI_PROMPT_AUDIO_GRACE_MS));
        }

        if (!receivedAudioRef.current) {
            const reason = `${GEMINI_LIVE_PRODUCT_LABEL} returned no audio response`;
            logLiveDebug('prompt:no-audio', {
                reason,
                lastEvent: diagnosticsRef.current?.lastEvent,
                lastCloseReason: diagnosticsRef.current?.lastCloseReason
            });
            setDiagnostics((prev) => ({
                ...prev,
                lastEvent: 'prompt-text-only',
                lastCloseReason: reason
            }));
            setIsSpeaking(false);
            setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.IDLE, 'Prompt complete (text only)');
            return result?.assistantText || latestAssistantTextRef.current || text;
        }

        setIsSpeaking(false);
        setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.IDLE, 'Prompt complete');
        return result?.assistantText || latestAssistantTextRef.current || text;
    }, [appendConversationEvent, clearPlaybackState, connect, diagnostics, sendTransportMessage, setTurnDiagnostics, waitForPlaybackDrain]);

    const startAnswerCapture = useCallback(async () => {
        logLiveDebug('answer-capture:start', {
            hasSession: Boolean(wsRef.current),
            connected: Boolean(wsRef.current && wsRef.current.readyState === WebSocket.OPEN),
            isCapturing
        });
        const connection = (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)
            ? await connect(lastConnectConfigRef.current || {})
            : { ok: true, session: wsRef.current };

        if (!connection.ok || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return { ok: false, reason: connection.reason };
        }

        if (isCapturing) {
            return { ok: true };
        }

        setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.LISTENING, 'Listening for answer');
        if (activeTurnRef.current) {
            activeTurnRef.current = upsertTurnLedger({
                ...activeTurnRef.current,
                status: 'listening',
                listeningAt: new Date().toISOString()
            });
        }
        appendConversationEvent({
            type: 'capture-start',
            phase: 'listening',
            assistantText: latestAssistantTextRef.current,
            transcriptText: latestTranscriptRef.current,
            turnSnapshot: safeClone(activeTurnRef.current || null),
            diagnostics: diagnosticsRef.current || diagnostics
        });

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1
                }
            });

            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextCtor) {
                throw new Error('AudioContext is not supported in this browser');
            }

            const audioContext = new AudioContextCtor();
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            if (!audioContext.audioWorklet) {
                throw new Error('AudioWorklet is not supported in this browser');
            }

            await audioContext.audioWorklet.addModule(
                new URL('../worklets/pcm-capture-processor.js', import.meta.url)
            );

            const source = audioContext.createMediaStreamSource(stream);
            const gain = audioContext.createGain();
            const processor = new AudioWorkletNode(audioContext, 'pcm-capture-processor', {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                outputChannelCount: [1]
            });

            let mediaRecorder = null;
            captureMediaChunksRef.current = [];
            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg',
                'audio/mp4'
            ];

            for (const mimeType of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    try {
                        mediaRecorder = new MediaRecorder(stream, { mimeType });
                        break;
                    } catch {
                        // keep trying
                    }
                }
            }

            if (!mediaRecorder) {
                mediaRecorder = new MediaRecorder(stream);
            }

            captureMediaRecorderRef.current = mediaRecorder;
            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    captureMediaChunksRef.current.push(event.data);
                }
            };
            mediaRecorder.onerror = () => {
                logLiveDebug('media-recorder:error');
                setDiagnostics((prev) => ({
                    ...prev,
                    lastEvent: 'media-recorder-error'
                }));
            };
            mediaRecorder.start(1000);

            captureChunksRef.current = [];
            mediaStreamRef.current = stream;
            captureAudioContextRef.current = audioContext;
            captureSourceRef.current = source;
            captureProcessorRef.current = processor;
            captureGainRef.current = gain;

            gain.gain.value = 0;

            processor.port.onmessage = (event) => {
                const inputBuffer = event?.data;
                if (!inputBuffer || inputBuffer.length === 0) {
                    return;
                }

                const downsampled = downsampleBuffer(inputBuffer, audioContext.sampleRate, GEMINI_INPUT_SAMPLE_RATE);
                const pcmBytes = float32ToPcm16Bytes(downsampled);
                captureChunksRef.current.push(pcmBytes);

                try {
                    logLiveDebug('answer-capture:audio-chunk', {
                        samples: inputBuffer.length,
                        downsampledSamples: downsampled.length,
                        bytes: pcmBytes.length
                    });
                    sendTransportMessage({
                        type: 'audio-chunk',
                        data: bytesToBase64(pcmBytes),
                        mimeType: `audio/pcm;rate=${GEMINI_INPUT_SAMPLE_RATE}`
                    });
                } catch (streamErr) {
                    setNormalizedError(streamErr, `Failed to stream audio chunk to ${GEMINI_LIVE_PRODUCT_LABEL}`);
                }
            };

            source.connect(processor);
            processor.connect(gain);
            gain.connect(audioContext.destination);

            setIsCapturing(true);

            return { ok: true };
        } catch (captureErr) {
            const message = captureErr?.message || 'Failed to start live capture';
            logLiveDebug('answer-capture:error', {
                message
            });
            setNormalizedError(captureErr, message);
            cleanupCapture();
            return { ok: false, reason: message };
        }
    }, [appendConversationEvent, cleanupCapture, connect, diagnostics, isCapturing, setNormalizedError, setTurnDiagnostics, sendTransportMessage, upsertTurnLedger]);

    const stopAnswerCapture = useCallback(async () => {
        logLiveDebug('answer-capture:stop:start', {
            hasRecorder: Boolean(captureMediaRecorderRef.current),
            mediaRecorderState: captureMediaRecorderRef.current?.state || 'none',
            pcmChunks: captureChunksRef.current.length,
            mediaChunks: captureMediaChunksRef.current.length
        });
        setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.PROCESSING, 'Processing answer');
        if (activeTurnRef.current) {
            activeTurnRef.current = upsertTurnLedger({
                ...activeTurnRef.current,
                status: 'processing',
                endedAt: new Date().toISOString()
            });
        }
        appendConversationEvent({
            type: 'capture-stop',
            phase: 'processing',
            assistantText: latestAssistantTextRef.current,
            transcriptText: latestTranscriptRef.current,
            turnSnapshot: safeClone(activeTurnRef.current || null),
            diagnostics: diagnosticsRef.current || diagnostics
        });

        let blob = null;
        try {
            const mediaRecorder = captureMediaRecorderRef.current;
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                await new Promise((resolve) => {
                    mediaRecorder.onstop = resolve;
                    mediaRecorder.stop();
                });
            }
            if (captureMediaChunksRef.current.length > 0) {
                blob = new Blob(captureMediaChunksRef.current, {
                    type: captureMediaRecorderRef.current?.mimeType || 'audio/webm'
                });
            }
        } catch (recorderErr) {
            setNormalizedError(recorderErr, 'Gemini live media recording stop failed');
        }

        if (!blob) {
            blob = pcm16ToBlob(captureChunksRef.current);
        }

        cleanupCapture();

        try {
            sendTransportMessage({ type: 'audio-end' });
        } catch {
            // ignore end-stream errors
        }

        logLiveDebug('answer-capture:stop:done', {
            hadBlob: Boolean(blob),
            transcript: lastTranscript || latestTranscriptRef.current || '',
            assistantText: lastAssistantText || latestAssistantTextRef.current || ''
        });

        const snapshot = buildConversationSnapshot();

        return {
            ok: true,
            blob,
            transcript: getActiveTurnTranscript(),
            assistantText: lastAssistantText || latestAssistantTextRef.current || '',
            conversationSnapshot: snapshot
        };
    }, [appendConversationEvent, buildConversationSnapshot, cleanupCapture, diagnostics, getActiveTurnTranscript, lastAssistantText, lastTranscript, sendTransportMessage, setNormalizedError, setTurnDiagnostics, upsertTurnLedger]);

    const consumeLatestTranscript = useCallback((fallbackText = '') => {
        const transcript = lastTranscript || latestTranscriptRef.current || fallbackText || '';
        setLastTranscript('');
        latestTranscriptRef.current = '';
        return transcript;
    }, [lastTranscript]);

    const getConversationSnapshot = useCallback(() => buildConversationSnapshot(), [buildConversationSnapshot]);

    const reset = useCallback(() => {
        cleanupSession();
        setError(null);
        setLastAssistantText('');
        setLastTranscript('');
        latestAssistantTextRef.current = '';
        latestTranscriptRef.current = '';
        setLastInterrupted(false);
        setUsesFallback(false);
        setResolvedModel(resolvedModelRef.current);
        setModelStatus(resolvedModelRef.current ? 'ready' : (workerApi.hasWorkerApi() ? 'checking' : 'missing'));
        setIsReady(Boolean(workerApi.hasWorkerApi() && resolvedModelRef.current));
        clearTurnState();
        setTurnDiagnostics(GEMINI_LIVE_TURN_STATES.IDLE, 'Idle');
        setDiagnostics({
            lastEvent: '',
            lastCloseCode: '',
            lastCloseReason: '',
            messagesReceived: 0,
            audioChunksPlayed: 0,
            lastResponseHadAudio: false,
            turnState: GEMINI_LIVE_TURN_STATES.IDLE,
            turnStatus: describeGeminiLiveTurnState(GEMINI_LIVE_TURN_STATES.IDLE),
            modelStatus: resolvedModelRef.current ? 'ready' : (workerApi.hasWorkerApi() ? 'checking' : 'missing')
        });
    }, [clearTurnState, cleanupSession, setTurnDiagnostics]);

    return {
        isReady,
        isConnecting,
        isConnected,
        isSpeaking,
        isCapturing,
        error,
        usesFallback,
        turnState,
        turnStatus,
        lastAssistantText,
        lastTranscript,
        lastInterrupted,
        diagnostics,
        liveModel: resolvedModel,
        modelStatus,
        productLabel: GEMINI_LIVE_PRODUCT_LABEL,
        connect,
        sendPrompt,
        beginTurnContext,
        completeTurnContext,
        acknowledgeRecovery,
        markTurnInterrupted,
        startAnswerCapture,
        stopAnswerCapture,
        getConversationSnapshot,
        consumeLatestTranscript,
        reset
    };
}

export default useGeminiLive;
