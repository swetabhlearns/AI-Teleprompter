import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowsLeftRight,
  CaretDown,
  CheckCircle,
  Eye,
  EyeSlash,
  Lightbulb,
  Microphone,
  Target,
  Stop
} from '@phosphor-icons/react';
import { formatDuration } from '../utils/formatters';
import { generateStutteringSummary } from '../utils/stutteringAnalyzer';
import { useSarvamTTS } from '../hooks/useSarvamTTS';
import { useExtemporeCoach } from '../hooks/useExtemporeCoach';
import { useExtemporeSpeechTranscript } from '../hooks/useExtemporeSpeechTranscript';
import {
  buildRollingDeck,
  getSelectionPhaseCopy,
  EXTEMPORE_CENTER_INDEX,
  EXTEMPORE_LOCK_CONFIRM_MS,
  EXTEMPORE_SPIN_STEP_MS,
  EXTEMPORE_SPIN_SETTLE_MS,
  EXTEMPORE_VISIBLE_ROWS
} from '../utils/extemporeFlow';
import {
  EXTEMPORE_COACH_HELP_STYLES,
  EXTEMPORE_COACH_PROMPT_DENSITIES,
  EXTEMPORE_COACH_STATES
} from '../utils/extemporeCoachEngine';
import { OatButton } from './ui/OatComponents';

const EXT_STATES = {
  TOPIC_SELECTION: 'topic_selection',
  PRACTICE: 'practice',
  REVIEW: 'review',
  PROCESSING: 'processing'
};

const SELECTION_PHASES = {
  IDLE: 'idle',
  RANDOMIZING: 'randomizing',
  LOCKING: 'locking',
  LOCKED: 'locked'
};

const ROW_HEIGHT = 84;
const LOCK_RELEASE_MS = EXTEMPORE_LOCK_CONFIRM_MS;
const COACH_STATE_LABELS = {
  [EXTEMPORE_COACH_STATES.THINKING]: 'thinking',
  [EXTEMPORE_COACH_STATES.SPEAKING]: 'speaking',
  [EXTEMPORE_COACH_STATES.PAUSED]: 'paused',
  [EXTEMPORE_COACH_STATES.STUCK]: 'stuck',
  [EXTEMPORE_COACH_STATES.RECOVERING]: 'recovering'
};

const PROMPT_DENSITY_LABELS = {
  [EXTEMPORE_COACH_PROMPT_DENSITIES.LIGHT]: 'Light',
  [EXTEMPORE_COACH_PROMPT_DENSITIES.BALANCED]: 'Balanced',
  [EXTEMPORE_COACH_PROMPT_DENSITIES.ACTIVE]: 'High'
};

const HELP_STYLE_LABELS = {
  [EXTEMPORE_COACH_HELP_STYLES.STARTERS]: 'Starters',
  [EXTEMPORE_COACH_HELP_STYLES.EXAMPLES]: 'Examples',
  [EXTEMPORE_COACH_HELP_STYLES.BOTH]: 'Both'
};

function MicIcon({ className = '' }) {
  return <Microphone className={className} size={16} weight="fill" aria-hidden="true" />;
}

function StopIcon({ className = '' }) {
  return <Stop className={className} size={16} weight="fill" aria-hidden="true" />;
}

function SwapIcon({ className = '' }) {
  return <ArrowsLeftRight className={className} size={20} weight="bold" aria-hidden="true" />;
}

function ChevronDownIcon({ className = '' }) {
  return <CaretDown className={className} size={20} weight="bold" aria-hidden="true" />;
}

function EyeIcon({ className = '' }) {
  return <Eye className={className} size={18} weight="duotone" aria-hidden="true" />;
}

function EyeOffIcon({ className = '' }) {
  return <EyeSlash className={className} size={18} weight="duotone" aria-hidden="true" />;
}

function PrepIcon({ type, className = '' }) {
  const iconProps = { className, size: 20, weight: 'duotone' };

  if (type === 'point') {
    return <Target {...iconProps} aria-hidden="true" />;
  }

  if (type === 'reason') {
    return <CheckCircle {...iconProps} aria-hidden="true" />;
  }

  if (type === 'example') {
    return <Lightbulb {...iconProps} aria-hidden="true" />;
  }

  return <CheckCircle {...iconProps} aria-hidden="true" />;
}

const PREP_METHOD = [
  {
    title: 'Point',
    icon: 'point',
    content: 'Say the main idea in one sentence before you add anything else.'
  },
  {
    title: 'Reason',
    icon: 'reason',
    content: 'Give the reason immediately after the point so the thought stays connected.'
  },
  {
    title: 'Example',
    icon: 'example',
    content: 'Add one concrete example, then stop and let the point land.'
  },
  {
    title: 'Close',
    icon: 'close',
    content: 'Finish the thought with a clean ending sentence.'
  }
];

function PREPAccordion({ items }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="prep-accordion w-full space-y-4">
      {items.map((item, index) => {
        const isOpen = openIndex === index;

        return (
          <div key={item.title} className={`prep-accordion-item overflow-hidden ${isOpen ? 'is-open' : ''}`}>
            <button
              onClick={() => setOpenIndex(isOpen ? -1 : index)}
              className="prep-accordion-trigger flex w-full items-center justify-between px-5 py-4 text-left outline-none sm:px-6 sm:py-5"
              type="button"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`prep-accordion-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isOpen ? 'is-open' : ''}`}>
                  <PrepIcon type={item.icon} className="h-5 w-5" />
                </div>
                <span className="font-display text-[1.35rem] font-semibold leading-none text-text">{item.title}</span>
              </div>
              <ChevronDownIcon className={`prep-accordion-chevron h-5 w-5 text-on-surface-variant ${isOpen ? 'is-open' : ''}`} />
            </button>

            <div className={`prep-accordion-content grid ${isOpen ? 'is-open' : ''}`}>
              <div className="overflow-hidden">
                <div className="px-5 pb-5 pt-0 sm:px-6">
                  <div className="ml-3 border-l-2 border-primary/20 pl-5">
                    <p className="text-[14px] leading-relaxed text-on-surface-variant">{item.content}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StateChip({ state, muted = false }) {
  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${muted ? 'bg-surface-container-high text-on-surface-variant' : 'bg-primary/10 text-primary'}`}>
      {state}
    </span>
  );
}

function DensityChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-2 text-[12px] font-semibold transition ${active ? 'border-primary bg-primary text-white' : 'border-outline-variant bg-surface text-on-surface-variant hover:text-text'}`}
    >
      {label}
    </button>
  );
}

function CoachPromptCard({
  prompt,
  coachState,
  silenceMs,
  isRecording,
  beginnerMode,
  onResetThought
}) {
  const fallback = useMemo(() => {
    if (coachState === EXTEMPORE_COACH_STATES.STUCK) {
      return {
        title: 'Reset',
        message: 'Take one breath and restart with a clean sentence.',
        starter: 'Let me put this simply...',
        example: 'The simplest answer is...',
        nextStep: 'Restart from one clear point.'
      };
    }

    if (coachState === EXTEMPORE_COACH_STATES.RECOVERING) {
      return {
        title: 'Recovering',
        message: 'Keep going. You found the thread again.',
        starter: 'The main point is...',
        example: 'For example, ...',
        nextStep: 'Finish the sentence and stop.'
      };
    }

    if (!isRecording) {
      return {
        title: 'Ready',
        message: 'Plan one point, one example, and one closing line before you start.',
        starter: 'The main point is...',
        example: 'For example, ...',
        nextStep: 'Then stop after the closing line.'
      };
    }

    return {
      title: 'Thinking',
      message: silenceMs > 0 ? 'Pause, breathe, and pick the next sentence.' : 'Keep your next thought short and direct.',
      starter: 'What I mean is...',
      example: 'That matters because...',
      nextStep: 'Say only one sentence.'
    };
  }, [coachState, isRecording, silenceMs]);

  const source = prompt || fallback;
  const showExample = beginnerMode && source.example;

  return (
    <article className="rounded-[24px] border border-outline-variant bg-surface-container-low/90 p-5 shadow-[0_18px_48px_rgba(24,51,46,0.08)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">Live coach</p>
          <h3 className="mt-2 font-display text-[1.8rem] font-semibold tracking-[-0.04em] text-text">{source.title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StateChip state={COACH_STATE_LABELS[coachState] || coachState} />
          <StateChip state={beginnerMode ? 'beginner rescue' : 'minimal help'} muted />
        </div>
      </div>

      <p className="mt-4 text-[15px] leading-relaxed text-on-surface-variant">
        {source.message}
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[20px] border border-outline-variant bg-surface p-4">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Starter</p>
          <p className="mt-2 text-[16px] font-medium text-text">{source.starter}</p>
        </div>

        {showExample ? (
          <div className="rounded-[20px] border border-outline-variant bg-surface p-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Example</p>
            <p className="mt-2 text-[16px] font-medium text-text">{source.example}</p>
          </div>
        ) : (
          <div className="rounded-[20px] border border-dashed border-outline-variant bg-surface p-4">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Next step</p>
            <p className="mt-2 text-[16px] font-medium text-text">{source.nextStep}</p>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onResetThought}
          className="rounded-full border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-text transition hover:bg-surface-container-high"
        >
          Reset my thought
        </button>
      </div>
    </article>
  );
}

function PlanningStrip({ planningDraft, setPlanningDraft }) {
  return (
    <section className="rounded-[24px] border border-outline-variant bg-surface-container-low/90 p-5 shadow-[0_18px_48px_rgba(24,51,46,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">Pre-speech plan</p>
          <h3 className="mt-2 font-display text-[1.8rem] font-semibold tracking-[-0.04em] text-text">Build the next three sentences</h3>
        </div>
        <StateChip state="Before recording" muted />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-2 rounded-[20px] border border-outline-variant bg-surface p-4">
          <span className="text-[12px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant">One-line answer</span>
          <textarea
            value={planningDraft.mainPoint}
            onChange={(event) => setPlanningDraft((current) => ({ ...current, mainPoint: event.target.value }))}
            rows={3}
            placeholder="What is the main point?"
            className="min-h-[94px] resize-none rounded-[16px] border border-outline-variant bg-surface-container-low px-3 py-3 text-[15px] leading-relaxed text-text outline-none placeholder:text-on-surface-variant/60 focus:border-primary"
          />
        </label>

        <label className="flex flex-col gap-2 rounded-[20px] border border-outline-variant bg-surface p-4">
          <span className="text-[12px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant">One example</span>
          <textarea
            value={planningDraft.example}
            onChange={(event) => setPlanningDraft((current) => ({ ...current, example: event.target.value }))}
            rows={3}
            placeholder="What concrete example can you use?"
            className="min-h-[94px] resize-none rounded-[16px] border border-outline-variant bg-surface-container-low px-3 py-3 text-[15px] leading-relaxed text-text outline-none placeholder:text-on-surface-variant/60 focus:border-primary"
          />
        </label>

        <label className="flex flex-col gap-2 rounded-[20px] border border-outline-variant bg-surface p-4">
          <span className="text-[12px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant">One closing line</span>
          <textarea
            value={planningDraft.closing}
            onChange={(event) => setPlanningDraft((current) => ({ ...current, closing: event.target.value }))}
            rows={3}
            placeholder="How will you finish the thought?"
            className="min-h-[94px] resize-none rounded-[16px] border border-outline-variant bg-surface-container-low px-3 py-3 text-[15px] leading-relaxed text-text outline-none placeholder:text-on-surface-variant/60 focus:border-primary"
          />
        </label>
      </div>
    </section>
  );
}

function SessionSummaryPanel({ topic, summary }) {
  const longestPause = formatDuration(summary?.longestPauseMs || 0);
  const sessionLength = formatDuration(summary?.durationMs || 0);
  const issueLabel = summary?.mostCommonIssueType || 'opening';

  return (
    <section className="rounded-[24px] border border-outline-variant bg-surface-container-low/95 p-5 shadow-[0_18px_48px_rgba(24,51,46,0.08)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">Session summary</p>
          <h3 className="mt-2 font-display text-[1.9rem] font-semibold tracking-[-0.04em] text-text">What happened in this attempt</h3>
        </div>
        <StateChip state={summary?.overallSeverity || 'review'} muted />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Duration" value={sessionLength} />
        <MetricCard label="Longest pause" value={longestPause} />
        <MetricCard label="Recovery prompts" value={String(summary?.recoveryPromptCount || 0)} />
        <MetricCard label="Common issue" value={issueLabel.replace(/_/g, ' ')} />
      </div>

      <div className="mt-5 rounded-[22px] border border-outline-variant bg-surface p-5">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Recommended drill</p>
        <p className="mt-2 text-[16px] leading-relaxed text-text">{summary?.recommendedDrill || 'Practice a 90-second answer with deliberate pauses and one example.'}</p>
      </div>

      <div className="mt-5 rounded-[22px] border border-outline-variant bg-surface p-5">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">Topic</p>
        <p className="mt-2 text-[17px] italic text-text">"{topic || summary?.topic || 'Untitled topic'}"</p>
      </div>
    </section>
  );
}

function TranscriptCuePanel({
  transcriptText,
  interimTranscriptText,
  fragments,
  isSupported,
  isListening,
  error
}) {
  const recentFragments = fragments.slice(-3);
  const hasTranscript = Boolean(transcriptText || interimTranscriptText);

  return (
    <section className="rounded-[24px] border border-outline-variant bg-surface-container-low/90 p-5 shadow-[0_18px_48px_rgba(24,51,46,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">Live transcript</p>
          <h3 className="mt-2 font-display text-[1.8rem] font-semibold tracking-[-0.04em] text-text">What the coach hears</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <StateChip state={isSupported ? (isListening ? 'Listening' : 'Ready') : 'Unsupported'} muted />
        </div>
      </div>

      <div className="mt-5 rounded-[22px] border border-outline-variant bg-surface p-4">
        {hasTranscript ? (
          <>
            <p className="text-[15px] leading-relaxed text-text">{transcriptText || '...'}</p>
            {interimTranscriptText ? (
              <p className="mt-2 text-[14px] italic text-on-surface-variant">{interimTranscriptText}</p>
            ) : null}
          </>
        ) : (
          <p className="text-[15px] leading-relaxed text-on-surface-variant">
            {isSupported ? 'Start speaking and the transcript will appear here.' : 'Speech recognition is not available in this browser.'}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {recentFragments.map((fragment) => (
          <span key={`${fragment.index}-${fragment.text}`} className="rounded-full border border-outline-variant bg-surface px-3 py-1 text-[12px] text-on-surface-variant">
            {fragment.text}
          </span>
        ))}
      </div>

      {error ? (
        <p className="mt-4 text-[12px] text-warning">{error}</p>
      ) : (
        <p className="mt-4 text-[12px] text-on-surface-variant">
          Live transcript is browser-based. If it is unavailable, the app still falls back to the audio transcription at stop.
        </p>
      )}
    </section>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-[18px] border border-outline-variant bg-surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface-variant">{label}</p>
      <p className="mt-2 font-mono text-[1.15rem] font-semibold text-text">{value}</p>
    </div>
  );
}

function renderStateTitle(coachState, isRecording) {
  if (isRecording && coachState === EXTEMPORE_COACH_STATES.SPEAKING) {
    return 'Recording live';
  }

  if (coachState === EXTEMPORE_COACH_STATES.RECOVERING) {
    return 'Recovering';
  }

  if (coachState === EXTEMPORE_COACH_STATES.STUCK) {
    return 'Need a reset';
  }

  if (isRecording) {
    return 'Recording ready';
  }

  return 'Ready to record';
}

function TopicReel({ topics, selectorPhase, rollingDeck, landingTopic, spinOffset }) {
  const visibleTopics = useMemo(() => {
    if (selectorPhase === SELECTION_PHASES.RANDOMIZING || selectorPhase === SELECTION_PHASES.LOCKING) {
      return rollingDeck;
    }

    if (selectorPhase === SELECTION_PHASES.LOCKED && landingTopic) {
      const focusDeck = [...topics];
      if (focusDeck.length > EXTEMPORE_CENTER_INDEX) {
        focusDeck[EXTEMPORE_CENTER_INDEX] = landingTopic;
      }
      return focusDeck;
    }

    return topics;
  }, [landingTopic, rollingDeck, selectorPhase, topics]);

  const reelSource = visibleTopics.length >= EXTEMPORE_VISIBLE_ROWS
    ? visibleTopics
    : [...visibleTopics, ...Array.from({ length: EXTEMPORE_VISIBLE_ROWS - visibleTopics.length }, (_, index) => `Loading topic ${index + 1}`)];

  return (
    <div className="w-full rounded-[24px] border border-outline-variant bg-surface-container-low/90 p-4 shadow-[0_24px_80px_rgba(24,51,46,0.06)] sm:p-5 md:p-5 lg:p-5">
      <div className="relative overflow-hidden rounded-[22px] border border-outline-variant bg-surface">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-3 sm:px-4 md:px-5">
          <div className="h-[66px] rounded-[16px] border border-primary/25 bg-primary/8 shadow-[0_0_0_1px_rgba(29,93,82,0.08)] sm:h-[70px] md:h-[74px]" />
        </div>
        <div className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-b from-surface-container-low via-transparent to-surface-container-low" />
        <div className="relative overflow-hidden" style={{ height: `${ROW_HEIGHT * EXTEMPORE_VISIBLE_ROWS}px` }}>
          <div className="will-change-transform transition-transform duration-200 ease-out" style={{ transform: `translate3d(0, -${spinOffset * ROW_HEIGHT}px, 0)` }}>
            {reelSource.map((topic, index) => {
              const distance = Math.abs(index - (spinOffset + EXTEMPORE_CENTER_INDEX));
              const centered = distance === 0;
              const nearCenter = distance === 1;
              const far = distance >= 3;

              return (
                <div
                  key={`${topic}-${index}`}
                  className={`flex items-center justify-center px-4 text-center transition-all duration-200 sm:px-5 md:px-6 ${centered ? 'scale-105 opacity-100 blur-0' : nearCenter ? 'scale-100 opacity-75' : far ? 'scale-95 opacity-20 blur-[1px]' : 'scale-[0.98] opacity-50'}`}
                  style={{ height: `${ROW_HEIGHT}px` }}
                >
                  <p className={`max-w-[18ch] text-[1.45rem] font-semibold leading-tight tracking-[-0.045em] sm:max-w-[19ch] sm:text-[1.6rem] md:max-w-[20ch] md:text-[1.72rem] ${centered ? 'text-text' : 'text-on-surface-variant'}`}>
                    {topic}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExtemporePractice({
  isRecording,
  duration = 0,
  audioLevel = 0,
  isSpeaking = false,
  onStartRecording,
  onStopRecording,
  generateTopics,
  generateCoachSuggestion,
  transcribeAudio,
  mode = 'selection',
  selectedTopic = '',
  onTopicLocked,
  onChooseDifferentTopic
}) {
  const [phase, setPhase] = useState(mode === 'live' ? EXT_STATES.PRACTICE : EXT_STATES.TOPIC_SELECTION);
  const [topics, setTopics] = useState([]);
  const [currentTopic, setCurrentTopic] = useState(selectedTopic);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(true);
  const [selectorPhase, setSelectorPhase] = useState(SELECTION_PHASES.IDLE);
  const [rollingDeck, setRollingDeck] = useState([]);
  const [spinOffset, setSpinOffset] = useState(0);
  const [landingTopic, setLandingTopic] = useState('');
  const [pendingData, setPendingData] = useState(null);

  const timerRef = useRef(null);
  const spinTimerRef = useRef(null);
  const settleTimerRef = useRef(null);
  const transitionTimerRef = useRef(null);
  const didInitTopicsRef = useRef(false);

  const { speak, stop: stopTTS } = useSarvamTTS();
  const transcriptCapture = useExtemporeSpeechTranscript({
    enabled: phase !== EXT_STATES.TOPIC_SELECTION && isRecording,
    language: 'en-US'
  });
  const {
    preferences,
    toggleBeginnerMode,
    setPromptDensity,
    setHelpStyle,
    planningDraft,
    setPlanningDraft,
    coachState,
    currentPrompt,
    promptHistory,
    sessionSummary,
    markManualReset,
    finalizeSession,
    resetLiveSession,
    silenceMs
  } = useExtemporeCoach({
    topic: currentTopic,
    isRecording: phase !== EXT_STATES.TOPIC_SELECTION && isRecording,
    isSpeaking,
    audioLevel,
    duration,
    transcriptText: transcriptCapture.combinedTranscriptText,
    volumeHistory: pendingData?.volumeHistory || [],
    generateCoachSuggestion
  });

  useEffect(() => {
    setPhase(mode === 'live' ? EXT_STATES.PRACTICE : EXT_STATES.TOPIC_SELECTION);
  }, [mode]);

  useEffect(() => {
    setCurrentTopic(selectedTopic);
  }, [selectedTopic]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        // local duration already updates in recorder; this hook only needs a tick for UI refresh.
      }, 1000);
    } else if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording]);

  const handleGenerateTopics = useCallback(async () => {
    setIsGeneratingTopics(true);

    try {
      const newTopics = await generateTopics('general');
      setTopics((Array.isArray(newTopics) ? newTopics : []).filter(Boolean));
    } catch (error) {
      console.error('Failed to generate topics:', error);
      setTopics([]);
    } finally {
      setIsGeneratingTopics(false);
    }
  }, [generateTopics]);

  useEffect(() => {
    if (didInitTopicsRef.current) {
      return;
    }

    didInitTopicsRef.current = true;
    void handleGenerateTopics();
  }, [handleGenerateTopics]);

  const clearSelectionTimers = useCallback(() => {
    if (spinTimerRef.current) {
      window.clearInterval(spinTimerRef.current);
    }
    if (settleTimerRef.current) {
      window.clearTimeout(settleTimerRef.current);
    }
    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current);
    }
    spinTimerRef.current = null;
    settleTimerRef.current = null;
    transitionTimerRef.current = null;
  }, []);

  const resetSelector = useCallback(() => {
    clearSelectionTimers();
    setSelectorPhase(SELECTION_PHASES.IDLE);
    setRollingDeck([]);
    setSpinOffset(0);
    setLandingTopic('');
  }, [clearSelectionTimers]);

  const completeSelection = useCallback((topic) => {
    clearSelectionTimers();
    setCurrentTopic(topic);
    setSelectorPhase(SELECTION_PHASES.LOCKED);
    setLandingTopic(topic);
    void speak(`Your topic is: ${topic}`);

    transitionTimerRef.current = window.setTimeout(() => {
      if (onTopicLocked) {
        onTopicLocked(topic);
      } else {
        setPhase(EXT_STATES.PRACTICE);
      }
    }, LOCK_RELEASE_MS);
  }, [clearSelectionTimers, onTopicLocked, speak]);

  const startRollingSelection = useCallback(() => {
    if (topics.length === 0 || isGeneratingTopics || selectorPhase !== SELECTION_PHASES.IDLE || phase !== EXT_STATES.TOPIC_SELECTION) {
      return;
    }

    clearSelectionTimers();
    const { deck, targetIndex, winningTopic } = buildRollingDeck(topics);
    const targetOffset = Math.max(0, targetIndex - EXTEMPORE_CENTER_INDEX);

    setRollingDeck(deck);
    setSpinOffset(0);
    setLandingTopic(winningTopic);
    setSelectorPhase(SELECTION_PHASES.RANDOMIZING);

    if (targetOffset === 0) {
      settleTimerRef.current = window.setTimeout(() => completeSelection(winningTopic), EXTEMPORE_SPIN_SETTLE_MS);
      return;
    }

    let offset = 0;
    spinTimerRef.current = window.setInterval(() => {
      offset += 1;
      setSpinOffset(offset);

      if (offset >= targetOffset) {
        clearSelectionTimers();
        setSelectorPhase(SELECTION_PHASES.LOCKING);
        settleTimerRef.current = window.setTimeout(() => completeSelection(winningTopic), EXTEMPORE_SPIN_SETTLE_MS);
      }
    }, EXTEMPORE_SPIN_STEP_MS);
  }, [clearSelectionTimers, completeSelection, isGeneratingTopics, phase, selectorPhase, topics]);

  const handleStartPractice = useCallback(() => {
    resetLiveSession();
    setPendingData(null);
    setPhase(EXT_STATES.PRACTICE);
    transcriptCapture.reset();
    onStartRecording();
  }, [onStartRecording, resetLiveSession, transcriptCapture]);

  const handleStopPractice = useCallback(async () => {
    setPhase(EXT_STATES.PROCESSING);

    const result = await onStopRecording();
    const audioBlob = result?.blob || result;
    const durationMs = result?.duration || 0;
    const liveTranscriptText = transcriptCapture.combinedTranscriptText || transcriptCapture.transcriptText || '';
    let transcriptResult = null;

    if (audioBlob && typeof transcribeAudio === 'function') {
      try {
        transcriptResult = await transcribeAudio(audioBlob);
      } catch (error) {
        console.warn('Extempore transcription failed:', error);
      }
    }

    const transcriptAnalysis = transcriptResult?.words?.length > 0
      ? generateStutteringSummary(transcriptResult.words)
      : null;

    const summary = await finalizeSession({
      transcriptText: transcriptResult?.text || liveTranscriptText || '',
      transcriptAnalysis,
      volumeHistory: result?.volumeHistory || [],
      durationMs
    });

    setPendingData({
      blob: audioBlob,
      duration: durationMs,
      transcript: transcriptResult?.text || liveTranscriptText || '',
      transcriptAnalysis,
      summary,
      volumeHistory: result?.volumeHistory || []
    });
    setPhase(EXT_STATES.REVIEW);
    return result;
  }, [finalizeSession, onStopRecording, transcriptCapture, transcribeAudio]);

  const handleRetry = useCallback(() => {
    resetLiveSession();
    setPendingData(null);
    setPhase(EXT_STATES.PRACTICE);
    transcriptCapture.reset();
  }, [resetLiveSession, transcriptCapture]);

  const handleDiscard = useCallback(() => {
    resetLiveSession();
    setPendingData(null);
    setCurrentTopic('');
    setPhase(EXT_STATES.TOPIC_SELECTION);
    transcriptCapture.reset();
    if (onChooseDifferentTopic) {
      onChooseDifferentTopic();
    }
  }, [onChooseDifferentTopic, resetLiveSession, transcriptCapture]);

  const handleChooseDifferentTopic = useCallback(async () => {
    if (isRecording) {
      await onStopRecording();
    }

    resetLiveSession();
    setPendingData(null);
    setCurrentTopic('');
    setPhase(EXT_STATES.TOPIC_SELECTION);
    resetSelector();
    transcriptCapture.reset();

    if (onChooseDifferentTopic) {
      onChooseDifferentTopic();
    }
  }, [isRecording, onChooseDifferentTopic, onStopRecording, resetLiveSession, resetSelector, transcriptCapture]);

  useEffect(() => {
    return () => {
      stopTTS();
      clearSelectionTimers();
    };
  }, [clearSelectionTimers, stopTTS]);

  if (phase === EXT_STATES.TOPIC_SELECTION) {
    const phaseCopy = getSelectionPhaseCopy(selectorPhase, topics.length > 0, isGeneratingTopics);

    return (
      <div className="relative flex h-full min-h-0 flex-1 flex-col items-center justify-center overflow-hidden text-text custom-scrollbar">
        <div className="flex w-full max-w-3xl flex-col items-center gap-10 px-4 sm:px-6">
          <TopicReel
            topics={topics}
            selectorPhase={selectorPhase}
            rollingDeck={rollingDeck}
            landingTopic={landingTopic}
            spinOffset={spinOffset}
          />

          <OatButton
            type="button"
            onClick={startRollingSelection}
            disabled={phaseCopy.isActionDisabled}
            className={`refined-button-primary min-h-[60px] min-w-[280px] px-8 py-4 text-lg font-bold shadow-[0_12px_28px_rgba(29,93,82,0.16)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(29,93,82,0.24)] ${phaseCopy.isActionDisabled ? 'cursor-not-allowed opacity-70' : ''}`}
          >
            {phaseCopy.actionLabel}
          </OatButton>
        </div>
      </div>
    );
  }

  if (phase === EXT_STATES.PRACTICE || phase === EXT_STATES.PROCESSING) {
    const statusLabel = renderStateTitle(coachState, isRecording);
    const promptProgress = Math.min(100, Math.round((silenceMs / 8000) * 100));

    return (
      <div className="extempore-live-root relative flex min-h-full flex-1 flex-col overflow-visible bg-surface text-text custom-scrollbar">
        <div className="extempore-live-shell relative mx-auto flex w-full max-w-[1320px] flex-1 flex-col px-4 pb-44 pt-8 sm:px-6 sm:pb-48 md:px-8 md:pt-10 lg:px-10 lg:pb-40 xl:px-12">
          <div className="extempore-live-stack mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 md:gap-6">
            <section className="extempore-live-status-zone flex justify-center">
              <div className="extempore-live-status-strip flex flex-wrap items-center gap-3 rounded-full border border-outline-variant bg-surface-container-low/90 px-4 py-2">
                <span className="relative flex h-2 w-2">
                  {isRecording && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />}
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${isRecording ? 'bg-primary' : 'bg-on-surface-variant/50'}`} />
                </span>
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                  {statusLabel}
                </span>
                <span className="font-mono text-sm font-semibold text-text/70">{formatDuration(duration)}</span>
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                  {audioLevel > 0 ? `Level ${audioLevel}` : 'No input yet'}
                </span>
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                  Silence {formatDuration(silenceMs)}
                </span>
              </div>
            </section>

            <section className="extempore-live-topic-zone text-center">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">Current topic</p>
              <h1 className="mx-auto mt-3 font-display text-[2rem] font-semibold leading-[1.06] tracking-[-0.04em] text-text sm:max-w-[24ch] sm:text-[2.35rem] md:max-w-[26ch] md:text-[2.6rem] lg:text-[2.8rem]">
                {currentTopic || 'Can AI replace human jobs?'}
              </h1>
            </section>

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
              <PlanningStrip planningDraft={planningDraft} setPlanningDraft={setPlanningDraft} />
              <div className="rounded-[24px] border border-outline-variant bg-surface-container-low/90 p-5 shadow-[0_18px_48px_rgba(24,51,46,0.08)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">Coach settings</p>
                    <h3 className="mt-2 font-display text-[1.8rem] font-semibold tracking-[-0.04em] text-text">Beginner rescue</h3>
                  </div>
                  <OatButton
                    type="button"
                    onClick={toggleBeginnerMode}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${preferences.beginnerMode ? 'border-primary bg-primary text-white' : 'border-outline-variant bg-surface text-on-surface-variant hover:text-text'}`}
                  >
                    {preferences.beginnerMode ? 'On' : 'Off'}
                  </OatButton>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant">Prompt density</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.values(EXTEMPORE_COACH_PROMPT_DENSITIES).map((density) => (
                        <DensityChip
                          key={density}
                          label={PROMPT_DENSITY_LABELS[density]}
                          active={preferences.promptDensity === density}
                          onClick={() => setPromptDensity(density)}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.15em] text-on-surface-variant">Help style</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.values(EXTEMPORE_COACH_HELP_STYLES).map((style) => (
                        <DensityChip
                          key={style}
                          label={HELP_STYLE_LABELS[style]}
                          active={preferences.helpStyle === style}
                          onClick={() => setHelpStyle(style)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-dashed border-outline-variant bg-surface p-4">
                    <p className="text-sm leading-relaxed text-on-surface-variant">
                      The coach stays quiet while you are speaking and only steps in when you freeze, drift, or repeat.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <StateChip state={COACH_STATE_LABELS[coachState] || coachState} />
                      <StateChip state={`${promptHistory.length} prompts`} muted />
                      <StateChip state={`Progress ${promptProgress}%`} muted />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
              <CoachPromptCard
                prompt={currentPrompt}
                coachState={coachState}
                silenceMs={silenceMs}
                isRecording={isRecording}
                beginnerMode={preferences.beginnerMode}
                onResetThought={markManualReset}
              />

              <div className="rounded-[24px] border border-outline-variant bg-surface-container-low/90 p-5 shadow-[0_18px_48px_rgba(24,51,46,0.08)]">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">Structure guide</p>
                <h2 className="mt-2 font-display text-[1.95rem] font-semibold tracking-[-0.04em] text-text">The PREP method</h2>
                <div className="mt-5">
                  <PREPAccordion items={PREP_METHOD} />
                </div>
              </div>
            </section>

            <section className="w-full">
              <TranscriptCuePanel
                transcriptText={transcriptCapture.transcriptText}
                interimTranscriptText={transcriptCapture.interimTranscriptText}
                fragments={transcriptCapture.fragments}
                isSupported={transcriptCapture.isSupported}
                isListening={transcriptCapture.isListening}
                error={transcriptCapture.error}
              />
            </section>
          </div>
        </div>

        <footer className="extempore-live-dock fixed bottom-4 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-[24px] border border-outline-variant bg-surface/95 shadow-[0_18px_54px_rgba(24,51,46,0.11)] backdrop-blur-xl sm:bottom-5 sm:w-[calc(100%-2.5rem)] sm:max-w-[calc(100%-2.5rem)] md:w-[calc(100%-3rem)] md:max-w-[calc(100%-3rem)] lg:inset-x-0 lg:bottom-0 lg:w-full lg:max-w-none lg:translate-x-0 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:shadow-none">
          <div className="mx-auto grid min-h-[88px] w-full max-w-[1320px] grid-cols-1 gap-3 px-4 py-3 sm:px-5 sm:py-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:px-8 xl:px-10">
            <div className="order-2 flex justify-center lg:order-1">
              <OatButton
                onClick={() => { void handleChooseDifferentTopic(); }}
                className="flex min-h-10 items-center gap-2 rounded-full border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:text-text"
                type="button"
                variant="secondary"
                outline
              >
                <SwapIcon className="h-5 w-5" />
                Choose different topic
              </OatButton>
            </div>

            <div className="order-1 flex justify-center lg:order-2">
              <OatButton
                onClick={isRecording ? handleStopPractice : handleStartPractice}
                className={`group relative flex h-14 min-w-[220px] items-center justify-center gap-3 overflow-hidden rounded-full px-6 font-semibold text-white transition-all duration-200 active:scale-95 ${isRecording ? 'bg-danger shadow-[0_18px_36px_rgba(168,70,59,0.24)] hover:-translate-y-0.5 hover:bg-danger/90' : 'bg-primary-container shadow-[0_18px_36px_rgba(29,93,82,0.22)] hover:-translate-y-0.5 hover:opacity-95'}`}
                type="button"
                variant={isRecording ? 'danger' : 'primary'}
              >
                <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-white ${isRecording ? 'text-danger' : 'text-primary-container'}`}>
                  {isRecording ? <StopIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
                </div>
                <span className="font-display text-xl font-bold tracking-[-0.03em]">{isRecording ? 'Stop recording' : 'Start recording'}</span>
              </OatButton>
            </div>

            <div className="order-3 flex flex-col items-center text-center lg:pr-1">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Practice session</div>
              <div className="mt-1 text-[11px] font-medium text-on-surface-variant">Speak one thought at a time.</div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  if (phase === EXT_STATES.REVIEW) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center overflow-y-auto rounded-[24px] border border-outline-variant bg-surface px-4 py-8 text-text custom-scrollbar md:px-6">
        <div className="flex w-full max-w-3xl flex-col gap-5">
          <div className="w-full rounded-[24px] border border-outline-variant bg-surface-container-low px-6 py-8 text-center shadow-[0_18px_54px_rgba(24,51,46,0.06)] md:px-8">
            <div className="mb-6 text-6xl">🎉</div>
            <h2 className="text-4xl font-semibold tracking-[-0.05em] text-text">Great job</h2>
            <p className="mt-4 text-xl text-on-surface-variant">
              You spoke for <span className="font-mono font-bold text-text">{formatDuration(pendingData?.duration || 0)}</span> on:
            </p>
            <div className="mt-8 rounded-[20px] border border-outline-variant bg-surface p-5">
              <p className="text-lg font-medium italic text-text">"{currentTopic}"</p>
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <OatButton onClick={handleRetry} variant="secondary" outline className="w-full py-3" type="button">Record again</OatButton>
              <OatButton onClick={handleDiscard} variant="danger" className="w-full py-3" type="button">Discard and choose new topic</OatButton>
            </div>
          </div>

          <SessionSummaryPanel topic={currentTopic} summary={sessionSummary} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center">
      <div className="spinner mb-4 h-8 w-8 border-2" />
      <p className="text-on-surface-variant">Processing your speech...</p>
    </div>
  );
}

export default ExtemporePractice;
