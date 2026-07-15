import { useState, useCallback, useRef, useEffect } from 'react';
import {
    SARVAM_TTS_DEFAULT_LANGUAGE,
    SARVAM_TTS_DEFAULT_MODEL,
    SARVAM_TTS_DEFAULT_SPEAKER,
    buildSarvamAudioBlob,
} from '../utils/sarvamTts.js';
import { workerApi } from '../api/workerClient.js';

export function useSarvamTTS({ enabled = true } = {}) {
    const [isLoading, setIsLoading] = useState(true);
    const [isReady, setIsReady] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [usesFallback, setUsesFallback] = useState(false);

    const audioRef = useRef(null);
    const audioUrlRef = useRef(null);
    const abortRef = useRef(null);

    useEffect(() => {
        let mounted = true;

        const initSarvam = async () => {
            if (!enabled) {
                if (mounted) {
                    setIsLoading(false);
                    setIsReady(false);
                    setIsGenerating(false);
                    setIsSpeaking(false);
                    setUsesFallback(false);
                }
                return;
            }

            if (mounted) {
                setUsesFallback(!workerApi.hasWorkerApi());
                setIsReady(true);
                setIsLoading(false);
            }
        };

        initSarvam();

        return () => {
            mounted = false;
            abortRef.current?.abort();

            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }

            if (audioUrlRef.current) {
                URL.revokeObjectURL(audioUrlRef.current);
                audioUrlRef.current = null;
            }
        };
    }, [enabled]);

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

            utterance.onend = () => {
                setIsSpeaking(false);
                resolve();
            };
            utterance.onerror = () => {
                setIsSpeaking(false);
                resolve();
            };
            synth.speak(utterance);
        });
    }, []);

    const stop = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;

        if (audioRef.current) {
            try {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            } catch {
                // ignore playback cleanup errors
            }
            audioRef.current = null;
        }

        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
        }

        window.speechSynthesis?.cancel();
        setIsSpeaking(false);
        setIsGenerating(false);
    }, []);

    const playAudioBlob = useCallback((audioBlob) => {
        return new Promise((resolve, reject) => {
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            audioRef.current = audio;
            audioUrlRef.current = audioUrl;

            audio.onended = () => {
                setIsSpeaking(false);
                if (audioUrlRef.current === audioUrl) {
                    URL.revokeObjectURL(audioUrl);
                    audioUrlRef.current = null;
                }
                audioRef.current = null;
                resolve();
            };

            audio.onerror = (event) => {
                setIsSpeaking(false);
                if (audioUrlRef.current === audioUrl) {
                    URL.revokeObjectURL(audioUrl);
                    audioUrlRef.current = null;
                }
                audioRef.current = null;
                reject(event);
            };

            setIsSpeaking(true);
            audio.play().catch((playError) => {
                setIsSpeaking(false);
                if (audioUrlRef.current === audioUrl) {
                    URL.revokeObjectURL(audioUrl);
                    audioUrlRef.current = null;
                }
                audioRef.current = null;
                reject(playError);
            });
        });
    }, []);

    const speak = useCallback(async (text, options = {}) => {
        if (!text) return;

        stop();

        if (!workerApi.hasWorkerApi()) {
            setUsesFallback(true);
            return speakFallback(text);
        }

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            setIsGenerating(true);
            setError(null);

            const payload = await workerApi.generateSarvamTts({
                text,
                target_language_code: options.targetLanguageCode || SARVAM_TTS_DEFAULT_LANGUAGE,
                speaker: options.speaker || SARVAM_TTS_DEFAULT_SPEAKER,
                model: options.model || SARVAM_TTS_DEFAULT_MODEL,
                pace: options.pace ?? 1
            }, {
                signal: controller.signal
            });

            const base64Audio = payload?.audios?.[0];

            if (!base64Audio) {
                throw new Error('Sarvam TTS returned no audio');
            }

            const audioBlob = buildSarvamAudioBlob(base64Audio);
            if (controller.signal.aborted) {
                return;
            }

            setIsGenerating(false);
            await playAudioBlob(audioBlob);
        } catch (err) {
            if (err?.name === 'AbortError') {
                return;
            }

            console.error('Sarvam TTS error:', err);
            setError(err.message);
            setIsGenerating(false);
            return speakFallback(text);
        } finally {
            if (abortRef.current === controller) {
                abortRef.current = null;
            }
        }
    }, [playAudioBlob, speakFallback, stop]);

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

export default useSarvamTTS;
