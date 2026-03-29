import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseDeliveryScript } from '../utils/formatters';

const DEFAULT_NOTATION_PREFERENCES = {
  showSections: true,
  showPauses: true,
  showSlow: true,
  showFast: true,
  showTempo: true,
  showEmphasis: true,
  showEnunciation: true,
  distractionFree: false
};

function isTempoVisible(tempo, preferences) {
  const legacyTempo = preferences.showTempo;
  const tempoToggle = typeof legacyTempo === 'boolean' ? legacyTempo : true;

  if (tempo === 'slow') {
    return tempoToggle && preferences.showSlow !== false;
  }

  if (tempo === 'fast') {
    return tempoToggle && preferences.showFast !== false;
  }

  return false;
}

function Token({ token, notationPreferences }) {
  if (token.type === 'pause') {
    if (!notationPreferences.showPauses) {
      return null;
    }

    return <span className="teleprompter-pause">{token.value}</span>;
  }

  if (token.type === 'emphasis') {
    return (
      <span className={notationPreferences.showEmphasis ? 'teleprompter-emphasis' : ''}>
        {token.value}
      </span>
    );
  }

  if (token.type === 'enunciation') {
    return (
      <span className={notationPreferences.showEnunciation ? 'teleprompter-enunciation' : ''}>
        {token.value}
      </span>
    );
  }

  return <span>{token.value}</span>;
}

function SectionBlock({ section, notationPreferences }) {
  return (
    <section className="teleprompter-section">
      {notationPreferences.showSections && section.title !== 'Draft' && (
        <div className="teleprompter-section-label">
          <span>{String(section.index).padStart(2, '0')}</span>
          <h3>{section.title}</h3>
        </div>
      )}

      {section.paragraphs.map((paragraph) => (
        <p
          key={paragraph.id}
          className={[
            'teleprompter-paragraph',
            isTempoVisible(paragraph.tempo, notationPreferences) ? `tempo-${paragraph.tempo}` : ''
          ].filter(Boolean).join(' ')}
        >
          {isTempoVisible(paragraph.tempo, notationPreferences) && (
            <span className={`teleprompter-tempo-badge tempo-${paragraph.tempo}`}>
              {paragraph.tempo === 'slow' ? 'Slow' : 'Fast'}
            </span>
          )}

          {paragraph.tokens.map((token, index) => (
            <Token
              key={`${paragraph.id}-${index}`}
              token={token}
              notationPreferences={notationPreferences}
            />
          ))}
        </p>
      ))}
    </section>
  );
}

export function Teleprompter({
  script = '',
  isActive = false,
  isSpeaking = false,
  audioLevel = 0,
  onSpeedChange,
  initialSpeed = 20,
  speed,
  notationPreferences = DEFAULT_NOTATION_PREFERENCES,
  variant = 'overlay',
  showControls = true,
  showHints = true,
  showLiveIndicator = true
}) {
  const [uncontrolledSpeed, setUncontrolledSpeed] = useState(initialSpeed);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const contentRef = useRef(null);
  const scrollPosRef = useRef(0);
  const animationRef = useRef(null);
  const speedRef = useRef(initialSpeed);

  const resolvedPreferences = notationPreferences || DEFAULT_NOTATION_PREFERENCES;
  const parsedScript = useMemo(() => parseDeliveryScript(script), [script]);
  const resolvedSpeed = typeof speed === 'number' ? speed : uncontrolledSpeed;

  const handleSpeedUp = useCallback(() => {
    const next = Math.min(100, resolvedSpeed + 10);
    if (typeof speed === 'number') {
      onSpeedChange?.(next);
    } else {
      setUncontrolledSpeed(next);
    }
  }, [onSpeedChange, resolvedSpeed, speed]);

  const handleSpeedDown = useCallback(() => {
    const next = Math.max(10, resolvedSpeed - 10);
    if (typeof speed === 'number') {
      onSpeedChange?.(next);
    } else {
      setUncontrolledSpeed(next);
    }
  }, [onSpeedChange, resolvedSpeed, speed]);

  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const handleReset = useCallback(() => {
    scrollPosRef.current = 0;
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, []);

  useEffect(() => {
    speedRef.current = resolvedSpeed;
    if (onSpeedChange) {
      onSpeedChange(resolvedSpeed);
    }
  }, [onSpeedChange, resolvedSpeed]);

  useEffect(() => {
    if (!isActive) return undefined;

    const handleKeyDown = (event) => {
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          handleSpeedUp();
          break;
        case 'ArrowDown':
          event.preventDefault();
          handleSpeedDown();
          break;
        case ' ':
          event.preventDefault();
          handleTogglePause();
          break;
        case 'r':
        case 'R':
          event.preventDefault();
          handleReset();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleReset, handleSpeedDown, handleSpeedUp, handleTogglePause, isActive]);

  useEffect(() => {
    if (!isActive) {
      const resetTimer = window.setTimeout(() => {
        setCountdown(0);
        setIsScrolling(false);
        setIsPaused(false);
      }, 0);

      return () => window.clearTimeout(resetTimer);
    }

    if (isScrolling || countdown !== 0) {
      return undefined;
    }

    const startTimer = window.setTimeout(() => {
      setCountdown(5);
    }, 0);

    return () => window.clearTimeout(startTimer);
  }, [countdown, isActive, isScrolling]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = window.setTimeout(() => {
        if (countdown === 1) {
          setCountdown(0);
          setIsScrolling(true);
        } else {
          setCountdown(countdown - 1);
        }
      }, 1000);

      return () => window.clearTimeout(timer);
    }

    return undefined;
  }, [countdown]);

  useEffect(() => {
    if (!isActive || !isScrolling) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return undefined;
    }

    let lastTime = performance.now();

    const animate = (currentTime) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      if (!isPaused && contentRef.current) {
        const pixelsPerSecond = (speedRef.current / 100) * 200;
        const scrollDelta = (pixelsPerSecond * deltaTime) / 1000;

        scrollPosRef.current += scrollDelta;
        const maxScroll = contentRef.current.scrollHeight - contentRef.current.clientHeight;

        if (scrollPosRef.current >= maxScroll && maxScroll > 0) {
          scrollPosRef.current = maxScroll;
          contentRef.current.scrollTop = maxScroll;
          setIsPaused(true);
          return;
        }

        scrollPosRef.current = Math.min(scrollPosRef.current, Math.max(0, maxScroll));
        contentRef.current.scrollTop = scrollPosRef.current;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isActive, isPaused, isScrolling]);

  useEffect(() => {
    scrollPosRef.current = 0;
    const resetTimer = window.setTimeout(() => {
      setIsPaused(false);
      setIsScrolling(false);
      setCountdown(0);

      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    }, 0);

    return () => window.clearTimeout(resetTimer);
  }, [script]);

  if (!script) {
    return (
      <div className={variant === 'panel' ? 'teleprompter-panel' : 'teleprompter-overlay'}>
        <div className="teleprompter-empty">
          <p>No script loaded</p>
          <span>Open the script workspace to draft your delivery roadmap.</span>
        </div>
      </div>
    );
  }

  const rootClassName = variant === 'panel'
    ? 'teleprompter-panel glass-strong'
    : 'teleprompter-overlay';

  const textClassName = variant === 'panel'
    ? 'teleprompter-text teleprompter-panel-text'
    : 'teleprompter-text';

  const controlsClassName = variant === 'panel'
    ? 'teleprompter-controls teleprompter-controls-panel'
    : 'teleprompter-controls';

  const liveIndicatorClassName = variant === 'panel'
    ? 'teleprompter-live-indicator teleprompter-live-indicator-panel'
    : 'teleprompter-live-indicator';

  return (
    <div className={rootClassName}>
      {countdown > 0 && (
        <div className="teleprompter-countdown">
          <div className="teleprompter-countdown-label">Get ready</div>
          <div className="teleprompter-countdown-number">{countdown}</div>
          <div className="teleprompter-countdown-subtitle">Starting in {countdown} second{countdown !== 1 ? 's' : ''}</div>
        </div>
      )}

      <div
        ref={contentRef}
        className={textClassName}
        style={{
          height: variant === 'panel' ? 'auto' : '100%',
          minHeight: variant === 'panel' ? 0 : undefined,
          flex: variant === 'panel' ? '1 1 0' : undefined,
          overflow: 'hidden',
          overflowY: variant === 'panel' ? 'auto' : 'hidden',
          paddingTop: variant === 'panel' ? '0' : '44vh',
          paddingBottom: variant === 'panel' ? '0' : '42vh'
        }}
      >
        {parsedScript.sections.length === 0 ? (
          <p className="teleprompter-paragraph">Add a section header to shape the flow.</p>
        ) : (
          parsedScript.sections.map((section, index) => (
            <SectionBlock
              key={section.id}
              section={{ ...section, index: index + 1 }}
              notationPreferences={resolvedPreferences}
            />
          ))
        )}
      </div>

      {!resolvedPreferences.distractionFree && showControls && (
        <>
          {isActive && (
            <div className={controlsClassName}>
              <span className="teleprompter-speed-label">Speed</span>
              <button onClick={handleSpeedDown} className="teleprompter-control-button" type="button">
                −
              </button>
              <div className="teleprompter-speed-meter">
                <div className="teleprompter-speed-track">
                  <div
                    className="teleprompter-speed-fill"
                    style={{ width: `${resolvedSpeed}%` }}
                  />
                </div>
                <span>{resolvedSpeed}%</span>
              </div>
              <button onClick={handleSpeedUp} className="teleprompter-control-button" type="button">
                +
              </button>
              <button
                onClick={handleTogglePause}
                className={`teleprompter-pause-button ${isPaused ? 'paused' : 'running'}`}
                type="button"
              >
                {isPaused ? '▶' : '⏸'}
              </button>
              <button onClick={handleReset} className="teleprompter-control-button" type="button">
                ↺
              </button>
            </div>
          )}

          {isActive && showHints && (
            <div className="teleprompter-hints">
              ↑↓ Speed • Space Pause • R Reset
            </div>
          )}
        </>
      )}

      {isActive && showLiveIndicator && (
        <div className={liveIndicatorClassName}>
          <span className={isSpeaking ? 'speaking' : 'silent'}>
            {isSpeaking ? 'Speaking' : `Tracking ${Math.min(audioLevel * 2, 100)}%`}
          </span>
        </div>
      )}
    </div>
  );
}

export default Teleprompter;
