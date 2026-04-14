import { useCallback, useEffect, useRef, useState } from 'react';
import {
  EXTEMPORE_COACH_PROMPT_TYPES,
  EXTEMPORE_COACH_STATES,
  buildExtemporeEmergencyResetPrompt,
  buildExtemporeSessionSummary,
  evaluateExtemporeCoachSignals,
  loadExtemporeCoachPreferences,
  normalizeExtemporeCoachPreferences,
  saveExtemporeCoachPreferences
} from '../utils/extemporeCoachEngine.js';

const COACH_STORAGE_KEY = 'extempore.coach.preferences';
const COACH_TICK_MS = 250;
const RECOVERING_MS = 1200;

function createEmptySessionSummary(topic = '') {
  return {
    topic,
    durationMs: 0,
    transcriptText: '',
    transcriptWordCount: 0,
    promptHistory: [],
    promptCount: 0,
    recoveryPromptCount: 0,
    pauseSegments: [],
    pauseCount: 0,
    longestPauseMs: 0,
    issueCounts: {
      opening: 0,
      pause: 0,
      drift: 0,
      ramble: 0,
      restart: 0,
      filler: 0
    },
    mostCommonIssueType: 'opening',
    fillerCount: 0,
    fluencyScore: null,
    overallSeverity: 'unknown',
    recommendedDrill: 'Practice a 90-second answer with deliberate pauses and one example.'
  };
}

function createPromptRecord(prompt, issueType, elapsedMs, silenceMs) {
  return {
    promptType: prompt.promptType,
    title: prompt.title,
    message: prompt.message,
    starter: prompt.starter,
    example: prompt.example,
    nextStep: prompt.nextStep,
    confidence: prompt.confidence,
    issueType,
    elapsedMs,
    silenceMs,
    shownAt: Date.now()
  };
}

export function useExtemporeCoach({
  topic = '',
  isRecording = false,
  isSpeaking = false,
  audioLevel = 0,
  duration = 0,
  transcriptText = '',
  volumeHistory = [],
  generateCoachSuggestion = null
} = {}) {
  const [preferences, setPreferences] = useState(() => loadExtemporeCoachPreferences(COACH_STORAGE_KEY));
  const [coachState, setCoachState] = useState(EXTEMPORE_COACH_STATES.THINKING);
  const [currentPrompt, setCurrentPrompt] = useState(null);
  const [promptHistory, setPromptHistory] = useState([]);
  const [pauseSegments, setPauseSegments] = useState([]);
  const [silenceMs, setSilenceMs] = useState(0);
  const [sessionSummary, setSessionSummary] = useState(() => createEmptySessionSummary(topic));
  const [manualResetCount, setManualResetCount] = useState(0);
  const [planningDraft, setPlanningDraft] = useState({
    mainPoint: '',
    example: '',
    closing: ''
  });

  const latestSignalsRef = useRef({
    topic,
    isRecording,
    isSpeaking,
    audioLevel,
    duration,
    transcriptText,
    volumeHistory,
    preferences
  });
  const isSessionActiveRef = useRef(false);
  const hasSpokenRef = useRef(false);
  const silenceStartRef = useRef(null);
  const lastPromptAtRef = useRef(0);
  const lastPromptTypeRef = useRef('');
  const lastPromptSignatureRef = useRef('');
  const recoveryUntilRef = useRef(0);
  const promptHistoryRef = useRef([]);
  const pauseSegmentsRef = useRef([]);

  useEffect(() => {
    latestSignalsRef.current = {
      topic,
      isRecording,
      isSpeaking,
      audioLevel,
      duration,
      transcriptText,
      volumeHistory,
      preferences
    };
  }, [audioLevel, duration, isRecording, isSpeaking, preferences, topic, transcriptText, volumeHistory]);

  useEffect(() => {
    saveExtemporeCoachPreferences(preferences, COACH_STORAGE_KEY);
  }, [preferences]);

  const resetLiveSession = useCallback(() => {
    setCoachState(EXTEMPORE_COACH_STATES.THINKING);
    setCurrentPrompt(null);
    setPromptHistory([]);
    setPauseSegments([]);
    setSilenceMs(0);
    setSessionSummary(createEmptySessionSummary(topic));
    setManualResetCount(0);
    setPlanningDraft({
      mainPoint: '',
      example: '',
      closing: ''
    });
    hasSpokenRef.current = false;
    silenceStartRef.current = null;
    lastPromptAtRef.current = 0;
    lastPromptTypeRef.current = '';
    lastPromptSignatureRef.current = '';
    recoveryUntilRef.current = 0;
    promptHistoryRef.current = [];
    pauseSegmentsRef.current = [];
  }, [topic]);

  const setPreference = useCallback((key, value) => {
    setPreferences((current) => normalizeExtemporeCoachPreferences({
      ...current,
      [key]: value
    }));
  }, []);

  const toggleBeginnerMode = useCallback(() => {
    setPreferences((current) => normalizeExtemporeCoachPreferences({
      ...current,
      beginnerMode: !current.beginnerMode
    }));
  }, []);

  const setPromptDensity = useCallback((promptDensity) => {
    setPreferences((current) => normalizeExtemporeCoachPreferences({
      ...current,
      promptDensity
    }));
  }, []);

  const setHelpStyle = useCallback((helpStyle) => {
    setPreferences((current) => normalizeExtemporeCoachPreferences({
      ...current,
      helpStyle
    }));
  }, []);

  const clearCurrentPrompt = useCallback(() => {
    setCurrentPrompt(null);
  }, []);

  const recordPauseSegment = useCallback((start, end) => {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return;
    }

    const segment = {
      start,
      end,
      duration: end - start
    };

    pauseSegmentsRef.current = [...pauseSegmentsRef.current, segment];
    setPauseSegments([...pauseSegmentsRef.current]);
  }, []);

  const maybeShowPrompt = useCallback((signal, analysis) => {
    const nextPrompt = analysis.prompt;

    if (!analysis.shouldPrompt || !nextPrompt) {
      if (analysis.coachState) {
        setCoachState((current) => {
          if (current === EXTEMPORE_COACH_STATES.RECOVERING && Date.now() < recoveryUntilRef.current) {
            return EXTEMPORE_COACH_STATES.RECOVERING;
          }

          return analysis.coachState;
        });
      }

      return;
    }

    const promptRecord = createPromptRecord(nextPrompt, analysis.issueType, signal.duration, analysis.silenceMs);
    const nextSignature = nextPrompt.signature;

    if (nextSignature && nextSignature === lastPromptSignatureRef.current) {
      return;
    }

    lastPromptSignatureRef.current = nextSignature;
    lastPromptAtRef.current = promptRecord.shownAt;
    lastPromptTypeRef.current = promptRecord.promptType;
    promptHistoryRef.current = [...promptHistoryRef.current, promptRecord];
    setPromptHistory([...promptHistoryRef.current]);
    setCurrentPrompt(promptRecord);
    setCoachState(analysis.coachState);
  }, []);

  useEffect(() => {
    if (!isRecording) {
      isSessionActiveRef.current = false;
      silenceStartRef.current = null;
      const resetTimer = window.setTimeout(() => {
        setSilenceMs(0);
        setCoachState((current) => (current === EXTEMPORE_COACH_STATES.RECOVERING ? EXTEMPORE_COACH_STATES.PAUSED : EXTEMPORE_COACH_STATES.THINKING));
      }, 0);

      return () => window.clearTimeout(resetTimer);
    }

    if (!isSessionActiveRef.current) {
      isSessionActiveRef.current = true;
      const primeTimer = window.setTimeout(() => {
        resetLiveSession();
      }, 0);

      return () => window.clearTimeout(primeTimer);
    }

    const tick = window.setInterval(() => {
      const signal = latestSignalsRef.current;
      const now = Date.now();

      if (signal.isSpeaking) {
        hasSpokenRef.current = true;

        if (silenceStartRef.current !== null) {
          recordPauseSegment(silenceStartRef.current, now);
          silenceStartRef.current = null;
        }

        setSilenceMs(0);
        setCoachState((current) => {
          if (currentPrompt && now < recoveryUntilRef.current) {
            return EXTEMPORE_COACH_STATES.RECOVERING;
          }

          if (current === EXTEMPORE_COACH_STATES.RECOVERING && now >= recoveryUntilRef.current) {
            return EXTEMPORE_COACH_STATES.SPEAKING;
          }

          return EXTEMPORE_COACH_STATES.SPEAKING;
        });
        return;
      }

      if (silenceStartRef.current === null) {
        silenceStartRef.current = now;
      }

      const currentSilence = now - silenceStartRef.current;
      setSilenceMs(currentSilence);

      const analysis = evaluateExtemporeCoachSignals({
        topic: signal.topic,
        isRecording: signal.isRecording,
        isSpeaking: signal.isSpeaking,
        elapsedMs: signal.duration,
        silenceMs: currentSilence,
        transcriptText: signal.transcriptText,
        fillerCount: 0,
        restartCount: manualResetCount,
        promptHistory: promptHistoryRef.current,
        lastPromptAt: lastPromptAtRef.current,
        lastPromptType: lastPromptTypeRef.current,
        beginnerMode: signal.preferences.beginnerMode,
        promptDensity: signal.preferences.promptDensity,
        helpStyle: signal.preferences.helpStyle,
        hasSpoken: hasSpokenRef.current
      });

      maybeShowPrompt(signal, analysis);

      if (analysis.prompt && analysis.prompt.promptType !== EXTEMPORE_COACH_PROMPT_TYPES.START_HERE) {
        recoveryUntilRef.current = now + RECOVERING_MS;
      }
    }, COACH_TICK_MS);

    return () => window.clearInterval(tick);
  }, [currentPrompt, isRecording, manualResetCount, maybeShowPrompt, recordPauseSegment, resetLiveSession]);

  const markManualReset = useCallback(() => {
    setManualResetCount((count) => count + 1);
    const prompt = buildExtemporeEmergencyResetPrompt({
      topic,
      helpStyle: preferences.helpStyle
    });
    const now = Date.now();
    const promptRecord = createPromptRecord(prompt, 'restart', duration, silenceMs);

    lastPromptSignatureRef.current = prompt.signature;
    lastPromptAtRef.current = now;
    lastPromptTypeRef.current = prompt.promptType;
    promptHistoryRef.current = [...promptHistoryRef.current, promptRecord];
    setPromptHistory([...promptHistoryRef.current]);
    setCurrentPrompt(promptRecord);
    setCoachState(EXTEMPORE_COACH_STATES.STUCK);
    recoveryUntilRef.current = now + RECOVERING_MS;
    return promptRecord;
  }, [duration, preferences.helpStyle, silenceMs, topic]);

  const finalizeSession = useCallback(async ({
    transcriptText: finalTranscriptText = '',
    transcriptAnalysis = null,
    volumeHistory: finalVolumeHistory = [],
    durationMs = duration
  } = {}) => {
    const localSummary = buildExtemporeSessionSummary({
      topic,
      durationMs,
      promptHistory: promptHistoryRef.current,
      pauseSegments: pauseSegmentsRef.current,
      transcriptText: finalTranscriptText,
      transcriptAnalysis,
      volumeHistory: finalVolumeHistory
    });

    let nextSummary = localSummary;

    if (typeof generateCoachSuggestion === 'function') {
      try {
        const modelSuggestion = await generateCoachSuggestion({
          topic,
          transcriptText: finalTranscriptText,
          pauseStats: {
            longestPauseMs: localSummary.longestPauseMs,
            pauseCount: localSummary.pauseCount
          },
          fillerStats: {
            fillerCount: localSummary.fillerCount
          },
          currentState: localSummary.mostCommonIssueType,
          issueCounts: localSummary.issueCounts
        });

        if (modelSuggestion?.recommendedDrill) {
          nextSummary = {
            ...localSummary,
            recommendedDrill: modelSuggestion.recommendedDrill,
            modelSuggestion
          };
        } else if (modelSuggestion) {
          nextSummary = {
            ...localSummary,
            modelSuggestion
          };
        }
      } catch (error) {
        console.warn('Extempore coaching suggestion failed:', error);
      }
    }

    setSessionSummary(nextSummary);
    return nextSummary;
  }, [duration, generateCoachSuggestion, topic]);

  return {
    preferences,
    setPreference,
    toggleBeginnerMode,
    setPromptDensity,
    setHelpStyle,
    planningDraft,
    setPlanningDraft,
    coachState,
    currentPrompt,
    promptHistory,
    pauseSegments,
    silenceMs,
    sessionSummary,
    markManualReset,
    clearCurrentPrompt,
    finalizeSession,
    resetLiveSession
  };
}

export default useExtemporeCoach;
