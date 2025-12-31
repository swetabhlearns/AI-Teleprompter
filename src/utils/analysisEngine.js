/**
 * Analysis Engine for Performance Metrics
 * Handles WPM calculation, filler word detection, and report generation
 */

// Common filler words to detect
const FILLER_WORDS = [
    'um', 'uh', 'er', 'ah', 'like', 'you know', 'basically', 'actually',
    'literally', 'honestly', 'so', 'well', 'i mean', 'right', 'okay'
];

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
 * Analyze pause patterns in the transcript
 * @param {string} transcript - The transcribed text with timing info (if available)
 * @returns {{ avgPauseLength: number, totalPauses: number }}
 */
export function analyzePauses(transcript) {
    // This would work with timed transcripts
    // For basic implementation, we estimate based on punctuation
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim());

    return {
        avgPauseLength: 0.8, // Default estimate
        totalPauses: sentences.length - 1
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
 * Generate a comprehensive performance report
 * @param {object} data - Analysis data
 * @returns {object} Complete performance report
 */
export function generatePerformanceReport(data) {
    const { transcript, durationMs, eyeContactPercentage = 0, postureScore = 0 } = data;

    const wpm = calculateWPM(transcript, durationMs);
    const fillerAnalysis = detectFillerWords(transcript);
    const pauseAnalysis = analyzePauses(transcript);
    const wordCount = transcript ? transcript.trim().split(/\s+/).length : 0;

    const clarityScore = calculateClarityScore({
        wpm,
        fillerCount: fillerAnalysis.count,
        wordCount
    });

    // Overall score weighted average
    const overallScore = Math.round(
        (clarityScore * 0.4) +
        (Math.min(100, wpm / 1.5) * 0.2) +
        (eyeContactPercentage * 0.2) +
        (postureScore * 0.2)
    );

    return {
        summary: {
            overallScore,
            duration: durationMs,
            wordCount,
            wpm
        },
        speech: {
            wpm,
            clarityScore,
            fillerWords: fillerAnalysis,
            pauses: pauseAnalysis
        },
        presence: {
            eyeContactPercentage,
            postureScore
        },
        recommendations: generateRecommendations({
            wpm,
            fillerCount: fillerAnalysis.count,
            eyeContactPercentage,
            postureScore
        })
    };
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
