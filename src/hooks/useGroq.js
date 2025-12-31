import { useState, useCallback } from 'react';
import Groq from 'groq-sdk';
import { encode, decode } from '@toon-format/toon';
import { generateScriptPrompt } from '../utils/formatters';

// Initialize Groq client
const groq = new Groq({
    apiKey: import.meta.env.VITE_GROQ_API_KEY,
    dangerouslyAllowBrowser: true
});

/**
 * Custom hook for Groq API interactions
 * Uses TOON format for token-efficient LLM communication
 */
export function useGroq() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    /**
     * Generate a script using Groq LLM (TOON-optimized prompt)
     * @param {string} topic - Script topic
     * @param {string} tone - Tone/style
     * @param {number} targetDuration - Duration in seconds
     * @param {string} difficulty - easy/medium/hard/expert
     */
    const generateScript = useCallback(async (topic, tone = 'professional', targetDuration = 120, difficulty = 'easy') => {
        setIsLoading(true);
        setError(null);

        // Difficulty settings
        const difficultySettings = {
            easy: {
                maxWords: 8,
                wpm: 80,
                pauseFreq: 'every sentence',
                vocab: 'very simple, everyday words only',
                sentences: 'very short and simple'
            },
            medium: {
                maxWords: 12,
                wpm: 100,
                pauseFreq: 'every 2-3 sentences',
                vocab: 'common vocabulary, some variety',
                sentences: 'short to medium length'
            },
            hard: {
                maxWords: 18,
                wpm: 120,
                pauseFreq: 'occasional pauses',
                vocab: 'varied vocabulary with some complex words',
                sentences: 'medium to long, some complex structures'
            },
            expert: {
                maxWords: 25,
                wpm: 140,
                pauseFreq: 'minimal pauses',
                vocab: 'rich vocabulary, technical terms allowed',
                sentences: 'complex sentences with varied structure'
            }
        };

        const settings = difficultySettings[difficulty] || difficultySettings.easy;

        try {
            const requestData = {
                topic,
                tone,
                difficulty,
                durationSec: targetDuration,
                targetWpm: settings.wpm
            };

            const toonRequest = encode(requestData);
            console.log('TOON request:', toonRequest);

            const prompt = `Create a teleprompter script with these settings:
${toonRequest}

Difficulty: ${difficulty.toUpperCase()}
- Max ${settings.maxWords} words per sentence
- ${settings.vocab}
- ${settings.sentences}
- [PAUSE] markers: ${settings.pauseFreq}
- Target ${settings.wpm} words per minute

Output plain text script only. No markdown.`;

            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `You are a scriptwriter creating ${difficulty}-level content for speech practice. Adjust complexity based on difficulty level.`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.7,
                max_tokens: 2000,
            });

            return completion.choices[0]?.message?.content || '';
        } catch (err) {
            console.error('Groq script generation error:', err);
            setError(err.message || 'Failed to generate script');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Transcribe audio using Groq Whisper
     */
    const transcribeAudio = useCallback(async (audioBlob) => {
        setIsLoading(true);
        setError(null);

        console.log('=== Starting Groq Whisper Transcription ===');
        console.log('Blob size:', audioBlob.size, 'bytes');
        console.log('Blob type:', audioBlob.type);

        if (!audioBlob || audioBlob.size === 0) {
            console.error('Empty audio blob provided');
            setError('No audio data to transcribe');
            setIsLoading(false);
            return '';
        }

        try {
            const audioFile = new File([audioBlob], 'recording.webm', {
                type: audioBlob.type || 'audio/webm'
            });

            console.log('Calling Groq Whisper API...');

            const transcription = await groq.audio.transcriptions.create({
                file: audioFile,
                model: 'whisper-large-v3',
                language: 'en',
                response_format: 'text'
            });

            console.log('=== Transcription Success ===');
            console.log('Result:', transcription);

            return transcription;
        } catch (err) {
            console.error('=== Groq Transcription Error ===');
            console.error('Error:', err.message);
            setError(err.message || 'Failed to transcribe audio');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Analyze transcript using TOON format for response (saves ~40% tokens)
     */
    const analyzePerformance = useCallback(async (transcript, originalScript = '') => {
        setIsLoading(true);
        setError(null);

        try {
            // Encode input data with TOON
            const inputData = {
                transcript: transcript.slice(0, 500), // Limit length
                hasOriginalScript: !!originalScript,
                scriptPreview: originalScript ? originalScript.slice(0, 200) : ''
            };

            const toonInput = encode(inputData);
            console.log('TOON analysis input:', toonInput);

            const prompt = `Analyze speech fluency practice:
${toonInput}

Respond in TOON format:
clarity: 1-10
pacing: 1-10
adherence: 1-10
fillerCount: number
tips[3]: tip1,tip2,tip3
strengths[2]: strength1,strength2`;

            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: 'You are a compassionate speech coach. Analyze fluency with encouragement. Respond ONLY in TOON format (key: value, arrays with [n]).'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.3,
                max_tokens: 300,
            });

            const response = completion.choices[0]?.message?.content || '';
            console.log('TOON response:', response);

            // Try to decode TOON response
            try {
                const parsed = decode(response.trim());
                console.log('Decoded TOON:', parsed);
                return {
                    clarity: parsed.clarity || 7,
                    pacing: parsed.pacing || 7,
                    adherence: parsed.adherence || 7,
                    fillerCount: parsed.fillerCount || 0,
                    tips: parsed.tips || ['Keep practicing!'],
                    strengths: parsed.strengths || ['Good effort!']
                };
            } catch (parseErr) {
                console.warn('TOON decode failed, trying JSON fallback:', parseErr.message);

                // Fallback: try JSON
                const jsonMatch = response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        return JSON.parse(jsonMatch[0]);
                    } catch { }
                }

                // Default response
                return {
                    clarity: 7,
                    pacing: 7,
                    adherence: 7,
                    tips: ['Keep practicing for improvement'],
                    strengths: ['Good effort!']
                };
            }
        } catch (err) {
            console.error('Groq analysis error:', err);
            setError(err.message || 'Failed to analyze performance');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        generateScript,
        transcribeAudio,
        analyzePerformance,
        isLoading,
        error
    };
}
