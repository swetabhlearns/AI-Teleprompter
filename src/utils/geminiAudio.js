const GEMINI_AUDIO_DEFAULT_SAMPLE_RATE = 24000;
const GEMINI_AUDIO_PLAYBACK_LEAD_SECONDS = 0.05;

function normalizeMimeType(value) {
    return String(value || '').trim().toLowerCase();
}

export function parseGeminiAudioMimeType(mimeType = '') {
    const normalized = normalizeMimeType(mimeType);
    if (!normalized) {
        return {
            mimeType: `audio/pcm;rate=${GEMINI_AUDIO_DEFAULT_SAMPLE_RATE}`,
            sampleRate: GEMINI_AUDIO_DEFAULT_SAMPLE_RATE
        };
    }

    if (!normalized.startsWith('audio/pcm')) {
        return null;
    }

    const sampleRateMatch = normalized.match(/(?:^|;)\s*rate=(\d+)/i);
    const parsedSampleRate = sampleRateMatch ? Number(sampleRateMatch[1]) : GEMINI_AUDIO_DEFAULT_SAMPLE_RATE;
    const sampleRate = Number.isFinite(parsedSampleRate) && parsedSampleRate > 0
        ? parsedSampleRate
        : GEMINI_AUDIO_DEFAULT_SAMPLE_RATE;

    return {
        mimeType: normalized,
        sampleRate
    };
}

export function decodeBase64Pcm16ToFloat32(base64Data) {
    if (!base64Data) {
        return new Float32Array(0);
    }

    const atobFn = globalThis.atob || ((value) => {
        if (typeof globalThis.Buffer === 'undefined') {
            throw new Error('Base64 decoding is not supported in this environment');
        }

        return globalThis.Buffer.from(value, 'base64').toString('binary');
    });
    const binary = atobFn(base64Data);
    const byteLength = binary.length - (binary.length % 2);

    if (byteLength <= 0) {
        return new Float32Array(0);
    }

    const bytes = new Uint8Array(byteLength);
    for (let i = 0; i < byteLength; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const sampleCount = byteLength / 2;
    const float32 = new Float32Array(sampleCount);

    for (let i = 0; i < sampleCount; i += 1) {
        float32[i] = Math.max(-1, Math.min(1, view.getInt16(i * 2, true) / 32768));
    }

    return float32;
}

export function calculateGeminiAudioStartTime(currentTime, cursorTime, leadSeconds = GEMINI_AUDIO_PLAYBACK_LEAD_SECONDS) {
    const safeCurrentTime = Number.isFinite(currentTime) ? currentTime : 0;
    const safeCursorTime = Number.isFinite(cursorTime) && cursorTime > 0
        ? cursorTime
        : safeCurrentTime + leadSeconds;

    return Math.max(safeCurrentTime + leadSeconds, safeCursorTime);
}
