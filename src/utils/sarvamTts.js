export const SARVAM_TTS_API_URL = 'https://api.sarvam.ai/text-to-speech';
export const SARVAM_TTS_DEFAULT_LANGUAGE = 'en-IN';
export const SARVAM_TTS_DEFAULT_SPEAKER = 'shubh';
export const SARVAM_TTS_DEFAULT_MODEL = 'bulbul:v3';

export function decodeBase64ToUint8Array(base64) {
    if (!base64) {
        return new Uint8Array();
    }

    if (typeof atob === 'function') {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }

        return bytes;
    }

    if (typeof globalThis.Buffer !== 'undefined') {
        return Uint8Array.from(globalThis.Buffer.from(base64, 'base64'));
    }

    throw new Error('Base64 decoding is not supported in this environment');
}

export function buildSarvamAudioBlob(base64Audio, mimeType = 'audio/wav') {
    const audioBytes = decodeBase64ToUint8Array(base64Audio);
    return new Blob([audioBytes], { type: mimeType });
}

export function extractSarvamErrorMessage(errorPayload, fallbackMessage = 'Failed to generate speech') {
    if (!errorPayload) {
        return fallbackMessage;
    }

    if (typeof errorPayload === 'string') {
        return errorPayload;
    }

    return (
        errorPayload?.detail?.message ||
        errorPayload?.message ||
        errorPayload?.error ||
        fallbackMessage
    );
}
