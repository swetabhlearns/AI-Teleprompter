export const EXTEMPORE_CENTER_INDEX = 2;
export const EXTEMPORE_VISIBLE_ROWS = 5;
export const EXTEMPORE_SPIN_STEP_MS = 110;
export const EXTEMPORE_SPIN_SETTLE_MS = 650;
export const EXTEMPORE_LOCK_CONFIRM_MS = 420;
export const EXTEMPORE_SPIN_CYCLES = 6;
export const EXTEMPORE_BLUEPRINT_GOAL_MS = 120000;

function shuffleArray(items, randomFn = Math.random) {
    const next = [...items];

    for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(randomFn() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
    }

    return next;
}

export function buildRollingDeck(topics, randomFn = Math.random, cycles = EXTEMPORE_SPIN_CYCLES) {
    const source = Array.isArray(topics) ? topics.filter(Boolean) : [];

    if (source.length === 0) {
        return {
            deck: [],
            targetIndex: 0,
            winningTopic: ''
        };
    }

    const winningTopic = source[Math.floor(randomFn() * source.length)];
    const deck = [];

    for (let cycle = 0; cycle < Math.max(cycles - 1, 1); cycle += 1) {
        deck.push(...shuffleArray(source, randomFn));
    }

    const finalCycle = shuffleArray(source, randomFn);
    const insertionIndex = Math.min(EXTEMPORE_CENTER_INDEX, Math.max(finalCycle.length - 1, 0));
    finalCycle[insertionIndex] = winningTopic;
    deck.push(...finalCycle);

    return {
        deck,
        targetIndex: deck.length - finalCycle.length + insertionIndex,
        winningTopic
    };
}

export function getSelectionPhaseCopy(phase, hasTopics, isGeneratingTopics) {
    const isReady = hasTopics && !isGeneratingTopics;

    switch (phase) {
        case 'randomizing':
            return {
                badge: 'Randomizing',
                title: 'Shuffling the topic reel',
                helper: 'The reel is moving now. The center lane will settle on the winning topic.',
                actionLabel: 'Shuffling...',
                actionHint: 'Please wait while the selector lands the topic.',
                isActionDisabled: true
            };
        case 'locking':
            return {
                badge: 'Locking',
                title: 'Center lane is confirming the topic',
                helper: 'The reel has found the topic and is locking it into place.',
                actionLabel: 'Locking...',
                actionHint: 'The selected topic is being confirmed.',
                isActionDisabled: true
            };
        case 'locked':
            return {
                badge: 'Locked',
                title: 'Topic selected',
                helper: 'The centered topic is now the authoritative prompt for practice.',
                actionLabel: 'Selected',
                actionHint: 'Moving into practice now.',
                isActionDisabled: true
            };
        default:
            return {
                badge: 'Idle',
                title: isReady ? 'Press start to reveal a topic' : 'Preparing your topic pool',
                helper: isReady
                    ? 'The selector stays still until you choose to start randomization.'
                    : 'A fresh set of topics is loading in the background.',
                actionLabel: isReady ? 'Start Random Topic' : 'Loading Topics...',
                actionHint: isReady
                    ? 'Click to begin the randomized reveal.'
                    : 'Topic generation is still running.',
                isActionDisabled: !isReady
            };
    }
}

export function getBlueprintStageIndex(elapsedTime, isRecording, goalMs = EXTEMPORE_BLUEPRINT_GOAL_MS) {
    if (!isRecording) {
        return 1;
    }

    const progress = goalMs <= 0 ? 0 : Math.min(Math.max(elapsedTime / goalMs, 0), 1);

    if (progress < 0.2) return 0;
    if (progress < 0.5) return 1;
    if (progress < 0.8) return 2;
    return 3;
}
