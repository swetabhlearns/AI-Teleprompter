/**
 * Analysis Engine for Performance Metrics
 * Handles WPM calculation, filler word detection, pause analysis, and report generation
 * Enhanced with 9 Habits for Clearer Speaking metrics
 */

// Common filler words to detect
const FILLER_WORDS = [
    'um', 'uh', 'er', 'ah', 'like', 'you know', 'basically', 'actually',
    'literally', 'honestly', 'so', 'well', 'i mean', 'right', 'okay'
];

// Hedging phrases that undermine confidence (Habit 3: Declarative Statements)
const HEDGING_PHRASES = [
    'i think maybe', 'kind of', 'sort of', 'maybe', 'possibly', 'potentially',
    'i guess', 'i suppose', 'probably', 'might be', 'could be', 'not sure but',
    'i was thinking', 'perhaps', 'somewhat', 'a little bit'
];

// Pause thresholds in seconds (Habit 1: Pause More)
const PAUSE_THRESHOLDS = {
    MICRO: 0.1,               // Ignored (natural articulation gap)
    SHORT: 0.3,               // Comma/Clause pause
    STRATEGIC: 0.8,           // Emphasis/Period pause
    TRANSITION: 2.0,          // Section break
    TOO_LONG: 4.0             // Awkward silence
};

/**
 * Calculate Words Per Minute from transcript and duration
 * @param {string} transcript - The transcribed text
 * @param {number} durationMs - Duration in milliseconds
 * @returns {number} WPM value
 */
export function calculateWPM(transcript, durationMs) {
    if (!transcript || durationMs <= 0) return 0;

    const words = transcript.trim().split(/\s+/).filter(w => w.length > 0);
    const minutes = durationMs / 60000;

    return Math.round(words.length / minutes);
}

/**
 * Detect filler words in transcript
 * @param {string} transcript - The transcribed text
 * @returns {{ count: number, occurrences: Array<{word: string, count: number}>, positions: number[] }}
 */
export function detectFillerWords(transcript) {
    if (!transcript) {
        return { count: 0, occurrences: [], positions: [] };
    }

    const lowerTranscript = transcript.toLowerCase();
    const words = lowerTranscript.split(/\s+/);
    const occurrences = {};
    const positions = [];

    // Check for single-word fillers
    words.forEach((word, index) => {
        const cleanWord = word.replace(/[.,!?;:]/g, '');
        if (FILLER_WORDS.includes(cleanWord)) {
            occurrences[cleanWord] = (occurrences[cleanWord] || 0) + 1;
            positions.push(index);
        }
    });

    // Check for multi-word fillers
    FILLER_WORDS.filter(f => f.includes(' ')).forEach(filler => {
        let idx = lowerTranscript.indexOf(filler);
        while (idx !== -1) {
            occurrences[filler] = (occurrences[filler] || 0) + 1;
            idx = lowerTranscript.indexOf(filler, idx + 1);
        }
    });

    const occurrencesList = Object.entries(occurrences)
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count);

    return {
        count: occurrencesList.reduce((sum, o) => sum + o.count, 0),
        occurrences: occurrencesList,
        positions
    };
}

/**
 * Analyze strategic pausing (Habit 1: Pause More)
 * @param {Array<{word: string, start: number, end: number}>} words - Word timing data
 * @returns {object} Pause analysis
 */
export function analyzeStrategicPauses(words) {
    if (!words || words.length < 5) {
        return {
            totalPauses: 0,
            strategicPauses: 0,
            shortPauses: 0,
            tooLongPauses: 0,
            avgPauseDuration: 0,
            pauseScore: 50,
            pauseDistribution: [],
            feedback: 'Not enough data for pause analysis'
        };
    }

    const pauses = [];
    let shortPauses = 0;
    let strategicPauses = 0;
    let tooLongPauses = 0;

    for (let i = 1; i < words.length; i++) {
        const gap = words[i].start - words[i - 1].end;

        if (gap >= PAUSE_THRESHOLDS.SHORT) {
            const isShort = gap < PAUSE_THRESHOLDS.STRATEGIC;
            const isStrategic = gap >= PAUSE_THRESHOLDS.STRATEGIC && gap < PAUSE_THRESHOLDS.TOO_LONG;
            const isTooLong = gap >= PAUSE_THRESHOLDS.TOO_LONG;

            if (isShort) shortPauses++;
            if (isStrategic) strategicPauses++;
            if (isTooLong) tooLongPauses++;

            pauses.push({
                duration: Math.round(gap * 100) / 100,
                afterWord: words[i - 1].word,
                beforeWord: words[i].word,
                timestamp: words[i - 1].end,
                type: isTooLong ? 'long' : isStrategic ? 'strategic' : 'short'
            });
        }
    }

    const avgDuration = pauses.length > 0
        ? pauses.reduce((sum, p) => sum + p.duration, 0) / pauses.length
        : 0;

    // Calculate pause score
    // Ideal: Balanced mix of short (flow) and strategic (emphasis)
    let pauseScore = 70;

    // Reward strategic pauses (aim for ~5-10% of total word count, roughly 1 per sentence)
    const strategicRatio = strategicPauses / (words.length || 1);
    if (strategicRatio > 0.05) pauseScore += 15;
    if (strategicRatio > 0.15) pauseScore -= 5; // Too choppy

    // Penalize too many long pauses
    pauseScore -= tooLongPauses * 10;

    // Penalize lack of any pauses
    if (pauses.length === 0) pauseScore = 30;

    pauseScore = Math.max(0, Math.min(100, Math.round(pauseScore)));

    // Generate feedback based on mix
    let feedback = '';
    if (pauses.length === 0) {
        feedback = 'Slow down. Add pauses between sentences to let ideas land.';
    } else if (strategicPauses === 0) {
        feedback = 'You pause briefly, but try longer pauses (1s+) for emphasis.';
    } else if (tooLongPauses > 1) {
        feedback = 'Some awkward silences detected. Keep pauses under 3 seconds.';
    } else if (shortPauses > strategicPauses * 3) {
        feedback = 'Mostly short pauses. Use longer pauses to separate big ideas.';
    } else {
        feedback = 'Great rhythm! Good mix of flow and emphasis pauses.';
    }

    return {
        totalPauses: pauses.length,
        strategicPauses,
        shortPauses,
        tooLongPauses,
        avgPauseDuration: Math.round(avgDuration * 100) / 100,
        pauseScore,
        pauseDistribution: pauses.sort((a, b) => b.duration - a.duration).slice(0, 5),
        feedback
    };
}

/**
 * Legacy pause analysis (fallback when no word timestamps available)
 */
export function analyzePauses(transcript) {
    const sentences = transcript?.split(/[.!?]+/).filter(s => s.trim()) || [];
    return {
        avgPauseLength: 0.8,
        totalPauses: Math.max(0, sentences.length - 1)
    };
}

/**
 * Detect hedging language that undermines confidence (Habit 3: Declarative Statements)
 * @param {string} transcript - The transcribed text
 * @returns {object} Hedging analysis
 */
export function detectHedgingLanguage(transcript) {
    if (!transcript) {
        return {
            hedgingCount: 0,
            hedgingPhrases: [],
            declarativeScore: 100,
            feedback: 'No transcript to analyze'
        };
    }

    const lowerTranscript = transcript.toLowerCase();
    const foundHedges = [];
    let hedgingCount = 0;

    HEDGING_PHRASES.forEach(phrase => {
        const regex = new RegExp(phrase.replace(/\s+/g, '\\s+'), 'gi');
        const matches = lowerTranscript.match(regex);
        if (matches) {
            hedgingCount += matches.length;
            foundHedges.push({ phrase, count: matches.length });
        }
    });

    // Sort by frequency
    foundHedges.sort((a, b) => b.count - a.count);

    // Calculate declarative score
    const wordCount = transcript.trim().split(/\s+/).length;
    const hedgingRatio = wordCount > 0 ? hedgingCount / wordCount : 0;

    // Score: 100 - (hedging instances * penalty)
    // Penalty increases with ratio
    const declarativeScore = Math.max(0, Math.min(100,
        Math.round(100 - (hedgingRatio * 400) - (hedgingCount * 3))
    ));

    // Generate feedback
    let feedback = '';
    if (hedgingCount === 0) {
        feedback = 'Excellent! You speak with confidence and conviction.';
    } else if (hedgingCount <= 2) {
        feedback = 'Good clarity. Minor hedging detected.';
    } else if (hedgingCount <= 5) {
        feedback = `Try replacing "${foundHedges[0]?.phrase}" with a direct statement.`;
    } else {
        feedback = 'Use more declarative statements. Say what you mean directly.';
    }

    return {
        hedgingCount,
        hedgingPhrases: foundHedges.slice(0, 5),
        declarativeScore,
        feedback
    };
}

/**
 * Analyze speaking rate variability (Habit 2: Slow Down to Highlight)
 * @param {Array<{word: string, start: number, end: number}>} words - Word timing data
 * @param {number} segmentDuration - Segment length in seconds
 * @returns {object} Rate variability analysis
 */
export function analyzeRateVariability(words) {
    if (!words || words.length < 10) {
        return {
            segments: [],
            avgWpm: 0,
            variabilityScore: 50,
            hasGoodVariation: false,
            feedback: 'Not enough data for rate analysis'
        };
    }

    // Phrasal Analysis: Split by pauses > 0.4s (SHORT threshold approx)
    const phrases = [];
    let currentPhrase = [words[0]];

    for (let i = 1; i < words.length; i++) {
        const gap = words[i].start - words[i - 1].end;
        if (gap > 0.4) {
            // End current phrase
            if (currentPhrase.length > 0) {
                phrases.push(currentPhrase);
            }
            currentPhrase = [words[i]];
        } else {
            currentPhrase.push(words[i]);
        }
    }
    if (currentPhrase.length > 0) phrases.push(currentPhrase);

    // Calculate WPM for each phrase (Articulation Rate)
    const phraseRates = phrases.map(p => {
        if (p.length < 2) return null; // Ignore single words
        const duration = p[p.length - 1].end - p[0].start;
        if (duration < 0.2) return null; // Too short
        const wpm = Math.round((p.length / duration) * 60);
        return { wpm, duration, wordCount: p.length, startTime: p[0].start };
    }).filter(r => r !== null && r.wpm < 300); // Filter out noise

    if (phraseRates.length < 3) {
        return {
            // Fallback to simple stats if not enough phrases
            avgWpm: calculateWPM(words.map(w => w.word).join(' '), (words[words.length - 1].end - words[0].start) * 1000),
            variabilityScore: 70,
            hasGoodVariation: false,
            feedback: 'Try speaking in longer phrases to establish flow.',
            segments: []
        };
    }

    const rates = phraseRates.map(r => r.wpm);
    const avgWpm = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
    const minWpm = Math.min(...rates);
    const maxWpm = Math.max(...rates);

    // Variance calculation
    const variance = rates.reduce((sum, r) => sum + Math.pow(r - avgWpm, 2), 0) / rates.length;
    const stdDev = Math.sqrt(variance);
    const cv = (stdDev / avgWpm) * 100; // Coefficient of Variation

    // Scoring
    let variabilityScore = 70;
    const hasGoodVariation = cv >= 15 && cv <= 40; // Aim for 15-40% variation

    if (hasGoodVariation) variabilityScore = 95;
    else if (cv < 15) variabilityScore = 60; // Monotone
    else variabilityScore = 60; // Erratic

    let feedback = '';
    if (cv < 15) feedback = 'Your pace is very steady. Try slowing down for emphasis.';
    else if (cv > 40) feedback = 'Pace is erratic. Aim for smoother flow between phrases.';
    else feedback = 'Excellent pace variety! You use speed changes to highlight ideas.';

    return {
        segments: phraseRates.slice(0, 20), // Return phrases for visualization
        avgWpm,
        minWpm,
        maxWpm,
        stdDev: Math.round(stdDev),
        variabilityScore,
        hasGoodVariation,
        feedback
    };
}

/**
 * Calculate clarity score based on various metrics
 * @param {object} metrics - Analysis metrics
 * @returns {number} Score from 0-100
 */
export function calculateClarityScore(metrics) {
    const { wpm, fillerCount, wordCount } = metrics;

    let score = 100;

    // Optimal WPM is 120-150, penalize for too slow or too fast
    if (wpm < 100) score -= (100 - wpm) * 0.3;
    if (wpm > 180) score -= (wpm - 180) * 0.5;

    // Penalize for filler words (ratio-based)
    const fillerRatio = wordCount > 0 ? fillerCount / wordCount : 0;
    score -= fillerRatio * 500; // Heavy penalty for fillers

    return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Analyze volume patterns for projection and energy (Habit 6: Use More Volume)
 * @param {Array<{timestamp: number, level: number}>} volumeHistory - Volume samples
 * @param {Array<{word: string, start: number, end: number}>} words - Word timing data (optional)
 * @returns {object} Volume analysis
 */
export function analyzeVolumePatterns(volumeHistory, words = []) {
    if (!volumeHistory || volumeHistory.length < 5) {
        return {
            avgVolume: 0,
            volumeScore: 50,
            hasTrailingOff: false,
            volumeVariation: 0,
            feedback: 'Not enough volume data'
        };
    }

    const levels = volumeHistory.map(v => v.level);
    const avgVolume = Math.round(levels.reduce((a, b) => a + b, 0) / levels.length);

    // Calculate standard deviation
    const variance = levels.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) / levels.length;
    const stdDev = Math.sqrt(variance);
    const volumeVariation = avgVolume > 0 ? Math.round((stdDev / avgVolume) * 100) : 0;

    // Detect trailing off: last 20% of samples significantly lower than first 80%
    const splitIndex = Math.floor(levels.length * 0.8);
    const firstPart = levels.slice(0, splitIndex);
    const lastPart = levels.slice(splitIndex);
    const avgFirst = firstPart.reduce((a, b) => a + b, 0) / firstPart.length;
    const avgLast = lastPart.reduce((a, b) => a + b, 0) / lastPart.length;
    const hasTrailingOff = avgFirst > 15 && avgLast < avgFirst * 0.6;

    // Score: Good volume = 25-60 range, penalize too quiet or inconsistent
    let volumeScore = 70;
    if (avgVolume < 15) {
        volumeScore = 40 + avgVolume; // Too quiet
    } else if (avgVolume >= 25 && avgVolume <= 60) {
        volumeScore = 90; // Ideal range
    } else if (avgVolume > 80) {
        volumeScore = 75; // Possibly too loud/clipping
    }

    if (hasTrailingOff) volumeScore -= 15;
    if (volumeVariation > 50) volumeScore -= 10; // Too inconsistent

    volumeScore = Math.max(0, Math.min(100, Math.round(volumeScore)));

    let feedback = '';
    if (avgVolume < 15) {
        feedback = "Speak up! Project your voice with more energy.";
    } else if (hasTrailingOff) {
        feedback = "Maintain volume through sentence ends. Don't trail off.";
    } else if (volumeVariation > 50) {
        feedback = "Keep volume more consistent for clarity.";
    } else {
        feedback = "Great projection! Your energy comes through well.";
    }

    return {
        avgVolume,
        volumeScore,
        hasTrailingOff,
        volumeVariation,
        feedback,
        history: levels // Return raw levels for charting
    };
}

/**
 * Analyze thought completion and rambling (Habit 7: Finish One Thought at a Time)
 * @param {string} transcript - The transcribed text
 * @returns {object} Thought completion analysis
 */
export function analyzeThoughtCompletion(transcript) {
    if (!transcript || transcript.length < 20) {
        return {
            avgSentenceLength: 0,
            longSentences: 0,
            completionScore: 50,
            feedback: 'Not enough text to analyze'
        };
    }

    // Split into sentences
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceWordCounts = sentences.map(s => s.trim().split(/\s+/).length);

    const avgLength = sentenceWordCounts.length > 0
        ? Math.round(sentenceWordCounts.reduce((a, b) => a + b, 0) / sentenceWordCounts.length)
        : 0;

    // Flag sentences over 25 words as potentially rambling
    const longSentences = sentenceWordCounts.filter(c => c > 25).length;
    const veryLongSentences = sentenceWordCounts.filter(c => c > 40).length;

    // Score: Penalize for many long sentences
    let completionScore = 90;
    completionScore -= longSentences * 5;
    completionScore -= veryLongSentences * 10;
    completionScore = Math.max(0, Math.min(100, Math.round(completionScore)));

    let feedback = '';
    if (veryLongSentences > 0) {
        feedback = 'Break up very long sentences. One idea, then pause.';
    } else if (longSentences > 2) {
        feedback = 'Some sentences are long. Try finishing thoughts sooner.';
    } else if (avgLength < 5) {
        feedback = 'Sentences are quite short—try expanding key points.';
    } else {
        feedback = 'Great sentence structure! You complete thoughts clearly.';
    }

    return {
        avgSentenceLength: avgLength,
        longSentences,
        veryLongSentences,
        sentenceCount: sentences.length,
        completionScore,
        feedback
    };
}

// Framework markers for CCC detection (Habit 8)
const FRAMEWORK_MARKERS = {
    context: ['as you know', 'given that', 'since', 'because', 'the situation is', 'the goal is', 'we need to'],
    core: ['the point is', 'the main idea', 'in short', 'my recommendation', 'we should', 'i propose', 'the key is'],
    connect: ['this means', 'this will allow', 'as a result', 'the benefit', 'for you', 'this matters because', 'what this gives us']
};

/**
 * Detect use of structured frameworks (Habit 8: Learn to Use Frameworks)
 * @param {string} transcript - The transcribed text
 * @returns {object} Framework detection analysis
 */
export function detectFrameworks(transcript) {
    if (!transcript) {
        return {
            hasContext: false,
            hasCore: false,
            hasConnect: false,
            frameworkScore: 0,
            feedback: 'No transcript to analyze'
        };
    }

    const lower = transcript.toLowerCase();

    const contextFound = FRAMEWORK_MARKERS.context.some(m => lower.includes(m));
    const coreFound = FRAMEWORK_MARKERS.core.some(m => lower.includes(m));
    const connectFound = FRAMEWORK_MARKERS.connect.some(m => lower.includes(m));

    const partsFound = [contextFound, coreFound, connectFound].filter(Boolean).length;
    const frameworkScore = Math.round((partsFound / 3) * 100);

    let feedback = '';
    if (partsFound === 3) {
        feedback = 'Excellent! You used Context-Core-Connect framework.';
    } else if (partsFound === 2) {
        feedback = `Good structure! Add more ${!contextFound ? 'context' : !coreFound ? 'core point' : 'connection'}.`;
    } else if (partsFound === 1) {
        feedback = 'Try structuring responses with Context → Core → Connect.';
    } else {
        feedback = 'Structure your message: Why (context), What (core), So what (connect).';
    }

    return {
        hasContext: contextFound,
        hasCore: coreFound,
        hasConnect: connectFound,
        frameworkScore,
        feedback
    };
}

// Analogy markers (Habit 9)
// Analogy markers (Habit 9)
const ANALOGY_MARKERS = [
    "like a", "similar to", "imagine", "think of it as", "just like", "in the same way",
    "it's like", "picture this", "for example", "comparable to", " as if", "reminds me of"
];

/**
 * Detect use of analogies and metaphors (Habit 9: Use Analogies)
 * @param {string} transcript - The transcribed text
 * @returns {object} Analogy detection analysis
 */
export function detectAnalogies(transcript) {
    if (!transcript) {
        return {
            analogyCount: 0,
            analogiesFound: [],
            analogyScore: 0,
            feedback: 'No transcript to analyze'
        };
    }

    const lower = transcript.toLowerCase();
    const found = [];

    ANALOGY_MARKERS.forEach(marker => {
        const regex = new RegExp(marker.replace(/'/g, "\\'"), 'gi');
        const matches = lower.match(regex);
        if (matches) {
            found.push({ marker, count: matches.length });
        }
    });

    const totalCount = found.reduce((sum, f) => sum + f.count, 0);

    // Score: Reward analogies (up to a point)
    let analogyScore = 50;
    if (totalCount >= 1) analogyScore = 70;
    if (totalCount >= 2) analogyScore = 85;
    if (totalCount >= 3) analogyScore = 95;
    if (totalCount > 5) analogyScore = 90; // Too many can be distracting

    let feedback = '';
    if (totalCount === 0) {
        feedback = "Try using analogies: 'It's like...' makes ideas memorable.";
    } else if (totalCount <= 2) {
        feedback = 'Good use of analogies to clarify your message.';
    } else {
        feedback = 'Great! Your analogies make complex ideas relatable.';
    }

    return {
        analogyCount: totalCount,
        analogiesFound: found,
        analogyScore,
        feedback
    };
}

/**
 * Generate a comprehensive performance report
 * @param {object} data - Analysis data including word-level timestamps
 * @returns {object} Complete performance report
 */
/**
 * Generate a comprehensive performance report
 * @param {object} data - Analysis data including word-level timestamps
 * @returns {object} Complete performance report
 */
export function generatePerformanceReport(data) {
    const {
        transcript,
        durationMs,
        eyeContactPercentage = 0,
        postureScore = 0,
        words = [],
        stutteringReport = null,
        volumeHistory = [] // New volume history
    } = data;

    const wpm = calculateWPM(transcript, durationMs);
    const fillerAnalysis = detectFillerWords(transcript);
    const pauseAnalysis = analyzeStrategicPauses(words);
    const wordCount = transcript ? transcript.trim().split(/\s+/).length : 0;

    // NEW: 9 Habits Analysis Phase 2
    const hedgingAnalysis = detectHedgingLanguage(transcript);
    const rateVariability = analyzeRateVariability(words);
    const volumeAnalysis = analyzeVolumePatterns(volumeHistory, words);
    const thoughtCompletion = analyzeThoughtCompletion(transcript);
    const frameworkDetection = detectFrameworks(transcript);
    const analogyDetection = detectAnalogies(transcript);

    const clarityScore = calculateClarityScore({
        wpm,
        fillerCount: fillerAnalysis.count,
        wordCount
    });

    // Factor in stuttering analysis if available
    const fluencyScore = stutteringReport?.fluencyScore ?? 100;

    // Calculate 9 Habits composite score
    // Weighted based on impact and reliability
    const habitsScore = Math.round(
        (pauseAnalysis.pauseScore * 0.15) +
        (rateVariability.variabilityScore * 0.10) +
        (hedgingAnalysis.declarativeScore * 0.15) +
        (volumeAnalysis.volumeScore * 0.15) + // New
        (thoughtCompletion.completionScore * 0.15) + // New
        (frameworkDetection.frameworkScore * 0.15) + // New
        (analogyDetection.analogyScore * 0.15) // New
    );

    // Overall score weighted average (now includes habits)
    const overallScore = Math.round(
        (clarityScore * 0.15) +
        (fluencyScore * 0.10) +
        (habitsScore * 0.35) + // Habits now weightier
        (Math.min(100, wpm / 1.5) * 0.10) +
        (eyeContactPercentage * 0.15) +
        (postureScore * 0.15)
    );

    // Combine recommendations from all sources
    const habitsRecommendations = generateHabitsRecommendations({
        strategicPauses: pauseAnalysis, // Renamed from strategicPauses to pauseAnalysis
        hedgingAnalysis,
        rateVariability,
        fillerAnalysis,
        volumeAnalysis, // New
        thoughtCompletion, // New
        frameworkDetection, // New
        analogyDetection // New
    });

    const baseRecommendations = generateRecommendations({
        wpm,
        fillerCount: fillerAnalysis.count,
        eyeContactPercentage,
        postureScore
    });

    const stutteringRecommendations = stutteringReport?.recommendations || [];

    return {
        summary: {
            overallScore,
            duration: durationMs,
            wordCount,
            wpm,
            fluencyScore,
            habitsScore,
            clarityScore
        },
        speech: {
            wpm,
            clarityScore,
            fillerWords: fillerAnalysis,
            pauses: pauseAnalysis
        },
        // NEW: 9 Habits for Clearer Speaking analysis
        habits: {
            delivery: {
                pauses: pauseAnalysis,
                rate: rateVariability,
                declarative: hedgingAnalysis
            },
            vocal: {
                volume: volumeAnalysis,
                // Breathing/Warmup are guidance habits, not detected
            },
            cognitive: {
                thoughtCompletion,
                frameworks: frameworkDetection,
                analogies: analogyDetection
            }
        },
        // Legacy support and visual metrics
        visual: {
            eyeContactPercentage,
            postureScore
        },
        transcript: transcript || '',
        stuttering: stutteringReport,
        recommendations: [
            ...habitsRecommendations,
            ...stutteringRecommendations,
            ...baseRecommendations
        ].slice(0, 8)
    };
}

/**
 * Generate recommendations based on 9 Habits analysis
 */
function generateHabitsRecommendations({ strategicPauses, hedgingAnalysis, rateVariability, fillerAnalysis }) {
    const recommendations = [];

    // Pause recommendations (Habit 1)
    if (strategicPauses.pauseScore < 60) {
        recommendations.push({
            icon: '⏸️',
            text: strategicPauses.feedback,
            priority: 'high'
        });
    }

    // Filler word + hedging recommendations (Habit 3)
    if (fillerAnalysis.count > 5 || hedgingAnalysis.hedgingCount > 3) {
        const topFiller = fillerAnalysis.occurrences[0]?.word;
        const topHedge = hedgingAnalysis.hedgingPhrases[0]?.phrase;
        const issue = topFiller || topHedge;
        recommendations.push({
            icon: '💬',
            text: `Replace "${issue}" with a pause or direct statement.`,
            priority: 'high'
        });
    } else if (hedgingAnalysis.declarativeScore < 70) {
        recommendations.push({
            icon: '💬',
            text: hedgingAnalysis.feedback,
            priority: 'medium'
        });
    }

    // Rate variability recommendations (Habit 2)
    if (rateVariability.variabilityScore < 60) {
        recommendations.push({
            icon: '🎚️',
            text: rateVariability.feedback,
            priority: 'medium'
        });
    }

    return recommendations;
}

/**
 * Generate personalized recommendations based on metrics
 * @param {object} metrics - Performance metrics
 * @returns {string[]} Array of recommendations
 */
function generateRecommendations(metrics) {
    const recommendations = [];

    if (metrics.wpm < 100) {
        recommendations.push('Try to increase your speaking pace slightly for better engagement.');
    } else if (metrics.wpm > 180) {
        recommendations.push('Consider slowing down to allow your audience to absorb information.');
    }

    if (metrics.fillerCount > 5) {
        recommendations.push('Practice reducing filler words by pausing briefly instead of using "um" or "uh".');
    }

    if (metrics.eyeContactPercentage < 70) {
        recommendations.push('Focus on maintaining eye contact with the camera to connect with your audience.');
    }

    if (metrics.postureScore < 70) {
        recommendations.push('Sit up straight and keep your shoulders back for a more confident presence.');
    }

    if (recommendations.length === 0) {
        recommendations.push('Great job! Keep practicing to maintain your excellent performance.');
    }

    return recommendations;
}
