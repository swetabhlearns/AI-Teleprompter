/**
 * Kokoro TTS Web Worker
 * Runs TTS inference off the main thread to prevent UI blocking
 */

import { KokoroTTS } from 'kokoro-js';

let tts = null;
let isInitializing = false;

// Initialize TTS model
async function initializeTTS() {
    if (tts || isInitializing) return;

    isInitializing = true;

    try {
        console.log('[Worker] Initializing Kokoro TTS...');

        tts = await KokoroTTS.from_pretrained(
            'onnx-community/Kokoro-82M-v1.0-ONNX',
            {
                dtype: 'q8',
                device: 'wasm'
            }
        );

        console.log('[Worker] Kokoro TTS initialized successfully');
        self.postMessage({ type: 'ready' });
    } catch (error) {
        console.error('[Worker] TTS initialization failed:', error);
        self.postMessage({ type: 'error', error: error.message });
    } finally {
        isInitializing = false;
    }
}

// Generate speech
async function generateSpeech(text, voice, requestId) {
    if (!tts) {
        self.postMessage({
            type: 'error',
            requestId,
            error: 'TTS not initialized'
        });
        return;
    }

    try {
        console.log('[Worker] Generating speech for:', text.substring(0, 50) + '...');

        const audio = await tts.generate(text, { voice });

        // Transfer audio data back to main thread
        self.postMessage({
            type: 'audio',
            requestId,
            audio: audio.audio, // Float32Array
            sampleRate: audio.sampling_rate || 24000
        }, [audio.audio.buffer]); // Transfer ownership for performance

    } catch (error) {
        console.error('[Worker] Speech generation failed:', error);
        self.postMessage({
            type: 'error',
            requestId,
            error: error.message
        });
    }
}

// Handle messages from main thread
self.onmessage = async (event) => {
    const { type, text, voice, requestId } = event.data;

    switch (type) {
        case 'init':
            await initializeTTS();
            break;
        case 'generate':
            await generateSpeech(text, voice || 'af_heart', requestId);
            break;
        case 'ping':
            self.postMessage({ type: 'pong', ready: !!tts });
            break;
        default:
            console.warn('[Worker] Unknown message type:', type);
    }
};

// Auto-initialize on load
initializeTTS();
