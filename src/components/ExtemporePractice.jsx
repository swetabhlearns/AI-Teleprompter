import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowsLeftRight,
  Brain,
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
import { useSarvamTTS } from '../hooks/useSarvamTTS';
import {
  buildRollingDeck,
  getSelectionPhaseCopy,
  EXTEMPORE_CENTER_INDEX,
  EXTEMPORE_LOCK_CONFIRM_MS,
  EXTEMPORE_SPIN_STEP_MS,
  EXTEMPORE_SPIN_SETTLE_MS,
  EXTEMPORE_VISIBLE_ROWS
} from '../utils/extemporeFlow';

const EXT_STATES = {
  TOPIC_SELECTION: 'topic_selection',
  PRACTICE: 'practice',
  REVIEW: 'review'
};

const SELECTION_PHASES = {
  IDLE: 'idle',
  RANDOMIZING: 'randomizing',
  LOCKING: 'locking',
  LOCKED: 'locked'
};

const PREP_METHOD = [
  {
    title: 'Point',
    icon: 'point',
    content: 'Start strong by clearly stating your main point or the central idea of your topic.'
  },
  {
    title: 'Reason',
    icon: 'reason',
    content: 'Provide the core reason behind your point so the argument has a clear logic.'
  },
  {
    title: 'Example',
    icon: 'example',
    content: 'Share a concrete example, story, or data point to make your reasoning tangible.'
  },
  {
    title: 'Point',
    icon: 'conclusion',
    content: 'Close by restating your point with confidence and a memorable finish.'
  }
];

function PrepIcon({ type, className = '' }) {
  const iconProps = { className, size: 20, weight: 'duotone' };

  if (type === 'point') {
    return <Target {...iconProps} aria-hidden="true" />;
  }

  if (type === 'reason') {
    return <Brain {...iconProps} aria-hidden="true" />;
  }

  if (type === 'example') {
    return <Lightbulb {...iconProps} aria-hidden="true" />;
  }

  return <CheckCircle {...iconProps} aria-hidden="true" />;
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

function MicIcon({ className = '' }) {
  return <Microphone className={className} size={16} weight="fill" aria-hidden="true" />;
}

function StopIcon({ className = '' }) {
  return <Stop className={className} size={16} weight="fill" aria-hidden="true" />;
}

function SwapIcon({ className = '' }) {
  return <ArrowsLeftRight className={className} size={20} weight="bold" aria-hidden="true" />;
}

function PREPAccordion({ items }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="prep-accordion w-full space-y-4">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={index} className={`prep-accordion-item overflow-hidden ${isOpen ? 'is-open' : ''}`}>
            <button
              onClick={() => setOpenIndex(isOpen ? -1 : index)}
              className="prep-accordion-trigger flex w-full items-center justify-between px-5 py-4 text-left outline-none sm:px-6 sm:py-5"
              type="button"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`prep-accordion-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isOpen ? 'is-open' : ''}`}>
                  <PrepIcon type={item.icon} className="h-5 w-5" />
                </div>
                <span className="font-display text-[1.45rem] font-semibold leading-none text-text">{item.title}</span>
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

function PREPHints() {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="flex h-full min-h-[360px] flex-col p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-display text-[1.85rem] font-semibold tracking-[-0.03em] text-text">Speech Hints</h3>
        <button
          onClick={() => setIsVisible((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface-variant transition hover:bg-surface-container-high hover:text-text"
          type="button"
          title={isVisible ? 'Hide Hints' : 'Show Hints'}
        >
          {isVisible ? <EyeOffIcon className="h-[18px] w-[18px]" /> : <EyeIcon className="h-[18px] w-[18px]" />}
        </button>
      </div>

      {isVisible ? (
        <div className="space-y-5 animate-fade-in text-[14px] text-on-surface-variant">
          <div><strong className="mb-1 block text-text">Point Hint:</strong>Keep it as one clear declarative sentence.</div>
          <div><strong className="mb-1 block text-text">Reason Hint:</strong>Start with why, then support in 1-2 lines.</div>
          <div><strong className="mb-1 block text-text">Example Hint:</strong>Use a concrete event, stat, or personal instance.</div>
          <div><strong className="mb-1 block text-text">Conclusion Hint:</strong>Restate the point with conviction.</div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-on-surface-variant/60 animate-fade-in">
          <EyeIcon className="mb-4 h-11 w-11 opacity-50" />
          <p className="max-w-[200px] text-sm">Click the eye to reveal structure hints</p>
        </div>
      )}
    </div>
  );
}

const ROW_HEIGHT = 84;
const LOCK_RELEASE_MS = EXTEMPORE_LOCK_CONFIRM_MS;

function getPhaseRows(topics, selectorPhase, rollingDeck, landingTopic) {
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
}

function ExtemporePractice({
  isRecording,
  onStartRecording,
  onStopRecording,
  generateTopics,
  mode = 'selection',
  selectedTopic = '',
  onTopicLocked,
  onChooseDifferentTopic
}) {
  const [state, setState] = useState(mode === 'live' ? EXT_STATES.PRACTICE : EXT_STATES.TOPIC_SELECTION);
  const [topics, setTopics] = useState([]);
  const [currentTopic, setCurrentTopic] = useState(selectedTopic);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(true);
  const [pendingData, setPendingData] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectorPhase, setSelectorPhase] = useState(SELECTION_PHASES.IDLE);
  const [rollingDeck, setRollingDeck] = useState([]);
  const [spinOffset, setSpinOffset] = useState(0);
  const [selectionProgress, setSelectionProgress] = useState(0);
  const [landingTopic, setLandingTopic] = useState('');

  const timerRef = useRef(null);
  const spinTimerRef = useRef(null);
  const settleTimerRef = useRef(null);
  const transitionTimerRef = useRef(null);
  const didInitTopicsRef = useRef(false);

  const { speak, stop: stopTTS } = useSarvamTTS();

  useEffect(() => {
    setState(mode === 'live' ? EXT_STATES.PRACTICE : EXT_STATES.TOPIC_SELECTION);
  }, [mode]);

  useEffect(() => {
    setCurrentTopic(selectedTopic);
  }, [selectedTopic]);

  const clearSelectionTimers = useCallback(() => {
    if (spinTimerRef.current) clearInterval(spinTimerRef.current);
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    spinTimerRef.current = null;
    settleTimerRef.current = null;
    transitionTimerRef.current = null;
  }, []);

  const resetSelector = useCallback(() => {
    clearSelectionTimers();
    setSelectorPhase(SELECTION_PHASES.IDLE);
    setRollingDeck([]);
    setSpinOffset(0);
    setSelectionProgress(0);
    setLandingTopic('');
  }, [clearSelectionTimers]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setElapsedTime((prev) => prev + 1000), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
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
    if (didInitTopicsRef.current) return;
    didInitTopicsRef.current = true;
    void handleGenerateTopics();
  }, [handleGenerateTopics]);

  const completeSelection = useCallback((topic) => {
    clearSelectionTimers();
    setCurrentTopic(topic);
    setElapsedTime(0);
    setPendingData(null);
    setSelectorPhase(SELECTION_PHASES.LOCKED);
    setSelectionProgress(100);
    void speak(`Your topic is: ${topic}`);

    transitionTimerRef.current = setTimeout(() => {
      if (onTopicLocked) {
        onTopicLocked(topic);
      } else {
        setState(EXT_STATES.PRACTICE);
      }
    }, LOCK_RELEASE_MS);
  }, [clearSelectionTimers, onTopicLocked, speak]);

  const startRollingSelection = useCallback(() => {
    if (topics.length === 0 || isGeneratingTopics || selectorPhase !== SELECTION_PHASES.IDLE || state !== EXT_STATES.TOPIC_SELECTION) {
      return;
    }

    clearSelectionTimers();
    const { deck, targetIndex, winningTopic } = buildRollingDeck(topics);
    const targetOffset = Math.max(0, targetIndex - EXTEMPORE_CENTER_INDEX);

    setRollingDeck(deck);
    setSpinOffset(0);
    setSelectionProgress(0);
    setLandingTopic(winningTopic);
    setSelectorPhase(SELECTION_PHASES.RANDOMIZING);

    if (targetOffset === 0) {
      settleTimerRef.current = setTimeout(() => completeSelection(winningTopic), EXTEMPORE_SPIN_SETTLE_MS);
      return;
    }

    let offset = 0;
    spinTimerRef.current = setInterval(() => {
      offset += 1;
      setSpinOffset(offset);
      setSelectionProgress(Math.round((offset / targetOffset) * 100));

      if (offset >= targetOffset) {
        clearSelectionTimers();
        setSelectorPhase(SELECTION_PHASES.LOCKING);
        setSelectionProgress(100);
        settleTimerRef.current = setTimeout(() => completeSelection(winningTopic), EXTEMPORE_SPIN_SETTLE_MS);
      }
    }, EXTEMPORE_SPIN_STEP_MS);
  }, [clearSelectionTimers, completeSelection, isGeneratingTopics, selectorPhase, state, topics]);

  const handleStopPractice = async () => {
    const result = await onStopRecording();
    setPendingData({ blob: result?.blob || result, duration: result?.duration || 0 });
    setState(EXT_STATES.REVIEW);
  };

  const handleStartPractice = useCallback(() => {
    setElapsedTime(0);
    onStartRecording();
  }, [onStartRecording]);

  const handleDiscard = () => {
    setPendingData(null);
    setCurrentTopic('');
    setElapsedTime(0);
    resetSelector();
    if (onChooseDifferentTopic) onChooseDifferentTopic();
    else setState(EXT_STATES.TOPIC_SELECTION);
  };

  const handleRetry = () => {
    setPendingData(null);
    setElapsedTime(0);
    setState(EXT_STATES.PRACTICE);
  };

  const handleChooseDifferentTopic = useCallback(async () => {
    if (isRecording) await onStopRecording();
    setPendingData(null);
    setElapsedTime(0);
    setCurrentTopic('');
    resetSelector();
    if (onChooseDifferentTopic) onChooseDifferentTopic();
    else setState(EXT_STATES.TOPIC_SELECTION);
  }, [isRecording, onChooseDifferentTopic, onStopRecording, resetSelector]);

  useEffect(() => {
    return () => {
      stopTTS();
      clearSelectionTimers();
    };
  }, [clearSelectionTimers, stopTTS]);

  if (state === EXT_STATES.TOPIC_SELECTION) {
    const phaseCopy = getSelectionPhaseCopy(selectorPhase, topics.length > 0, isGeneratingTopics);
    const visibleTopics = getPhaseRows(topics, selectorPhase, rollingDeck, landingTopic);
    const reelSource = visibleTopics.length >= EXTEMPORE_VISIBLE_ROWS
      ? visibleTopics
      : [...visibleTopics, ...Array.from({ length: EXTEMPORE_VISIBLE_ROWS - visibleTopics.length }, (_, index) => `Loading topic ${index + 1}`)];
    const reelHeight = ROW_HEIGHT * EXTEMPORE_VISIBLE_ROWS;

    return (
      <div className="relative flex h-full min-h-0 flex-1 flex-col items-center justify-center overflow-hidden text-text custom-scrollbar">
        <div className="flex w-full max-w-3xl flex-col items-center gap-10 px-4 sm:px-6">
          <div className="w-full rounded-[32px] border border-outline-variant bg-surface-container-low/90 p-4 shadow-[0_24px_80px_rgba(24,51,46,0.06)] sm:p-5 md:p-6 lg:p-8">
            <div className="relative overflow-hidden rounded-[24px] border border-outline-variant bg-surface">
              <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-3 sm:px-4 md:px-5">
                <div className="h-[68px] rounded-[18px] border border-primary/25 bg-primary/8 shadow-[0_0_0_1px_rgba(29,93,82,0.08)] sm:h-[72px] md:h-[76px]" />
              </div>
              <div className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-b from-surface-container-low via-transparent to-surface-container-low" />
              <div className="relative overflow-hidden" style={{ height: `${reelHeight}px` }}>
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

          <button
            type="button"
            onClick={startRollingSelection}
            disabled={phaseCopy.isActionDisabled}
            className={`refined-button-primary min-h-[64px] min-w-[280px] px-8 py-5 text-lg font-bold shadow-[0_12px_28px_rgba(29,93,82,0.16)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(29,93,82,0.24)] ${phaseCopy.isActionDisabled ? 'cursor-not-allowed opacity-70' : ''}`}
          >
            {phaseCopy.actionLabel}
          </button>
        </div>
      </div>
    );
  }

  if (state === EXT_STATES.PRACTICE) {
    return (
      <div className="extempore-live-root relative flex min-h-full flex-1 flex-col overflow-visible bg-surface text-text custom-scrollbar">
        <div className="extempore-live-shell relative mx-auto flex w-full max-w-[1320px] flex-1 flex-col px-4 pb-44 pt-8 sm:px-6 sm:pb-48 md:px-8 md:pt-10 lg:px-10 lg:pb-40 xl:px-12">
          <div className="extempore-live-stack mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 md:gap-8">
            <section className="extempore-live-status-zone flex justify-center">
              <div className="extempore-live-status-strip flex items-center gap-3 rounded-full border border-outline-variant bg-surface-container-low/90 px-4 py-2">
                <span className="relative flex h-2 w-2">
                  {isRecording && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />}
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${isRecording ? 'bg-primary' : 'bg-on-surface-variant/50'}`} />
                </span>
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                  {isRecording ? 'Recording Live' : 'Ready to Record'}
                </span>
                <span className="font-mono text-sm font-semibold text-text/70">{formatDuration(elapsedTime)}</span>
              </div>
            </section>

            <section className="extempore-live-topic-zone text-center">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">Current Topic</p>
              <h1 className="mx-auto mt-3 font-display text-[2rem] font-semibold leading-[1.06] tracking-[-0.04em] text-text sm:max-w-[24ch] sm:text-[2.35rem] md:max-w-[26ch] md:text-[2.6rem] lg:text-[2.8rem]">
                {currentTopic || 'Can AI replace human jobs?'}
              </h1>
            </section>

            <section className="extempore-live-workspace-zone w-full">
              <div className="mb-5 text-center md:mb-6">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">Structure Guide</p>
                <h2 className="mt-2 font-display text-[2rem] font-semibold tracking-[-0.04em] text-text">The PREP Method</h2>
              </div>

              <div className="extempore-live-workspace-grid grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)] lg:gap-6">
                <div className="extempore-live-panel">
                  <PREPAccordion items={PREP_METHOD} />
                </div>
                <div className="extempore-live-panel">
                  <PREPHints />
                </div>
              </div>
            </section>
          </div>
        </div>

        <footer className="extempore-live-dock fixed bottom-4 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-[26px] border border-outline-variant bg-surface/95 shadow-[0_18px_54px_rgba(24,51,46,0.11)] backdrop-blur-xl sm:bottom-5 sm:w-[calc(100%-2.5rem)] sm:max-w-[calc(100%-2.5rem)] md:w-[calc(100%-3rem)] md:max-w-[calc(100%-3rem)] lg:inset-x-0 lg:bottom-0 lg:w-full lg:max-w-none lg:translate-x-0 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:shadow-none">
          <div className="mx-auto grid min-h-[92px] w-full max-w-[1320px] grid-cols-1 gap-3 px-4 py-3 sm:px-6 sm:py-4 md:px-8 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:px-10 xl:px-12">
            <div className="order-2 flex justify-center lg:order-1">
              <button
                onClick={() => { void handleChooseDifferentTopic(); }}
                className="flex min-h-10 items-center gap-2 rounded-full border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:text-text"
                type="button"
              >
                <SwapIcon className="h-5 w-5" />
                Choose Different Topic
              </button>
            </div>

            <div className="order-1 flex justify-center lg:order-2">
              <button
                onClick={isRecording ? handleStopPractice : handleStartPractice}
                className={`group relative flex h-14 min-w-[220px] items-center justify-center gap-3 overflow-hidden rounded-full px-6 font-semibold text-white transition-all duration-200 active:scale-95 ${isRecording ? 'bg-danger shadow-[0_18px_36px_rgba(168,70,59,0.24)] hover:-translate-y-0.5 hover:bg-danger/90' : 'bg-primary-container shadow-[0_18px_36px_rgba(29,93,82,0.22)] hover:-translate-y-0.5 hover:opacity-95'}`}
                type="button"
              >
                <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-white ${isRecording ? 'text-danger' : 'text-primary-container'}`}>
                  {isRecording ? <StopIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
                </div>
                <span className="font-display text-xl font-bold tracking-[-0.03em]">{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
              </button>
            </div>

            <div className="order-3 flex flex-col items-center text-center lg:pr-1">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">Practice Session</div>
              <div className="mt-1 text-[11px] font-medium text-on-surface-variant">© 2024 AI Tracker. Speak with confidence.</div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  if (state === EXT_STATES.REVIEW) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center overflow-y-auto rounded-[28px] border border-outline-variant bg-surface px-4 py-8 text-text custom-scrollbar md:px-6">
        <div className="w-full max-w-2xl rounded-[32px] border border-outline-variant bg-surface-container-low px-6 py-8 text-center shadow-[0_18px_54px_rgba(24,51,46,0.06)] md:px-8">
          <div className="mb-6 text-6xl">🎉</div>
          <h2 className="text-4xl font-semibold tracking-[-0.05em] text-text">Great Job!</h2>
          <p className="mt-4 text-xl text-on-surface-variant">
            You spoke for <span className="font-mono font-bold text-text">{formatDuration(pendingData?.duration || 0)}</span> on the topic:
          </p>
          <div className="mt-8 rounded-[24px] border border-outline-variant bg-surface p-6">
            <p className="text-lg font-medium italic text-text">"{currentTopic}"</p>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <button onClick={handleRetry} className="refined-button-secondary w-full py-3" type="button">🔄 Record Again</button>
            <button onClick={handleDiscard} className="btn w-full py-3 text-red-400 hover:bg-red-500/10 hover:text-red-300" type="button">🗑️ Discard & Choose New Topic</button>
          </div>
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
