import { useState, useCallback } from 'react';
import { encode } from '@toon-format/toon';
import { generateDeliveryRoadmapPrompt } from '../utils/formatters.js';
import { workerApi } from '../api/workerClient.js';

function extractWordsFromSegments(segments) {
    const words = [];

    for (const segment of segments) {
        const segmentText = segment.text?.trim() || '';
        const segmentWords = segmentText.split(/\s+/).filter((word) => word.length > 0);

        if (segmentWords.length === 0) continue;

        const segmentDuration = segment.end - segment.start;
        const wordDuration = segmentDuration / segmentWords.length;

        segmentWords.forEach((word, index) => {
            words.push({
                word,
                start: segment.start + (index * wordDuration),
                end: segment.start + ((index + 1) * wordDuration)
            });
        });
    }

    return words;
}

function buildRoadmapMessages({
    topic,
    tone,
    targetDuration,
    difficulty,
    currentScript,
    mode,
    settings
}) {
    const prompt = generateDeliveryRoadmapPrompt({
        topic,
        tone,
        targetDuration,
        difficulty,
        currentScript,
        mode
    });

    return [
        {
            role: 'system',
            content: `You are a speech coach and script editor. Write clean, speakable scripts with visible delivery notation. ${mode === 'refine' ? 'Preserve the original meaning while improving pacing and structure.' : ''}`
        },
        {
            role: 'user',
            content: `${prompt}\n\nTOON context:\n${encode({
                topic,
                tone,
                difficulty,
                durationSec: targetDuration,
                targetWpm: settings.wpm,
                currentScriptPreview: currentScript ? currentScript.slice(0, 500) : ''
            })}\n\nDelivery detail:\n- Max ${settings.maxWords} words per sentence\n- ${settings.vocab}\n- ${settings.sentences}\n- [PAUSE] markers: ${settings.pauseFreq}\n- Target ${settings.wpm} words per minute`
        }
    ];
}

function buildDifficultySettings(difficulty) {
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

    return difficultySettings[difficulty] || difficultySettings.easy;
}

function createAudioFile(audioBlob) {
    let extension = 'webm';
    if (audioBlob.type.includes('mp4')) extension = 'mp4';
    else if (audioBlob.type.includes('ogg')) extension = 'ogg';
    else if (audioBlob.type.includes('wav')) extension = 'wav';

    return new File([audioBlob], `recording.${extension}`, {
        type: audioBlob.type || 'audio/webm'
    });
}

export function useGroq() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const requestRoadmapScript = useCallback(async ({
        topic,
        tone = 'professional',
        targetDuration = 120,
        difficulty = 'easy',
        currentScript = '',
        mode = 'generate'
    }) => {
        setIsLoading(true);
        setError(null);

        const settings = buildDifficultySettings(difficulty);
        const requestBody = {
            model: 'llama-3.3-70b-versatile',
            temperature: 0.7,
            max_tokens: 2200,
            messages: buildRoadmapMessages({
                topic,
                tone,
                targetDuration,
                difficulty,
                currentScript,
                mode,
                settings
            })
        };

        try {
            if (!workerApi.hasWorkerApi()) {
                throw new Error('Worker API is not configured');
            }

            const completion = mode === 'refine'
                ? await workerApi.refineScript(requestBody)
                : await workerApi.generateScript(requestBody);
            return completion.choices?.[0]?.message?.content || '';
        } catch (err) {
            console.error('Script generation error:', err);
            setError(err.message || 'Failed to generate script');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const generateScript = useCallback(async (topic, tone = 'professional', targetDuration = 120, difficulty = 'easy') => {
        return requestRoadmapScript({
            topic,
            tone,
            targetDuration,
            difficulty,
            mode: 'generate'
        });
    }, [requestRoadmapScript]);

    const refineScript = useCallback(async (script, options = {}) => {
        const {
            topic = '',
            tone = 'professional',
            targetDuration = 120,
            difficulty = 'medium'
        } = options;

        return requestRoadmapScript({
            topic: topic || 'this script',
            tone,
            targetDuration,
            difficulty,
            currentScript: script,
            mode: script?.trim() ? 'refine' : 'generate'
        });
    }, [requestRoadmapScript]);

    const transcribeAudio = useCallback(async (audioBlob) => {
        setIsLoading(true);
        setError(null);

        console.log('=== Starting transcription through Worker ===');
        console.log('Blob size:', audioBlob?.size || 0, 'bytes');
        console.log('Blob type:', audioBlob?.type || '');

        if (!audioBlob || audioBlob.size === 0) {
            console.error('Empty audio blob provided');
            setError('No audio data to transcribe');
            setIsLoading(false);
            return { text: '', words: [], segments: [] };
        }

        try {
            if (!workerApi.hasWorkerApi()) {
                throw new Error('Worker API is not configured for transcription');
            }

            const audioFile = createAudioFile(audioBlob);
            const formData = new FormData();
            formData.append('file', audioFile);
            formData.append('model', 'whisper-large-v3');
            formData.append('language', 'en');
            formData.append('response_format', 'verbose_json');

            const transcription = await workerApi.transcribeAudio(formData);

            let words = transcription.words || [];
            if (words.length === 0 && transcription.segments?.length > 0) {
                words = extractWordsFromSegments(transcription.segments);
            }

            return {
                text: transcription.text || '',
                words,
                segments: transcription.segments || [],
                duration: transcription.duration || 0
            };
        } catch (err) {
            console.error('=== Transcription Error ===');
            console.error('Error name:', err.name);
            console.error('Error message:', err.message);
            setError(err.message || 'Failed to transcribe audio');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

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
- Keep each topic concise: 6-10 words max
- Use simple, readable language with no long clauses
- Mix of serious and interesting

Examples:
- "Should remote work stay permanent?"
- "Should social media be limited for teens?"
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

            const completion = await workerApi.generateExtemporeTopics({
                model: 'llama-3.3-70b-versatile',
                temperature: 0.8,
                max_tokens: 500,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a creative topic generator for speech practice.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            });

            const response = completion.choices[0]?.message?.content || '';
            const jsonMatch = response.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return parsed.topics || [];
            }

            return [
                'Should AI replace creative work?',
                'Should social media have stricter rules?',
                'Is sustainable living worth the cost?',
                'Will digital education replace classrooms?'
            ];
        } catch (err) {
            console.error('Topic generation error:', err);
            setError(err.message || 'Failed to generate topics');
            return [
                'Should AI replace creative work?',
                'Should social media have stricter rules?',
                'Is sustainable living worth the cost?',
                'Will digital education replace classrooms?'
            ];
        } finally {
            setIsLoading(false);
        }
    }, []);

    const generateExtemporeCoachSuggestion = useCallback(async ({
        topic = '',
        transcriptText = '',
        pauseStats = {},
        fillerStats = {},
        currentState = '',
        issueCounts = {}
    } = {}) => {
        setIsLoading(true);
        setError(null);

        try {
            const prompt = `You are coaching a beginner who struggles to continue speaking.

Topic: ${topic || 'unknown'}
Current state: ${currentState || 'unknown'}
Transcript excerpt: ${transcriptText ? transcriptText.slice(0, 800) : 'none'}
Pause stats: ${JSON.stringify(pauseStats)}
Filler stats: ${JSON.stringify(fillerStats)}
Issue counts: ${JSON.stringify(issueCounts)}

Return one short recovery recommendation for the next session.
The recommendation must be a single practical drill sentence.
Also choose one prompt type from:
- start_here
- bridge
- return_to_point
- close_this_thought
- reset

Respond in JSON format:
{
  "promptType": "bridge",
  "title": "Bridge",
  "message": "Use a bridge phrase and continue.",
  "starter": "What I mean is...",
  "example": "That connects because...",
  "recommendedDrill": "Practice restarting with a bridge phrase after each pause.",
  "confidence": 0.82
}`;

            const completion = await workerApi.generateExtemporeCoachSuggestion({
                model: 'llama-3.3-70b-versatile',
                temperature: 0.3,
                max_tokens: 500,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a calm speech coach. Be concrete, brief, and beginner-friendly.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            });

            const response = completion.choices[0]?.message?.content || '';
            const jsonMatch = response.match(/\{[\s\S]*\}/);

            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    promptType: String(parsed.promptType || 'bridge'),
                    title: String(parsed.title || 'Bridge'),
                    message: String(parsed.message || 'Use a bridge phrase and continue.'),
                    starter: String(parsed.starter || 'What I mean is...'),
                    example: String(parsed.example || 'That connects because...'),
                    recommendedDrill: String(parsed.recommendedDrill || 'Practice restarting with a bridge phrase after each pause.'),
                    confidence: Number.isFinite(Number(parsed.confidence)) ? Number(parsed.confidence) : 0.75
                };
            }

            return {
                promptType: 'bridge',
                title: 'Bridge',
                message: 'Use a bridge phrase and continue.',
                starter: 'What I mean is...',
                example: 'That connects because...',
                recommendedDrill: 'Practice restarting with a bridge phrase after each pause.',
                confidence: 0.5
            };
        } catch (err) {
            console.error('Extempore coaching suggestion error:', err);
            setError(err.message || 'Failed to generate coaching suggestion');
            return {
                promptType: 'bridge',
                title: 'Bridge',
                message: 'Use a bridge phrase and continue.',
                starter: 'What I mean is...',
                example: 'That connects because...',
                recommendedDrill: 'Practice restarting with a bridge phrase after each pause.',
                confidence: 0.4
            };
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        generateScript,
        refineScript,
        transcribeAudio,
        generateExtemporeTopics,
        generateExtemporeCoachSuggestion,
        isLoading,
        error
    };
}
