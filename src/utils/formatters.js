/**
 * Formatters Utility
 * Text formatting, time display, and script parsing utilities
 */

/**
 * Format duration in milliseconds to readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration (e.g., "2:30" or "1:05:30")
 */
export function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format WPM for display with context
 * @param {number} wpm - Words per minute
 * @returns {{ value: number, label: string, color: string }}
 */
export function formatWPM(wpm) {
    let label, color;

    if (wpm < 100) {
        label = 'Slow';
        color = '#f59e0b'; // Warning
    } else if (wpm <= 150) {
        label = 'Optimal';
        color = '#10b981'; // Success
    } else if (wpm <= 180) {
        label = 'Fast';
        color = '#6366f1'; // Primary
    } else {
        label = 'Too Fast';
        color = '#ef4444'; // Danger
    }

    return { value: wpm, label, color };
}

/**
 * Parse script text and identify pause markers
 * @param {string} script - Raw script text
 * @returns {Array<{type: 'text' | 'pause', content: string}>}
 */
export function parseScriptWithMarkers(script) {
    if (!script) return [];

    const parts = [];
    const pauseRegex = /\[(?:PAUSE|pause|Pause)(?:\s*-?\s*(\d+)s?)?\]/gi;

    let lastIndex = 0;
    let match;

    while ((match = pauseRegex.exec(script)) !== null) {
        // Add text before the pause
        if (match.index > lastIndex) {
            const textContent = script.slice(lastIndex, match.index).trim();
            if (textContent) {
                parts.push({ type: 'text', content: textContent });
            }
        }

        // Add the pause marker
        const pauseDuration = match[1] || '2';
        parts.push({ type: 'pause', content: `⏸ Pause ${pauseDuration}s` });

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < script.length) {
        const remainingText = script.slice(lastIndex).trim();
        if (remainingText) {
            parts.push({ type: 'text', content: remainingText });
        }
    }

    return parts;
}

/**
 * Convert script to teleprompter-ready format with word highlighting
 * @param {string} script - Script text
 * @returns {string[]} Array of paragraphs for teleprompter
 */
export function formatForTeleprompter(script) {
    if (!script) return [];

    // Split by paragraphs and pause markers
    const paragraphs = script
        .split(/\n\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

    return paragraphs;
}

/**
 * Estimate reading time for a script
 * @param {string} script - Script text
 * @param {number} wpm - Target words per minute (default: 130)
 * @returns {number} Estimated reading time in seconds
 */
export function estimateReadingTime(script, wpm = 130) {
    if (!script) return 0;

    const words = script.trim().split(/\s+/).filter(w => w.length > 0);
    const pauseCount = (script.match(/\[pause\]/gi) || []).length;

    const readingMinutes = words.length / wpm;
    const pauseSeconds = pauseCount * 2; // 2 seconds per pause

    return Math.round(readingMinutes * 60 + pauseSeconds);
}

/**
 * Format score for display with color coding
 * @param {number} score - Score value (0-100)
 * @returns {{ value: number, label: string, color: string }}
 */
export function formatScore(score) {
    let label, color;

    if (score >= 90) {
        label = 'Excellent';
        color = '#10b981';
    } else if (score >= 75) {
        label = 'Good';
        color = '#6366f1';
    } else if (score >= 60) {
        label = 'Fair';
        color = '#f59e0b';
    } else {
        label = 'Needs Work';
        color = '#ef4444';
    }

    return { value: score, label, color };
}

/**
 * Format timestamp for display
 * @param {Date | number} date - Date object or timestamp
 * @returns {string} Formatted date string
 */
export function formatTimestamp(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}

/**
 * Generate prompt for AI script generation
 * @param {string} topic - Script topic
 * @param {string} tone - Desired tone
 * @param {number} targetDuration - Target duration in seconds
 * @returns {string} Formatted prompt
 */
export function generateScriptPrompt(topic, tone, targetDuration) {
    const wordCount = Math.round((targetDuration / 60) * 100); // 100 WPM for slower, comfortable pace

    return `Write a teleprompter script about "${topic}" with a ${tone} tone.

IMPORTANT: This script is for someone practicing to improve their speaking fluency.

Requirements:
- Approximately ${wordCount} words (for a ${Math.round(targetDuration / 60)} minute video at a relaxed pace)
- Include [PAUSE] markers frequently (every 1-2 sentences) for breathing and composure
- Use VERY SHORT sentences (max 10-12 words each)
- Avoid tongue-twisters, alliteration, and complex consonant clusters
- Use simple, common vocabulary
- Write in a calm, supportive tone
- Include encouraging phrases like "Take your time" or "Breathe" in [PAUSE] markers
- Start with an easy opening sentence
- Build confidence gradually through the script

Format the output as plain text with paragraphs separated by blank lines.
Mark breathing pauses as [PAUSE] or [PAUSE - breathe].`;
}
