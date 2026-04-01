export const GEMINI_LIVE_PRODUCT_LABEL = 'Gemini 3.1 Flash Live';

export const GEMINI_LIVE_RUNTIME_REGISTRY = Object.freeze([
    {
        productLabel: GEMINI_LIVE_PRODUCT_LABEL,
        apiVersion: 'v1beta',
        capabilities: Object.freeze(['live', 'audio-input', 'audio-output', 'transcription']),
        displayNameMatchers: Object.freeze([
            /^gemini 3\.1 flash live preview$/i,
            /^gemini 3\.1 flash live(?: preview)?$/i
        ]),
        nameMatchers: Object.freeze([
            /^models\/gemini-3\.1-flash-live-preview(?:[-\w]*)?$/i,
            /^gemini-3\.1-flash-live-preview(?:[-\w]*)?$/i
        ])
    }
]);

export const GEMINI_LIVE_ERROR_CATEGORIES = Object.freeze({
    MODEL_UNSUPPORTED: 'model unsupported',
    BAD_REQUEST_PAYLOAD: 'bad request payload',
    CONNECTION_DROPPED: 'connection dropped',
    NO_AUDIO_RESPONSE: 'no audio response',
    API_KEY_MISSING: 'api key missing',
    UNKNOWN: 'unknown'
});

export const GEMINI_LIVE_TURN_STATES = {
    IDLE: 'idle',
    PROMPTING: 'prompting',
    LISTENING: 'listening',
    PROCESSING: 'processing',
    INTERRUPTED: 'interrupted',
    RECONNECTING: 'reconnecting',
    RECOVERED: 'recovered'
};

const GEMINI_LIVE_TURN_STATE_LABELS = {
    [GEMINI_LIVE_TURN_STATES.IDLE]: 'Idle',
    [GEMINI_LIVE_TURN_STATES.PROMPTING]: 'Prompting',
    [GEMINI_LIVE_TURN_STATES.LISTENING]: 'Listening',
    [GEMINI_LIVE_TURN_STATES.PROCESSING]: 'Processing',
    [GEMINI_LIVE_TURN_STATES.INTERRUPTED]: 'Interrupted',
    [GEMINI_LIVE_TURN_STATES.RECONNECTING]: 'Reconnecting',
    [GEMINI_LIVE_TURN_STATES.RECOVERED]: 'Recovered'
};

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeLowerText(value) {
    return normalizeText(value).toLowerCase();
}

export function describeGeminiLiveTurnState(state) {
    return GEMINI_LIVE_TURN_STATE_LABELS[state] || 'Idle';
}

export function classifyGeminiLiveError(error) {
    const code = Number(error?.code ?? error?.status ?? error?.statusCode ?? error?.closeCode ?? '');
    const message = normalizeLowerText(error?.message || error?.reason || error?.detail || error || '');

    if (!message || /api key|missing api key|invalid api key/.test(message)) {
        if (/api key|missing api key|invalid api key/.test(message)) {
            return GEMINI_LIVE_ERROR_CATEGORIES.API_KEY_MISSING;
        }
    }

    if (
        code === 401 ||
        code === 403 ||
        /unauthorized|forbidden|api key/.test(message)
    ) {
        return GEMINI_LIVE_ERROR_CATEGORIES.API_KEY_MISSING;
    }

    if (
        code === 404 ||
        /unsupported|not found|unavailable|does not exist|no matching model/.test(message)
    ) {
        return GEMINI_LIVE_ERROR_CATEGORIES.MODEL_UNSUPPORTED;
    }

    if (
        code === 400 ||
        code === 422 ||
        code === 1007 ||
        /bad request|invalid payload|payload|malformed|unsupported audio|audio format|mime type|turncomplete|turn complete/.test(message)
    ) {
        return GEMINI_LIVE_ERROR_CATEGORIES.BAD_REQUEST_PAYLOAD;
    }

    if (
        code === 1006 ||
        code === 1001 ||
        /disconnect|disconnected|closed|close|network|websocket|connection lost|connection dropped|timed out|timeout|aborted/.test(message)
    ) {
        return GEMINI_LIVE_ERROR_CATEGORIES.CONNECTION_DROPPED;
    }

    if (/no audio response|no audio|audio response/i.test(message)) {
        return GEMINI_LIVE_ERROR_CATEGORIES.NO_AUDIO_RESPONSE;
    }

    return GEMINI_LIVE_ERROR_CATEGORIES.UNKNOWN;
}

export function formatGeminiLiveErrorMessage(error, fallbackMessage = `${GEMINI_LIVE_PRODUCT_LABEL} failed`) {
    const category = classifyGeminiLiveError(error);

    switch (category) {
        case GEMINI_LIVE_ERROR_CATEGORIES.MODEL_UNSUPPORTED:
            return 'Gemini 3.1 Flash Live Preview is unavailable in the current Gemini model list.';
        case GEMINI_LIVE_ERROR_CATEGORIES.BAD_REQUEST_PAYLOAD:
            return 'Gemini 3.1 Flash Live Preview rejected the request payload.';
        case GEMINI_LIVE_ERROR_CATEGORIES.CONNECTION_DROPPED:
            return 'Gemini 3.1 Flash Live Preview connection dropped. Please try again.';
        case GEMINI_LIVE_ERROR_CATEGORIES.NO_AUDIO_RESPONSE:
            return 'Gemini 3.1 Flash Live Preview returned no audio response.';
        case GEMINI_LIVE_ERROR_CATEGORIES.API_KEY_MISSING:
            return 'Gemini API key is missing or invalid.';
        default:
            return normalizeText(error?.message || error?.reason || fallbackMessage || `${GEMINI_LIVE_PRODUCT_LABEL} failed`);
    }
}

export function normalizeGeminiLiveError(error, fallbackMessage = `${GEMINI_LIVE_PRODUCT_LABEL} failed`) {
    return {
        category: classifyGeminiLiveError(error),
        message: formatGeminiLiveErrorMessage(error, fallbackMessage),
        detail: normalizeText(error?.message || error?.reason || error?.detail || '')
    };
}

export function transitionGeminiLiveTurnState(currentState, event) {
    switch (event) {
        case 'prompt':
            return GEMINI_LIVE_TURN_STATES.PROMPTING;
        case 'listen':
            return GEMINI_LIVE_TURN_STATES.LISTENING;
        case 'processing':
            return GEMINI_LIVE_TURN_STATES.PROCESSING;
        case 'interrupt':
            return GEMINI_LIVE_TURN_STATES.INTERRUPTED;
        case 'reconnect':
            return GEMINI_LIVE_TURN_STATES.RECONNECTING;
        case 'recovered':
            return GEMINI_LIVE_TURN_STATES.RECOVERED;
        case 'complete':
        case 'idle':
            return GEMINI_LIVE_TURN_STATES.IDLE;
        default:
            return currentState || GEMINI_LIVE_TURN_STATES.IDLE;
    }
}

export function buildGeminiLiveTurnFingerprint(turn = {}, phase = 'context') {
    return [
        phase,
        turn.turnId || '',
        Number.isFinite(turn.turnIndex) ? turn.turnIndex : '',
        Number.isFinite(turn.questionIndex) ? turn.questionIndex : '',
        normalizeText(turn.questionText),
        normalizeText(turn.assistantText),
        normalizeText(turn.transcriptText),
        turn.interrupted ? '1' : '0',
        Number.isFinite(turn.retryCount) ? turn.retryCount : ''
    ].join('|');
}

export function buildGeminiLiveTurnContext(turn = {}, previousTurn = null) {
    const lines = [];
    const questionText = normalizeText(turn.questionText || turn.question?.text);
    const assistantText = normalizeText(turn.assistantText);
    const transcriptText = normalizeText(turn.transcriptText || turn.transcript);
    const previousAssistantText = normalizeText(previousTurn?.assistantText);
    const previousTranscriptText = normalizeText(previousTurn?.transcriptText || previousTurn?.transcript);

    lines.push('Interview turn context');

    if (Number.isFinite(turn.turnIndex)) {
        lines.push(`Turn: ${turn.turnIndex + 1}`);
    }

    if (Number.isFinite(turn.questionIndex)) {
        lines.push(`Question index: ${turn.questionIndex + 1}`);
    }

    if (questionText) {
        lines.push(`Question: ${questionText}`);
    }

    if (assistantText && assistantText !== questionText) {
        lines.push(`Assistant prompt: ${assistantText}`);
    }

    if (previousAssistantText) {
        lines.push(`Previous assistant prompt: ${previousAssistantText}`);
    }

    if (previousTranscriptText) {
        lines.push(`Previous candidate answer: ${previousTranscriptText}`);
    }

    if (transcriptText) {
        lines.push(`Current candidate transcript: ${transcriptText}`);
    }

    lines.push(`Interruption: ${turn.interrupted ? 'yes' : 'no'}`);

    if (Number.isFinite(turn.retryCount) && turn.retryCount > 0) {
        lines.push(`Retry count: ${turn.retryCount}`);
    }

    lines.push('Keep the next response grounded in the active interview thread.');

    return lines.join('\n');
}

export function buildGeminiLiveRealtimeText(turn = {}, previousTurn = null) {
    return buildGeminiLiveTurnContext(turn, previousTurn);
}

export function extractLiveText(message) {
    if (!message) return '';

    const parts = message.serverContent?.modelTurn?.parts || [];
    const text = parts
        .map((part) => part?.text || '')
        .filter(Boolean)
        .join(' ')
        .trim();

    return text;
}

export function extractLiveTranscript(message) {
    if (!message) return '';

    const inputText = message.serverContent?.inputTranscription?.text?.trim();
    if (inputText) return inputText;

    const outputText = message.serverContent?.outputTranscription?.text?.trim();
    if (outputText) return outputText;

    return '';
}

export function extractLiveInputTranscript(message) {
    if (!message) return '';

    return message.serverContent?.inputTranscription?.text?.trim() || '';
}

export function extractLiveOutputTranscript(message) {
    if (!message) return '';

    return message.serverContent?.outputTranscription?.text?.trim() || '';
}

export function isLiveTurnComplete(message) {
    return Boolean(
        message?.serverContent?.turnComplete ||
        message?.serverContent?.generationComplete ||
        message?.serverContent?.waitingForInput
    );
}

export function isLiveInterrupted(message) {
    return Boolean(message?.serverContent?.interrupted);
}
