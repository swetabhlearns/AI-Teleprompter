import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowsClockwise, ArrowRight } from '@phosphor-icons/react';
import { useGroq } from '../hooks/useGroq';
import { OatButton } from './ui/OatComponents';
import {
  buildRollingDeck,
  EXTEMPORE_CENTER_INDEX,
  EXTEMPORE_SPIN_STEP_MS,
  EXTEMPORE_SPIN_SETTLE_MS,
  EXTEMPORE_VISIBLE_ROWS,
  getSelectionPhaseCopy
} from '../utils/extemporeFlow';

const TOPIC_FILTERS = [
  { label: 'Technology', category: 'technology', blurb: 'AI, apps, work, and the internet' },
  { label: 'India', category: 'india', blurb: 'society, public life, and the future' },
  { label: 'Philosophy', category: 'philosophy', blurb: 'values, choices, and meaning' },
  { label: 'Education', category: 'education', blurb: 'learning, exams, skills, and growth' },
  { label: 'Business', category: 'business', blurb: 'work, money, careers, and leadership' },
  { label: 'Environment', category: 'environment', blurb: 'climate, habits, and responsibility' },
  { label: 'Media', category: 'media', blurb: 'news, creators, and attention' },
  { label: 'Society', category: 'social', blurb: 'family, youth, culture, and trust' }
];

const ROW_HEIGHT = 84;

function FilterChip({ label, active, onClick, blurb }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-semibold transition-all duration-200 ${
        active
          ? 'border-primary bg-primary text-white shadow-[0_12px_24px_rgba(29,93,82,0.16)]'
          : 'border-outline-variant bg-surface text-on-surface-variant hover:-translate-y-0.5 hover:border-primary/40 hover:text-text'
      }`}
      title={blurb}
    >
      <span>{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${active ? 'bg-white/15 text-white' : 'bg-surface-container-high text-on-surface-variant'}`}>
        Filter
      </span>
    </button>
  );
}

function Reel({ topics, selectorPhase, rollingDeck, landingTopic, spinOffset }) {
  const visibleTopics = useMemo(() => {
    if (selectorPhase === 'randomizing' || selectorPhase === 'locking') {
      return rollingDeck;
    }

    if (selectorPhase === 'locked' && landingTopic) {
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
    <div className="w-full rounded-[28px] border border-outline-variant bg-surface-container-low/92 p-4 shadow-[0_20px_58px_rgba(24,51,46,0.08)] sm:p-5">
      <div className="relative overflow-hidden rounded-[24px] border border-outline-variant bg-surface">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-3 sm:px-4">
          <div className="h-[70px] rounded-[18px] border border-primary/20 bg-primary/6 shadow-[0_0_0_1px_rgba(29,93,82,0.08)]" />
        </div>
        <div className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-b from-surface-container-low via-transparent to-surface-container-low" />
        <div className="relative overflow-hidden" style={{ height: `${ROW_HEIGHT * EXTEMPORE_VISIBLE_ROWS}px` }}>
          <div
            className="will-change-transform transition-transform duration-200 ease-out"
            style={{ transform: `translate3d(0, -${spinOffset * ROW_HEIGHT}px, 0)` }}
          >
            {reelSource.map((topic, index) => {
              const distance = Math.abs(index - (spinOffset + EXTEMPORE_CENTER_INDEX));
              const centered = distance === 0;
              const nearCenter = distance === 1;
              const far = distance >= 3;

              return (
                <div
                  key={`${topic}-${index}`}
                  className={`flex items-center justify-center px-4 text-center transition-all duration-200 sm:px-5 ${centered ? 'scale-105 opacity-100' : nearCenter ? 'scale-100 opacity-75' : far ? 'scale-95 opacity-20 blur-[1px]' : 'scale-[0.98] opacity-50'}`}
                  style={{ height: `${ROW_HEIGHT}px` }}
                >
                  <p className={`max-w-[20ch] text-[1.4rem] font-semibold leading-tight tracking-[-0.045em] sm:max-w-[22ch] sm:text-[1.55rem] md:text-[1.7rem] ${centered ? 'text-text' : 'text-on-surface-variant'}`}>
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

function LoadingStrip() {
  return (
    <div className="w-full rounded-[28px] border border-outline-variant bg-surface-container-low/92 p-4 shadow-[0_20px_58px_rgba(24,51,46,0.08)] sm:p-5">
      <div className="relative overflow-hidden rounded-[24px] border border-outline-variant bg-surface">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 px-3 sm:px-4">
          <div className="h-[70px] rounded-[18px] border border-primary/20 bg-primary/6" />
        </div>
        <div className="relative flex h-[420px] items-center justify-center">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
            Generating prompts...
          </p>
        </div>
      </div>
    </div>
  );
}

export function ExtemporeTopicPicker({ onTopicSelect }) {
  const { generateExtemporeTopics } = useGroq();
  const [selectedFilter, setSelectedFilter] = useState(TOPIC_FILTERS[0]);
  const [topics, setTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectorPhase, setSelectorPhase] = useState('idle');
  const [rollingDeck, setRollingDeck] = useState([]);
  const [spinOffset, setSpinOffset] = useState(0);
  const [landingTopic, setLandingTopic] = useState('');

  const spinTimerRef = useRef(null);
  const settleTimerRef = useRef(null);
  const requestRef = useRef(0);

  const activeFilter = useMemo(
    () => TOPIC_FILTERS.find((item) => item.category === selectedFilter.category) || TOPIC_FILTERS[0],
    [selectedFilter.category]
  );

  const clearTimers = useCallback(() => {
    if (spinTimerRef.current) {
      window.clearInterval(spinTimerRef.current);
    }
    if (settleTimerRef.current) {
      window.clearTimeout(settleTimerRef.current);
    }
    spinTimerRef.current = null;
    settleTimerRef.current = null;
  }, []);

  const loadTopics = useCallback(async (filter = selectedFilter) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setIsLoading(true);
    setError('');

    try {
      const generated = await generateExtemporeTopics(filter.category);

      if (requestRef.current !== requestId) {
        return;
      }

      setTopics((Array.isArray(generated) ? generated : []).filter(Boolean));
      setSelectorPhase('idle');
      setRollingDeck([]);
      setSpinOffset(0);
      setLandingTopic('');
    } catch (err) {
      if (requestRef.current !== requestId) {
        return;
      }

      setTopics([]);
      setError(err?.message || 'Failed to generate topics');
    } finally {
      if (requestRef.current === requestId) {
        setIsLoading(false);
      }
    }
  }, [generateExtemporeTopics, selectedFilter]);

  useEffect(() => {
    void loadTopics(selectedFilter);
  }, [loadTopics, selectedFilter]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  const startRollingSelection = useCallback(() => {
    if (isLoading || topics.length === 0 || selectorPhase !== 'idle') {
      return;
    }

    clearTimers();
    const { deck, targetIndex, winningTopic } = buildRollingDeck(topics);
    const targetOffset = Math.max(0, targetIndex - EXTEMPORE_CENTER_INDEX);

    setRollingDeck(deck);
    setSpinOffset(0);
    setLandingTopic(winningTopic);
    setSelectorPhase('randomizing');

    if (targetOffset === 0) {
      settleTimerRef.current = window.setTimeout(() => {
        setSelectorPhase('locked');
        onTopicSelect(winningTopic);
      }, EXTEMPORE_SPIN_SETTLE_MS);
      return;
    }

    let offset = 0;
    spinTimerRef.current = window.setInterval(() => {
      offset += 1;
      setSpinOffset(offset);

      if (offset >= targetOffset) {
        clearTimers();
        setSelectorPhase('locking');
        settleTimerRef.current = window.setTimeout(() => {
          setSelectorPhase('locked');
          onTopicSelect(winningTopic);
        }, EXTEMPORE_SPIN_SETTLE_MS);
      }
    }, EXTEMPORE_SPIN_STEP_MS);
  }, [clearTimers, isLoading, onTopicSelect, selectorPhase, topics]);

  const phaseCopy = getSelectionPhaseCopy(selectorPhase, topics.length > 0, isLoading);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(29,93,82,0.14),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(96,165,250,0.11),_transparent_24%),linear-gradient(180deg,_rgba(250,251,249,0.98)_0%,_rgba(243,248,246,0.98)_100%)] text-text">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[7%] top-[8%] h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute right-[8%] top-[16%] h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1320px] flex-1 flex-col px-4 py-8 sm:px-6 md:px-8 lg:px-10 xl:px-12">
        <header className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/75">
            Pick a topic lane
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.6rem,6.8vw,5.2rem)] font-semibold leading-[0.94] tracking-[-0.06em] text-text">
            Choose a filter, then let the reel land a topic.
          </h1>
          <p className="mt-4 max-w-[58ch] text-[16px] leading-relaxed text-on-surface-variant sm:text-[18px]">
            Use the chips to narrow the tone, then press start to spin through four generated prompts. Tap the revealed topic to begin the 2-minute speaking round.
          </p>
        </header>

        <section className="mt-8 rounded-[32px] border border-outline-variant bg-surface/92 px-5 py-5 shadow-[0_18px_48px_rgba(24,51,46,0.06)] sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">Filters</p>
              <h2 className="mt-2 font-display text-[1.55rem] font-semibold tracking-[-0.04em] text-text">
                {activeFilter.label}
              </h2>
              <p className="mt-1 text-[14px] leading-relaxed text-on-surface-variant">
                {activeFilter.blurb}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadTopics(selectedFilter)}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-outline-variant bg-surface px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition hover:-translate-y-0.5 hover:border-primary/40 hover:text-text"
            >
              <ArrowsClockwise className="h-4 w-4" />
              Shuffle prompts
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5">
            {TOPIC_FILTERS.map((filter) => (
              <FilterChip
                key={filter.category}
                label={filter.label}
                active={selectedFilter.category === filter.category}
                blurb={filter.blurb}
                onClick={() => {
                  setSelectedFilter(filter);
                  setSelectorPhase('idle');
                  clearTimers();
                }}
              />
            ))}
          </div>
        </section>

        <section className="mt-8 flex-1">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/80">Rolling selector</p>
              <h3 className="mt-2 font-display text-[1.8rem] font-semibold tracking-[-0.04em] text-text">
                {phaseCopy.title}
              </h3>
            </div>
            <div className="rounded-full border border-outline-variant bg-surface px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
              {isLoading ? 'Generating' : phaseCopy.badge}
            </div>
          </div>

          <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-on-surface-variant">
            {phaseCopy.helper}
          </p>

          {error ? (
            <div className="mt-5 rounded-[24px] border border-warning/30 bg-warning/5 px-5 py-4 text-[14px] text-warning">
              {error}
            </div>
          ) : null}

          <div className="mt-5">
            {isLoading ? (
              <LoadingStrip />
            ) : (
              <Reel
                topics={topics}
                selectorPhase={selectorPhase}
                rollingDeck={rollingDeck}
                landingTopic={landingTopic}
                spinOffset={spinOffset}
              />
            )}
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
            <OatButton
              type="button"
              onClick={startRollingSelection}
              disabled={phaseCopy.isActionDisabled}
              className={`group flex min-h-[60px] min-w-[280px] items-center justify-center gap-3 rounded-full px-8 py-4 text-lg font-bold shadow-[0_12px_28px_rgba(29,93,82,0.16)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(29,93,82,0.24)] ${
                phaseCopy.isActionDisabled ? 'cursor-not-allowed opacity-70' : ''
              }`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-primary-container">
                <ArrowRight className="h-4 w-4" />
              </span>
              {phaseCopy.actionLabel}
            </OatButton>
            <p className="text-center text-[12px] font-medium uppercase tracking-[0.18em] text-on-surface-variant">
              {phaseCopy.actionHint}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

export default ExtemporeTopicPicker;
