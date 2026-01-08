/**
 * Stuttering Pattern Analyzer
 * Analyzes word-level timestamps to detect stuttering patterns:
 * - Blocks (abnormal pauses)
 * - Repetitions (word/sound repetitions)
 * - Pace variations (inconsistent speaking speed)
 */

// Thresholds for detection (in seconds)
const BLOCK_THRESHOLD = 0.5; // Pause > 0.5s considered a potential block
const SEVERE_BLOCK_THRESHOLD = 1.0; // Pause > 1s is a severe block
const NORMAL_WORD_GAP = 0.15; // Normal gap between words

/**
 * Detect blocks (abnormal pauses between words)
 * @param {Array<{word: string, start: number, end: number}>} words - Word timing data
 * @returns {{ blocks: Array<{beforeWord: string, afterWord: string, duration: number, timestamp: number}>, count: number, severity: string }}
 */
export function detectBlocks(words) {
    if (!words || words.length < 2) {
        return { blocks: [], count: 0, severity: 'none' };
    }

    const blocks = [];

    for (let i = 1; i < words.length; i++) {
        const prevWord = words[i - 1];
        const currWord = words[i];
        const gap = currWord.start - prevWord.end;

        if (gap >= BLOCK_THRESHOLD) {
            blocks.push({
                beforeWord: prevWord.word,
                afterWord: currWord.word,
                duration: Math.round(gap * 100) / 100,
                timestamp: prevWord.end,
                isSevere: gap >= SEVERE_BLOCK_THRESHOLD
            });
        }
    }

    // Calculate severity based on block count and duration
    const severeBlocks = blocks.filter(b => b.isSevere).length;
    let severity = 'none';
    if (blocks.length > 5 || severeBlocks > 2) {
        severity = 'high';
    } else if (blocks.length > 2 || severeBlocks > 0) {
        severity = 'moderate';
    } else if (blocks.length > 0) {
        severity = 'mild';
    }

    return {
        blocks,
        count: blocks.length,
        severeCount: severeBlocks,
        severity
    };
}

/**
 * Detect word and sound repetitions
 * @param {Array<{word: string, start: number, end: number}>} words - Word timing data
 * @returns {{ repetitions: Array<{word: string, count: number, timestamp: number}>, count: number }}
 */
export function detectRepetitions(words) {
    if (!words || words.length < 2) {
        return { repetitions: [], count: 0 };
    }

    const repetitions = [];
    let i = 0;

    while (i < words.length) {
        const currentWord = words[i].word.toLowerCase().replace(/[.,!?;:]/g, '');
        let repeatCount = 1;
        let j = i + 1;

        // Check for exact repetitions (the the the)
        while (j < words.length) {
            const nextWord = words[j].word.toLowerCase().replace(/[.,!?;:]/g, '');
            if (nextWord === currentWord) {
                repeatCount++;
                j++;
            } else {
                break;
            }
        }

        if (repeatCount > 1) {
            repetitions.push({
                word: currentWord,
                count: repeatCount,
                timestamp: words[i].start,
                type: 'word'
            });
            i = j;
        } else {
            i++;
        }
    }

    // Also check for partial/stuttered words (b-b-ball pattern in transcript)
    const transcript = words.map(w => w.word).join(' ');
    const stutterPattern = /\b([a-z])-\1+-[a-z]+/gi;
    const stutterMatches = transcript.match(stutterPattern) || [];

    stutterMatches.forEach(match => {
        repetitions.push({
            word: match,
            count: (match.match(/-/g) || []).length + 1,
            timestamp: 0, // Can't get exact timestamp for this
            type: 'syllable'
        });
    });

    return {
        repetitions,
        count: repetitions.length
    };
}

/**
 * Analyze pace variation throughout the speech
 * @param {Array<{word: string, start: number, end: number}>} words - Word timing data
 * @param {number} segmentDuration - Duration of each segment in seconds (default: 10)
 * @returns {{ segments: Array<{startTime: number, wpm: number}>, variation: number, consistency: string }}
 */
export function analyzePaceVariation(words, segmentDuration = 10) {
    if (!words || words.length < 5) {
        return { segments: [], variation: 0, consistency: 'unknown' };
    }

    const totalDuration = words[words.length - 1].end - words[0].start;
    const numSegments = Math.max(1, Math.floor(totalDuration / segmentDuration));
    const segments = [];

    for (let seg = 0; seg < numSegments; seg++) {
        const segStart = words[0].start + (seg * segmentDuration);
        const segEnd = segStart + segmentDuration;

        const segmentWords = words.filter(w => w.start >= segStart && w.start < segEnd);
        const wordCount = segmentWords.length;
        const actualDuration = segmentWords.length > 0
            ? (segmentWords[segmentWords.length - 1].end - segmentWords[0].start)
            : segmentDuration;

        const wpm = actualDuration > 0 ? Math.round((wordCount / actualDuration) * 60) : 0;

        segments.push({
            startTime: Math.round(segStart * 10) / 10,
            wpm,
            wordCount
        });
    }

    // Calculate variation (standard deviation of WPM)
    if (segments.length > 1) {
        const wpmValues = segments.map(s => s.wpm).filter(w => w > 0);
        const avgWpm = wpmValues.reduce((a, b) => a + b, 0) / wpmValues.length;
        const variance = wpmValues.reduce((sum, wpm) => sum + Math.pow(wpm - avgWpm, 2), 0) / wpmValues.length;
        const stdDev = Math.sqrt(variance);
        const variation = Math.round((stdDev / avgWpm) * 100); // Coefficient of variation as percentage

        let consistency = 'consistent';
        if (variation > 40) {
            consistency = 'highly variable';
        } else if (variation > 25) {
            consistency = 'somewhat variable';
        }

        return {
            segments,
            variation,
            consistency,
            averageWpm: Math.round(avgWpm)
        };
    }

    return {
        segments,
        variation: 0,
        consistency: 'unknown',
        averageWpm: segments[0]?.wpm || 0
    };
}

/**
 * Generate comprehensive stuttering report
 * @param {Array<{word: string, start: number, end: number}>} words - Word timing data
 * @returns {object} Complete stuttering analysis
 */
export function generateStutteringReport(words) {
    const blocks = detectBlocks(words);
    const repetitions = detectRepetitions(words);
    const paceVariation = analyzePaceVariation(words);

    // Calculate overall fluency score (0-100)
    let fluencyScore = 100;

    // Deduct for blocks
    fluencyScore -= blocks.count * 5;
    fluencyScore -= blocks.severeCount * 10;

    // Deduct for repetitions
    fluencyScore -= repetitions.count * 8;

    // Deduct for high pace variation
    if (paceVariation.variation > 40) {
        fluencyScore -= 15;
    } else if (paceVariation.variation > 25) {
        fluencyScore -= 8;
    }

    fluencyScore = Math.max(0, Math.min(100, fluencyScore));

    // Generate severity assessment
    let overallSeverity = 'minimal';
    if (fluencyScore < 50) {
        overallSeverity = 'significant';
    } else if (fluencyScore < 70) {
        overallSeverity = 'moderate';
    } else if (fluencyScore < 85) {
        overallSeverity = 'mild';
    }

    // Generate specific recommendations
    const recommendations = generateStutteringRecommendations({
        blocks,
        repetitions,
        paceVariation
    });

    return {
        fluencyScore,
        overallSeverity,
        blocks,
        repetitions,
        paceVariation,
        recommendations,
        wordCount: words?.length || 0
    };
}

/**
 * Generate personalized recommendations for stuttering patterns
 */
function generateStutteringRecommendations({ blocks, repetitions, paceVariation }) {
    const recommendations = [];

    // Block-related recommendations
    if (blocks.severity === 'high') {
        recommendations.push({
            icon: '🧘',
            text: 'Practice gentle onset technique - start words with a soft, easy voice.',
            priority: 'high'
        });
        recommendations.push({
            icon: '💨',
            text: 'Focus on exhaling gently before speaking to reduce tension.',
            priority: 'high'
        });
    } else if (blocks.severity === 'moderate') {
        recommendations.push({
            icon: '⏸️',
            text: 'Use intentional pauses at natural points instead of fighting through blocks.',
            priority: 'medium'
        });
    } else if (blocks.count > 0) {
        recommendations.push({
            icon: '✨',
            text: 'Good job managing blocks! Continue practicing relaxed breathing.',
            priority: 'low'
        });
    }

    // Repetition-related recommendations
    if (repetitions.count > 3) {
        recommendations.push({
            icon: '🎯',
            text: 'Try slowing down slightly and stretching the first sound of words.',
            priority: 'medium'
        });
    } else if (repetitions.count > 0) {
        recommendations.push({
            icon: '🌊',
            text: 'Practice smooth, flowing speech - let words connect naturally.',
            priority: 'low'
        });
    }

    // Pace-related recommendations
    if (paceVariation.consistency === 'highly variable') {
        recommendations.push({
            icon: '🎵',
            text: 'Practice with a metronome or rhythmic pattern to stabilize pace.',
            priority: 'medium'
        });
    } else if (paceVariation.averageWpm < 100) {
        recommendations.push({
            icon: '⚡',
            text: 'Your pace is deliberate - this is good for control! Gradually increase as comfort grows.',
            priority: 'low'
        });
    }

    // Always add an encouraging note
    if (recommendations.length === 0) {
        recommendations.push({
            icon: '🎉',
            text: 'Excellent fluency! Keep up the great practice.',
            priority: 'low'
        });
    }

    return recommendations.slice(0, 4); // Max 4 recommendations
}
