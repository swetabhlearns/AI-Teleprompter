import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Kokoro TTS Hook - Simple version with loading indicator
 * No pre-generation, just straightforward TTS with processing overlay
 */
export function useKokoroTTS() {
    const [isLoading, setIsLoading] = useState(true);
    const [isReady, setIsReady] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [usesFallback, setUsesFallback] = useState(false);

    const ttsRef = useRef(null);
    const audioContextRef = useRef(null);
    const currentSourceRef = useRef(null);
    const abortRef = useRef(false);

    // Initialize Kokoro TTS on mount
    useEffect(() => {
        let mounted = true;

        const initKokoro = async () => {
            try {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();

                // Small delay to let UI render first
                await new Promise(r => setTimeout(r, 100));

                if (!mounted) return;

                console.log('Loading Kokoro TTS model...');
                const { KokoroTTS } = await import('kokoro-js');

                const tts = await KokoroTTS.from_pretrained(
                    'onnx-community/Kokoro-82M-v1.0-ONNX',
                    { dtype: 'q8', device: 'wasm' }
                );

                if (mounted) {
                    ttsRef.current = tts;
                    setIsReady(true);
                    setUsesFallback(false);
                    setIsLoading(false);
                    console.log('Kokoro TTS ready!');
                }
            } catch (err) {
                console.error('Kokoro TTS failed:', err);
                if (mounted) {
                    setError(err.message);
                    setUsesFallback(true);
                    setIsReady(true);
                    setIsLoading(false);
                }
            }
        };

        initKokoro();

        return () => {
            mounted = false;
            abortRef.current = true;
            audioContextRef.current?.close().catch(() => { });
        };
    }, []);

    /**
     * Speak text using Kokoro TTS
     */
    const speak = useCallback(async (text, voice = 'af_heart') => {
        if (!text) return;

        // Stop any current playback
        stop();
        abortRef.current = false;

        // Use Kokoro if available
        if (ttsRef.current && !usesFallback) {
            try {
                setIsGenerating(true);

                // Allow UI to update before heavy processing
                await new Promise(r => requestAnimationFrame(() => setTimeout(r, 16)));

                if (abortRef.current) {
                    setIsGenerating(false);
                    return;
                }

                console.log('Generating speech:', text.substring(0, 40) + '...');
                const audio = await ttsRef.current.generate(text, { voice });

                if (abortRef.current) {
                    setIsGenerating(false);
                    return;
                }

                setIsGenerating(false);

                // Resume audio context if needed
                if (audioContextRef.current?.state === 'suspended') {
                    await audioContextRef.current.resume();
                }

                // Play audio
                const audioBuffer = audioContextRef.current.createBuffer(
                    1,
                    audio.audio.length,
                    audio.sampling_rate || 24000
                );
                audioBuffer.getChannelData(0).set(audio.audio);

                return new Promise((resolve) => {
                    if (abortRef.current) { resolve(); return; }

                    const source = audioContextRef.current.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(audioContextRef.current.destination);
                    currentSourceRef.current = source;
                    setIsSpeaking(true);

                    source.onended = () => {
                        setIsSpeaking(false);
                        currentSourceRef.current = null;
                        resolve();
                    };

                    source.start();
                });

            } catch (err) {
                console.error('Kokoro error:', err);
                setIsGenerating(false);
                return speakFallback(text);
            }
        }

        return speakFallback(text);
    }, [usesFallback]);

    /**
     * Web Speech API fallback
     */
    const speakFallback = useCallback((text) => {
        return new Promise((resolve) => {
            setIsSpeaking(true);
            const synth = window.speechSynthesis;
            synth.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            const voices = synth.getVoices();
            const preferredVoice = voices.find(v =>
                v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Premium'))
            ) || voices.find(v => v.lang.startsWith('en'));

            if (preferredVoice) utterance.voice = preferredVoice;
            utterance.rate = 0.95;

            utterance.onend = () => { setIsSpeaking(false); resolve(); };
            utterance.onerror = () => { setIsSpeaking(false); resolve(); };
            synth.speak(utterance);
        });
    }, []);

    /**
     * Stop speaking
     */
    const stop = useCallback(() => {
        abortRef.current = true;

        if (currentSourceRef.current) {
            try { currentSourceRef.current.stop(); } catch { }
            currentSourceRef.current = null;
        }

        window.speechSynthesis?.cancel();
        setIsSpeaking(false);
        setIsGenerating(false);
    }, []);

    // No-op functions for compatibility
    const pregenerate = useCallback(() => { }, []);
    const clearCache = useCallback(() => { }, []);

    return {
        speak,
        stop,
        pregenerate,
        clearCache,
        isLoading,
        isReady,
        isSpeaking,
        isGenerating,
        usesFallback,
        error
    };
}

export default useKokoroTTS;
