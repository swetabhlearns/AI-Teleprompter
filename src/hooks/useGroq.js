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
 * Extract word-level timing from Whisper segments
 * Groq's verbose_json may not include words array, so we derive timing from segments
 */
function extractWordsFromSegments(segments) {
    const words = [];

    for (const segment of segments) {
        const segmentText = segment.text?.trim() || '';
        const segmentWords = segmentText.split(/\s+/).filter(w => w.length > 0);

        if (segmentWords.length === 0) continue;

        // Estimate timing for each word based on segment duration
        const segmentDuration = segment.end - segment.start;
        const wordDuration = segmentDuration / segmentWords.length;

        segmentWords.forEach((word, index) => {
            words.push({
                word: word,
                start: segment.start + (index * wordDuration),
                end: segment.start + ((index + 1) * wordDuration)
            });
        });
    }

    return words;
}

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
     * Transcribe audio using Groq Whisper with word-level timestamps
     * Returns both text and word timing data for stuttering analysis
     */
    const transcribeAudio = useCallback(async (audioBlob) => {
        setIsLoading(true);
        setError(null);

        console.log('=== Starting Groq Whisper Transcription (Verbose Mode) ===');
        console.log('Blob size:', audioBlob.size, 'bytes');
        console.log('Blob type:', audioBlob.type);

        if (!audioBlob || audioBlob.size === 0) {
            console.error('Empty audio blob provided');
            setError('No audio data to transcribe');
            setIsLoading(false);
            return { text: '', words: [], segments: [] };
        }

        try {
            const audioFile = new File([audioBlob], 'recording.webm', {
                type: audioBlob.type || 'audio/webm'
            });

            console.log('Calling Groq Whisper API with verbose_json...');

            const transcription = await groq.audio.transcriptions.create({
                file: audioFile,
                model: 'whisper-large-v3',
                language: 'en',
                response_format: 'verbose_json'
            });

            console.log('=== Transcription Success (Verbose) ===');
            console.log('Full response:', transcription);
            console.log('Text:', transcription.text);
            console.log('Words:', transcription.words);
            console.log('Segments:', transcription.segments);

            // Groq returns words directly in verbose_json mode
            let words = transcription.words || [];

            // If no words array but we have segments, try to extract timing from segments
            if (words.length === 0 && transcription.segments?.length > 0) {
                console.log('No words array, extracting from segments...');
                words = extractWordsFromSegments(transcription.segments);
            }

            console.log('Words count:', words.length);

            // Return structured data for stuttering analysis
            return {
                text: transcription.text || '',
                words: words,
                segments: transcription.segments || [],
                duration: transcription.duration || 0
            };
        } catch (err) {
            console.error('=== Groq Transcription Error ===');
            console.error('Error:', err.message);
            console.error('Full error:', err);
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

    /**
     * Generate MBA interview questions based on profile and college
     * @param {Object} config - Interview configuration
     */
    const generateInterviewQuestions = useCallback(async (config) => {
        setIsLoading(true);
        setError(null);

        const { college, interviewType, profile, duration } = config;
        const questionCount = Math.max(3, Math.ceil(duration / 2)); // ~2 mins per question

        try {
            const prompt = `You are an interviewer conducting a mock MBA admission interview for ${college || 'a top B-school'}.

Interview Type: ${interviewType}
Candidate Profile:
- Name: ${profile.name || 'Candidate'}
- Background: ${profile.background || 'Not specified'}
- Work Experience: ${profile.workExperience || 'Fresher'}
- Education: ${profile.education || 'Not specified'}
- Hobbies: ${profile.hobbies || 'Not specified'}
- Why MBA: ${profile.whyMba || 'Not specified'}

Generate exactly ${questionCount} interview questions. Mix these types:
1. Personal/Introduction (1 question)
2. Career & MBA motivation (1-2 questions)
3. Current affairs/GK (1 question if applicable)
4. Situational/Behavioral (1-2 questions)
5. Stress/Curveball (1 question)

For each question, provide:
- The question text
- The category
- Key points to cover in a good answer (brief)

Respond in JSON format:
{
  "questions": [
    {"text": "question here", "category": "category", "keyPoints": ["point1", "point2"]}
  ]
}`;

            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `You are an experienced MBA interviewer from ${college || 'IIM'}. Be professional but warm. Ask probing questions that test clarity of thought, communication, and self-awareness.`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.8,
                max_tokens: 1500,
            });

            const response = completion.choices[0]?.message?.content || '';

            // Parse JSON response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return parsed.questions || [];
            }

            throw new Error('Failed to parse interview questions');
        } catch (err) {
            console.error('Interview question generation error:', err);
            setError(err.message || 'Failed to generate questions');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Evaluate candidate's answer to an interview question
     * @param {Object} question - The interview question
     * @param {string} answer - Transcribed answer
     * @param {Object} context - Additional context (profile, etc.)
     */
    const evaluateAnswer = useCallback(async (question, answer, context = {}) => {
        setIsLoading(true);
        setError(null);

        try {
            const prompt = `Evaluate this MBA interview answer.

Question: "${question.text}"
Category: ${question.category}
Key Points Expected: ${question.keyPoints?.join(', ') || 'N/A'}

Candidate's Answer: "${answer}"

Answer Duration: ${context.duration || 0} seconds
Word Count: ${answer.split(/\s+/).filter(w => w).length}

Evaluate on:
1. Content Relevance (Did they answer the question?)
2. Structure (Was it organized - STAR method, clear intro/body/conclusion?)
3. Specificity (Concrete examples vs vague statements)
4. Communication (Clarity, confidence indicators)
5. Self-awareness (For personal questions)

Provide:
- Score: 1-10 (7+ is good)
- Strengths: What they did well
- Improvements: Specific actionable tips
- Sample ideal response: A brief model answer

Respond in JSON:
{
  "score": 8,
  "strengths": ["strength1", "strength2"],
  "improvements": ["tip1", "tip2"],
  "sampleAnswer": "brief model answer"
}`;

            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: 'You are an MBA interview coach. Be encouraging but honest. Focus on actionable improvements.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.5,
                max_tokens: 800,
            });

            const response = completion.choices[0]?.message?.content || '';

            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            // Fallback
            return {
                score: 6,
                strengths: ['Attempted the question'],
                improvements: ['Try to be more specific with examples'],
                sampleAnswer: ''
            };
        } catch (err) {
            console.error('Answer evaluation error:', err);
            setError(err.message || 'Failed to evaluate answer');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    /**
     * Generate extempore/GD topics
     * @param {string} category - Topic category
     */
    const generateExtemporeTopics = useCallback(async (category = 'general') => {
        setIsLoading(true);
        setError(null);

        try {
            const prompt = `Generate 4 thought-provoking debate or extempore speech topics.
Category: ${category} (e.g. general, technology, social, india, business)

Topics should be:
- Open-ended conversational questions
- Relevant to modern context
- Easy to speak on for 2-3 minutes
- Mix of serious and interesting

Examples:
- "Is remote work the future of employment?"
- "Should social media usage be regulated for minors?"
- "Is India ready for electric vehicles?"

Respond in JSON format:
{
  "topics": [
    "Topic 1 text",
    "Topic 2 text",
    "Topic 3 text",
    "Topic 4 text"
  ]
}`;

            const completion = await groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: 'You are a creative topic generator for speech practice.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.8,
                max_tokens: 500,
            });

            const response = completion.choices[0]?.message?.content || '';
            const jsonMatch = response.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return parsed.topics || [];
            }

            // Fallback topics if parsing fails
            return [
                "Is artificial intelligence a threat to creativity?",
                "The impact of social media on mental health",
                "Sustainable living: Fad or necessity?",
                "The future of education in a digital world"
            ];

        } catch (err) {
            console.error('Topic generation error:', err);
            setError(err.message || 'Failed to generate topics');
            return [
                "Is artificial intelligence a threat to creativity?",
                "The impact of social media on mental health",
                "Sustainable living: Fad or necessity?",
                "The future of education in a digital world"
            ];
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        generateScript,
        transcribeAudio,
        analyzePerformance,
        generateInterviewQuestions,
        evaluateAnswer,
        generateExtemporeTopics,
        isLoading,
        error
    };
}

