export const EXTEMPORE_COACH_STATES = Object.freeze({
  THINKING: 'thinking',
  SPEAKING: 'speaking',
  PAUSED: 'paused',
  STUCK: 'stuck',
  RECOVERING: 'recovering'
});

export const EXTEMPORE_COACH_PROMPT_TYPES = Object.freeze({
  START_HERE: 'start_here',
  BRIDGE: 'bridge',
  RETURN_TO_POINT: 'return_to_point',
  CLOSE_THOUGHT: 'close_this_thought',
  RESET: 'reset'
});

export const EXTEMPORE_COACH_HELP_STYLES = Object.freeze({
  STARTERS: 'starters',
  EXAMPLES: 'examples',
  BOTH: 'both'
});

export const EXTEMPORE_COACH_PROMPT_DENSITIES = Object.freeze({
  LIGHT: 'light',
  BALANCED: 'balanced',
  ACTIVE: 'active'
});

export const DEFAULT_EXTEMPORE_COACH_PREFERENCES = Object.freeze({
  beginnerMode: true,
  promptDensity: EXTEMPORE_COACH_PROMPT_DENSITIES.BALANCED,
  helpStyle: EXTEMPORE_COACH_HELP_STYLES.BOTH
});

const DEFAULT_PROMPT_GAPS = Object.freeze({
  [EXTEMPORE_COACH_PROMPT_DENSITIES.LIGHT]: {
    starter: 2400,
    bridge: 4200,
    close: 7600,
    repeat: 9500,
    sameType: 12000
  },
  [EXTEMPORE_COACH_PROMPT_DENSITIES.BALANCED]: {
    starter: 1800,
    bridge: 3000,
    close: 5600,
    repeat: 8000,
    sameType: 10000
  },
  [EXTEMPORE_COACH_PROMPT_DENSITIES.ACTIVE]: {
    starter: 1400,
    bridge: 2200,
    close: 4200,
    repeat: 6200,
    sameType: 8000
  }
});

const FILLER_WORDS = [
  'um',
  'uh',
  'like',
  'you know',
  'kind of',
  'sort of',
  'maybe',
  'i guess',
  'probably',
  'actually'
];

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeLowerText(value) {
  return normalizeText(value).toLowerCase();
}

export function normalizeExtemporeCoachPreferences(input = {}) {
  return {
    beginnerMode: Boolean(input.beginnerMode ?? DEFAULT_EXTEMPORE_COACH_PREFERENCES.beginnerMode),
    promptDensity: Object.values(EXTEMPORE_COACH_PROMPT_DENSITIES).includes(input.promptDensity)
      ? input.promptDensity
      : DEFAULT_EXTEMPORE_COACH_PREFERENCES.promptDensity,
    helpStyle: Object.values(EXTEMPORE_COACH_HELP_STYLES).includes(input.helpStyle)
      ? input.helpStyle
      : DEFAULT_EXTEMPORE_COACH_PREFERENCES.helpStyle
  };
}

export function loadExtemporeCoachPreferences(storageKey = 'extempore.coach.preferences') {
  if (typeof window === 'undefined') {
    return normalizeExtemporeCoachPreferences();
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return normalizeExtemporeCoachPreferences();
    }

    return normalizeExtemporeCoachPreferences(JSON.parse(raw));
  } catch {
    return normalizeExtemporeCoachPreferences();
  }
}

export function saveExtemporeCoachPreferences(preferences, storageKey = 'extempore.coach.preferences') {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(normalizeExtemporeCoachPreferences(preferences)));
  } catch {
    // ignore persistence failures
  }
}

export function countExtemporeFillers(transcriptText = '') {
  const text = normalizeLowerText(transcriptText);

  if (!text) {
    return 0;
  }

  return FILLER_WORDS.reduce((total, filler) => {
    if (!filler.includes(' ')) {
      const pattern = new RegExp(`\\b${filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      const matches = text.match(pattern);
      return total + (matches ? matches.length : 0);
    }

    const pattern = new RegExp(filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = text.match(pattern);
    return total + (matches ? matches.length : 0);
  }, 0);
}

export function countWords(text = '') {
  return normalizeText(text).split(/\s+/).filter(Boolean).length;
}

export function summarizePauseHistory(volumeHistory = [], silenceThreshold = 14) {
  if (!Array.isArray(volumeHistory) || volumeHistory.length === 0) {
    return {
      pauseSegments: [],
      longestPauseMs: 0,
      pauseCount: 0
    };
  }

  const ordered = volumeHistory
    .map((sample) => ({
      timestamp: Number(sample?.timestamp) || 0,
      level: Number(sample?.level) || 0
    }))
    .filter((sample) => sample.timestamp > 0)
    .sort((left, right) => left.timestamp - right.timestamp);

  if (ordered.length === 0) {
    return {
      pauseSegments: [],
      longestPauseMs: 0,
      pauseCount: 0
    };
  }

  const pauseSegments = [];
  let activePause = null;

  for (const sample of ordered) {
    const isSilent = sample.level <= silenceThreshold;

    if (isSilent && !activePause) {
      activePause = {
        start: sample.timestamp,
        end: sample.timestamp,
        duration: 0
      };
    }

    if (isSilent && activePause) {
      activePause.end = sample.timestamp;
      activePause.duration = Math.max(activePause.duration, sample.timestamp - activePause.start);
      continue;
    }

    if (!isSilent && activePause) {
      pauseSegments.push({
        ...activePause,
        duration: Math.max(activePause.duration, activePause.end - activePause.start)
      });
      activePause = null;
    }
  }

  if (activePause) {
    pauseSegments.push({
      ...activePause,
      duration: Math.max(activePause.duration, activePause.end - activePause.start)
    });
  }

  const longestPauseMs = pauseSegments.reduce((max, pause) => Math.max(max, pause.duration), 0);

  return {
    pauseSegments,
    longestPauseMs,
    pauseCount: pauseSegments.length
  };
}

function resolveThresholds(promptDensity = EXTEMPORE_COACH_PROMPT_DENSITIES.BALANCED) {
  return DEFAULT_PROMPT_GAPS[promptDensity] || DEFAULT_PROMPT_GAPS[EXTEMPORE_COACH_PROMPT_DENSITIES.BALANCED];
}

function buildPromptCopy(promptType, { topic = '' } = {}) {
  const topicLabel = normalizeText(topic);
  const topicLine = topicLabel ? ` about ${topicLabel}` : '';

  switch (promptType) {
    case EXTEMPORE_COACH_PROMPT_TYPES.START_HERE:
      return {
        title: 'Start here',
        message: `Open with one clear sentence${topicLine}.`,
        starter: topicLabel ? `The main point about ${topicLabel} is...` : 'The main point is...',
        example: topicLabel ? `For example, ${topicLabel} affects people because...` : 'For example, this matters because...',
        nextStep: 'Give one reason, then stop.',
        confidence: 0.82
      };
    case EXTEMPORE_COACH_PROMPT_TYPES.BRIDGE:
      return {
        title: 'Bridge',
        message: 'Use a bridge phrase and move to the next sentence.',
        starter: 'What I mean is...',
        example: 'That connects because...',
        nextStep: 'Add one example or reason.',
        confidence: 0.8
      };
    case EXTEMPORE_COACH_PROMPT_TYPES.RETURN_TO_POINT:
      return {
        title: 'Return to point',
        message: 'Come back to the main point and finish it cleanly.',
        starter: 'The main point is...',
        example: topicLabel ? `So, when it comes to ${topicLabel}, the answer is...` : 'So, the answer is...',
        nextStep: 'Finish with one concrete example.',
        confidence: 0.86
      };
    case EXTEMPORE_COACH_PROMPT_TYPES.CLOSE_THOUGHT:
      return {
        title: 'Close this thought',
        message: 'Wrap the current idea and stop before starting a new one.',
        starter: 'So the conclusion is...',
        example: 'That is why this matters.',
        nextStep: 'Say the ending sentence now.',
        confidence: 0.9
      };
    case EXTEMPORE_COACH_PROMPT_TYPES.RESET:
    default:
      return {
        title: 'Reset',
        message: 'Take one breath and restart with a clean sentence.',
        starter: 'Let me put this simply...',
        example: 'The simplest answer is...',
        nextStep: 'Restart from one clear point.',
        confidence: 0.88
      };
  }
}

function formatPromptDetails(copy, helpStyle) {
  const details = [];

  if (helpStyle === EXTEMPORE_COACH_HELP_STYLES.STARTERS) {
    details.push(copy.starter);
  } else if (helpStyle === EXTEMPORE_COACH_HELP_STYLES.EXAMPLES) {
    details.push(copy.starter);
    details.push(copy.example);
  } else {
    details.push(copy.starter);
    details.push(copy.example);
    details.push(copy.nextStep);
  }

  return details.filter(Boolean);
}

function buildPromptSignature(promptType, issueType, topic) {
  return [promptType, issueType, normalizeLowerText(topic)].join('|');
}

function determineIssueType({
  hasSpoken,
  silenceMs,
  fillerCount,
  restartCount,
  transcriptText,
  thresholds
}) {
  if (!hasSpoken) {
    return 'opening';
  }

  if (restartCount >= 2) {
    return 'restart';
  }

  if (countWords(transcriptText) >= 18 && silenceMs >= thresholds.close) {
    return 'ramble';
  }

  if (fillerCount >= 4) {
    return 'filler';
  }

  if (silenceMs >= thresholds.repeat) {
    return 'drift';
  }

  if (silenceMs >= thresholds.bridge) {
    return 'pause';
  }

  return 'thinking';
}

function resolvePromptType(issueType, hasSpoken, silenceMs, thresholds) {
  if (!hasSpoken) {
    return silenceMs >= thresholds.starter ? EXTEMPORE_COACH_PROMPT_TYPES.START_HERE : null;
  }

  switch (issueType) {
    case 'restart':
    case 'filler':
      return EXTEMPORE_COACH_PROMPT_TYPES.RETURN_TO_POINT;
    case 'ramble':
      return EXTEMPORE_COACH_PROMPT_TYPES.CLOSE_THOUGHT;
    case 'drift':
      return EXTEMPORE_COACH_PROMPT_TYPES.RETURN_TO_POINT;
    case 'pause':
      return EXTEMPORE_COACH_PROMPT_TYPES.BRIDGE;
    default:
      if (silenceMs >= thresholds.close) {
        return EXTEMPORE_COACH_PROMPT_TYPES.CLOSE_THOUGHT;
      }

      if (silenceMs >= thresholds.bridge) {
        return EXTEMPORE_COACH_PROMPT_TYPES.BRIDGE;
      }

      return null;
  }
}

function isPromptSuppressed({
  now,
  promptType,
  lastPromptAt,
  lastPromptType,
  promptHistory = [],
  thresholds,
  beginnerMode
}) {
  if (!promptType) {
    return true;
  }

  const latestPrompt = promptHistory[promptHistory.length - 1];
  const latestPromptType = latestPrompt?.promptType || lastPromptType;
  const latestPromptAt = Number(latestPrompt?.shownAt || lastPromptAt) || 0;
  const elapsedSincePrompt = latestPromptAt > 0 ? now - latestPromptAt : Number.POSITIVE_INFINITY;
  const sameTypeCooldown = beginnerMode ? thresholds.sameType : thresholds.sameType * 1.2;
  const generalCooldown = beginnerMode ? thresholds.bridge : thresholds.close;

  if (latestPromptType === promptType && elapsedSincePrompt < sameTypeCooldown) {
    return true;
  }

  if (elapsedSincePrompt < generalCooldown) {
    return true;
  }

  return false;
}

export function buildExtemporeCoachPrompt({
  topic = '',
  promptType = EXTEMPORE_COACH_PROMPT_TYPES.RESET,
  helpStyle = EXTEMPORE_COACH_HELP_STYLES.BOTH,
  issueType = 'restart'
} = {}) {
  const copy = buildPromptCopy(promptType, { topic, helpStyle });

  return {
    promptType,
    issueType,
    title: copy.title,
    message: copy.message,
    starter: copy.starter,
    example: copy.example,
    nextStep: copy.nextStep,
    confidence: copy.confidence,
    details: formatPromptDetails(copy, helpStyle),
    signature: buildPromptSignature(promptType, issueType, topic)
  };
}

export function buildExtemporeEmergencyResetPrompt(options = {}) {
  return buildExtemporeCoachPrompt({
    ...options,
    promptType: EXTEMPORE_COACH_PROMPT_TYPES.RESET,
    issueType: 'restart'
  });
}

export function evaluateExtemporeCoachSignals({
  topic = '',
  isRecording = false,
  isSpeaking = false,
  silenceMs = 0,
  transcriptText = '',
  fillerCount = 0,
  restartCount = 0,
  promptHistory = [],
  lastPromptAt = 0,
  lastPromptType = '',
  beginnerMode = DEFAULT_EXTEMPORE_COACH_PREFERENCES.beginnerMode,
  promptDensity = DEFAULT_EXTEMPORE_COACH_PREFERENCES.promptDensity,
  helpStyle = DEFAULT_EXTEMPORE_COACH_PREFERENCES.helpStyle,
  hasSpoken = false
} = {}) {
  const thresholds = resolveThresholds(promptDensity);
  const normalizedHelpStyle = Object.values(EXTEMPORE_COACH_HELP_STYLES).includes(helpStyle)
    ? helpStyle
    : DEFAULT_EXTEMPORE_COACH_PREFERENCES.helpStyle;
  const normalizedTranscriptText = normalizeText(transcriptText);
  const resolvedFillerCount = Number.isFinite(Number(fillerCount)) && Number(fillerCount) > 0
    ? Number(fillerCount)
    : countExtemporeFillers(normalizedTranscriptText);

  if (!isRecording) {
    return {
      coachState: EXTEMPORE_COACH_STATES.THINKING,
      prompt: null,
      shouldPrompt: false,
      issueType: 'idle',
      silenceMs: 0,
      confidence: 0
    };
  }

  if (isSpeaking) {
    return {
      coachState: hasSpoken ? EXTEMPORE_COACH_STATES.SPEAKING : EXTEMPORE_COACH_STATES.THINKING,
      prompt: null,
      shouldPrompt: false,
      issueType: hasSpoken ? 'speaking' : 'opening',
      silenceMs: 0,
      confidence: 1
    };
  }

  const issueType = determineIssueType({
    hasSpoken,
    silenceMs,
    fillerCount: resolvedFillerCount,
    restartCount,
    transcriptText: normalizedTranscriptText,
    thresholds
  });
  const promptType = resolvePromptType(issueType, hasSpoken, silenceMs, thresholds);
  const now = Date.now();

  if (isPromptSuppressed({
    now,
    promptType,
    lastPromptAt,
    lastPromptType,
    promptHistory,
    thresholds,
    beginnerMode
  })) {
    return {
      coachState: issueType === 'drift' || issueType === 'ramble' ? EXTEMPORE_COACH_STATES.STUCK : EXTEMPORE_COACH_STATES.PAUSED,
      prompt: null,
      shouldPrompt: false,
      issueType,
      silenceMs,
      confidence: promptType ? 0.45 : 0
    };
  }

  if (!promptType) {
    return {
      coachState: issueType === 'thinking' ? EXTEMPORE_COACH_STATES.THINKING : EXTEMPORE_COACH_STATES.PAUSED,
      prompt: null,
      shouldPrompt: false,
      issueType,
      silenceMs,
      confidence: 0.25
    };
  }

  const prompt = buildExtemporeCoachPrompt({
    topic,
    promptType,
    helpStyle: normalizedHelpStyle,
    issueType
  });

  return {
    coachState: promptType === EXTEMPORE_COACH_PROMPT_TYPES.CLOSE_THOUGHT
      ? EXTEMPORE_COACH_STATES.STUCK
      : EXTEMPORE_COACH_STATES.PAUSED,
    prompt,
    shouldPrompt: true,
    issueType,
    silenceMs,
    confidence: prompt.confidence
  };
}

function countPromptTypes(promptHistory = []) {
  return promptHistory.reduce((counts, item) => {
    const key = item?.issueType || item?.promptType || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function pickMostCommonIssueType(issueCounts = {}) {
  const entries = Object.entries(issueCounts);

  if (entries.length === 0) {
    return 'opening';
  }

  return entries.sort((left, right) => right[1] - left[1])[0][0];
}

function recommendDrillFromSummary({
  mostCommonIssueType = 'opening',
  longestPauseMs = 0,
  promptCount = 0,
  recoveryPromptCount = 0,
  fluencyScore = null,
  overallSeverity = 'unknown',
  fillerCount = 0
} = {}) {
  if (mostCommonIssueType === 'opening') {
    return 'Practice 5 openings: one clear sentence, one reason, one pause.';
  }

  if (mostCommonIssueType === 'restart') {
    return 'Practice clean restarts using "Let me put this simply..." as your reset line.';
  }

  if (mostCommonIssueType === 'filler' || fillerCount >= 4) {
    return 'Practice replacing filler words with a short pause before your next sentence.';
  }

  if (mostCommonIssueType === 'ramble' || longestPauseMs >= 7000) {
    return 'Practice one-point answers: point, reason, example, then stop.';
  }

  if (mostCommonIssueType === 'drift' || promptCount > 4 || recoveryPromptCount > 2) {
    return 'Practice coming back to the main point after every example.';
  }

  if (typeof fluencyScore === 'number' && fluencyScore < 70) {
    return 'Practice 60-second answers with one pause every two sentences.';
  }

  if (overallSeverity === 'significant') {
    return 'Practice shorter answers and end each thought before starting the next one.';
  }

  return 'Practice a 90-second answer with deliberate pauses and one example.';
}

export function buildExtemporeSessionSummary({
  topic = '',
  durationMs = 0,
  promptHistory = [],
  pauseSegments = [],
  transcriptText = '',
  transcriptAnalysis = null,
  volumeHistory = []
} = {}) {
  const normalizedTranscript = normalizeText(transcriptText);
  const derivedPromptCounts = countPromptTypes(promptHistory);
  const transcriptIssueCounts = transcriptAnalysis?.issueCounts || {};
  const issueCounts = {
    opening: derivedPromptCounts.opening || 0,
    pause: derivedPromptCounts.pause || 0,
    drift: derivedPromptCounts.drift || 0,
    ramble: derivedPromptCounts.ramble || 0,
    restart: derivedPromptCounts.restart || 0,
    filler: derivedPromptCounts.filler || 0,
    ...transcriptIssueCounts
  };

  const silentSummary = summarizePauseHistory(volumeHistory);
  const allPauseSegments = pauseSegments.length > 0 ? pauseSegments : silentSummary.pauseSegments;
  const longestPauseMs = Math.max(
    silentSummary.longestPauseMs,
    allPauseSegments.reduce((max, pause) => Math.max(max, Number(pause?.duration) || 0), 0)
  );

  const promptCount = promptHistory.length;
  const recoveryPromptCount = promptHistory.filter((item) => item?.promptType !== EXTEMPORE_COACH_PROMPT_TYPES.START_HERE).length;
  const fillerCount = countExtemporeFillers(normalizedTranscript);
  const transcriptWordCount = countWords(normalizedTranscript);
  const mostCommonIssueType = Object.keys(transcriptIssueCounts).length > 0
    ? pickMostCommonIssueType(transcriptIssueCounts)
    : pickMostCommonIssueType(issueCounts);
  const fluencyScore = typeof transcriptAnalysis?.fluencyScore === 'number'
    ? transcriptAnalysis.fluencyScore
    : null;
  const overallSeverity = transcriptAnalysis?.overallSeverity || 'unknown';

  return {
    topic,
    durationMs,
    transcriptText: normalizedTranscript,
    transcriptWordCount,
    promptHistory,
    promptCount,
    recoveryPromptCount,
    pauseSegments: allPauseSegments,
    pauseCount: allPauseSegments.length,
    longestPauseMs,
    issueCounts,
    mostCommonIssueType,
    fillerCount,
    fluencyScore,
    overallSeverity,
    recommendedDrill: recommendDrillFromSummary({
      mostCommonIssueType,
      longestPauseMs,
      promptCount,
      recoveryPromptCount,
      fluencyScore,
      overallSeverity,
      fillerCount
    })
  };
}

export function formatExtemporeCoachStateLabel(state) {
  switch (state) {
    case EXTEMPORE_COACH_STATES.SPEAKING:
      return 'speaking';
    case EXTEMPORE_COACH_STATES.PAUSED:
      return 'paused';
    case EXTEMPORE_COACH_STATES.STUCK:
      return 'stuck';
    case EXTEMPORE_COACH_STATES.RECOVERING:
      return 'recovering';
    case EXTEMPORE_COACH_STATES.THINKING:
    default:
      return 'thinking';
  }
}
