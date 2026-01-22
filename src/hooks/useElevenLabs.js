import { useState, useCallback, useRef, useEffect } from 'react';

// ElevenLabs API configuration
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Rachel Voice ID (Free, pre-made voice)
// See https://api.elevenlabs.io/v1/voices for list
const RACHEL_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

export function useElevenLabs() {
    const [isLoading, setIsLoading] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [error, setError] = useState(null);
    const audioRef = useRef(null);

    // Check if API key is available
    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    /**
     * Convert text to speech using ElevenLabs API
     * @param {string} text - Text to speak
     * @param {string} voiceId - Voice ID (default: Rachel)
     */
    const speak = useCallback(async (text, voiceId = RACHEL_VOICE_ID) => {
        if (!text) return;

        // Fallback to Web Speech API if no API key or if quota exceeded (handled in catch)
        if (!apiKey) {
            console.warn('ElevenLabs API key not found. Falling back to browser TTS.');
            fallbackSpeak(text);
            return;
        }

        try {
            stop(); // Stop any current playback
            setIsLoading(true);
            setError(null);

            // Use Turbo v2.5 for lowest latency, or Multilingual v2 for quality
            // Using Turbo v2.5 as it's best for interactive latency
            const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': apiKey
                },
                body: JSON.stringify({
                    text,
                    model_id: 'eleven_turbo_v2_5',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));

                // specific handling for quota exceeded (status 401 or 403 often)
                if (response.status === 401 || errorData?.detail?.status === 'quota_exceeded') {
                    throw new Error('ElevenLabs quota exceeded or invalid key');
                }

                throw new Error(errorData?.detail?.message || 'Failed to generate speech');
            }

            const audioBlob = await response.blob();
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
    }, [apiKey]);

    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    }, []);

    // Simple browser TTS fallback
    const fallbackSpeak = (text) => {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        setIsSpeaking(true);
        window.speechSynthesis.speak(utterance);
        setIsLoading(false);
    };

    return {
        speak,
        stop,
        isSpeaking,
        isLoading,
        error,
        hasApiKey: !!apiKey
    };
}
