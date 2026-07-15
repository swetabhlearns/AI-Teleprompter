import { useState, useCallback, useRef, useEffect } from 'react';
import { workerApi } from '../api/workerClient.js';

// Rachel Voice ID (Free, pre-made voice)
// See https://api.elevenlabs.io/v1/voices for list
const RACHEL_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

export function useElevenLabs() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [error, setError] = useState(null);
    const audioRef = useRef(null);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    // Simple browser TTS fallback
    const fallbackSpeak = useCallback((text) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);
        setIsLoading(false);
    }, []);

    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    }, []);

    /**
     * Convert text to speech using ElevenLabs API
     * @param {string} text - Text to speak
     * @param {string} voiceId - Voice ID (default: Rachel)
     */
    const speak = useCallback(async (text, voiceId = RACHEL_VOICE_ID) => {
        if (!text) return;

        // Fallback to Web Speech API if the Worker is unavailable or if TTS fails.
        if (!workerApi.hasWorkerApi()) {
            console.warn('Worker API not found for ElevenLabs TTS. Falling back to browser TTS.');
            fallbackSpeak(text);
            return;
        }

        try {
            stop(); // Stop any current playback
            setIsLoading(true);
            setError(null);

            // Use Turbo v2.5 for lowest latency, or Multilingual v2 for quality
            // Using Turbo v2.5 as it's best for interactive latency
            const response = await workerApi.generateElevenLabsTts(voiceId, {
                text,
                model_id: 'eleven_turbo_v2_5',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                },
                output_format: 'mp3_44100_128'
            });

            const audioBlob = response;
            const audioUrl = URL.createObjectURL(audioBlob);

            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            audio.onended = () => {
                setIsSpeaking(false);
                URL.revokeObjectURL(audioUrl);
            };

            audio.onerror = (e) => {
                console.error('Audio playback error', e);
                setIsSpeaking(false);
                setError('Audio playback failed');
            };

            setIsSpeaking(true);
            await audio.play();
            setIsLoading(false);

        } catch (err) {
            console.error('ElevenLabs TTS error:', err);
            setError(err.message);
            setIsLoading(false);

            // Auto-fallback to browser TTS on error
            console.log('Falling back to browser TTS due to error...');
            fallbackSpeak(text);
        }
    }, [fallbackSpeak, stop]);

    return {
        speak,
        stop,
        isSpeaking,
        isLoading,
        error,
        hasApiKey: workerApi.hasWorkerApi()
    };
}
