import { useEffect, useMemo, useState } from 'react';
import { Microphone, ArrowsClockwise } from '@phosphor-icons/react';
import { OatButton } from './ui/OatComponents';

const TOTAL_SECONDS = 120;

function formatCountdown(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

function formatTopic(topic) {
  if (topic && topic.trim()) {
    return topic.trim();
  }

  return 'Speak about something you know well';
}

export function ExtemporeSpeakOnly({ selectedTopic = '', onChooseDifferentTopic }) {
  const [isLive, setIsLive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const topic = formatTopic(selectedTopic);

  useEffect(() => {
    if (!isLive) {
      return undefined;
    }

    const startedAt = Date.now();

    const intervalId = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const nextSecondsLeft = TOTAL_SECONDS - elapsedSeconds;

      if (nextSecondsLeft <= 0) {
        setSecondsLeft(0);
        setIsLive(false);
        window.clearInterval(intervalId);
        return;
      }

      setSecondsLeft(nextSecondsLeft);
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isLive]);

  const countdownLabel = useMemo(() => formatCountdown(secondsLeft), [secondsLeft]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(29,93,82,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(96,165,250,0.10),_transparent_24%),linear-gradient(180deg,_rgba(250,251,249,0.96)_0%,_rgba(243,248,246,0.98)_100%)] text-text">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[8%] top-[10%] h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute right-[10%] top-[18%] h-80 w-80 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1320px] flex-1 flex-col px-4 pb-40 pt-8 sm:px-6 sm:pb-44 md:px-8 lg:px-10 xl:px-12">
        <main className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/75">
            Current topic
          </p>
          <h1 className="mt-4 max-w-[16ch] font-display text-[clamp(2.8rem,8vw,6rem)] font-semibold leading-[0.94] tracking-[-0.06em] text-text">
            {topic}
          </h1>

          <div className="mt-10 rounded-[32px] border border-outline-variant bg-surface-container-low/95 px-8 py-6 shadow-[0_24px_72px_rgba(24,51,46,0.08)]">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
              Time remaining
            </p>
            <div className="mt-3 font-display text-[clamp(4rem,12vw,8rem)] font-semibold leading-none tracking-[-0.08em] text-primary">
              {countdownLabel}
            </div>
            <p className="mt-3 text-[14px] leading-relaxed text-on-surface-variant">
              Keep speaking until the timer reaches zero.
            </p>
          </div>
        </main>
      </div>

      <footer className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-[24px] border border-outline-variant bg-surface/95 shadow-[0_18px_54px_rgba(24,51,46,0.11)] backdrop-blur-xl sm:bottom-5 sm:w-[calc(100%-2.5rem)] sm:max-w-[calc(100%-2.5rem)] md:w-[calc(100%-3rem)] md:max-w-[calc(100%-3rem)] lg:inset-x-0 lg:bottom-0 lg:w-full lg:max-w-none lg:translate-x-0 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:shadow-none">
        <div className="mx-auto grid min-h-[88px] w-full max-w-[1320px] grid-cols-1 gap-3 px-4 py-3 sm:px-5 sm:py-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:px-8 xl:px-10">
          <div className="order-2 flex justify-center lg:order-1">
            <OatButton
              onClick={() => {
                if (onChooseDifferentTopic) {
                  onChooseDifferentTopic();
                }
              }}
              className="flex min-h-10 items-center gap-2 rounded-full border border-outline-variant bg-surface px-4 py-2 text-sm font-semibold text-on-surface-variant transition hover:text-text"
              type="button"
              variant="secondary"
              outline
            >
              <ArrowsClockwise className="h-5 w-5" />
              Choose different topic
            </OatButton>
          </div>

          <div className="order-1 flex justify-center lg:order-2">
            <OatButton
              onClick={() => {
                setSecondsLeft(TOTAL_SECONDS);
                setIsLive((current) => !current);
              }}
              className={`group relative flex h-14 min-w-[220px] items-center justify-center gap-3 overflow-hidden rounded-full px-6 font-semibold text-white transition-all duration-200 active:scale-95 ${
                isLive
                  ? 'bg-primary shadow-[0_18px_36px_rgba(29,93,82,0.24)] hover:-translate-y-0.5 hover:bg-primary/90'
                  : 'bg-primary-container shadow-[0_18px_36px_rgba(29,93,82,0.22)] hover:-translate-y-0.5 hover:opacity-95'
              }`}
              type="button"
              variant="primary"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-primary-container">
                <Microphone className="h-4 w-4" weight="fill" />
              </div>
              <span className="font-display text-xl font-bold tracking-[-0.03em]">
                {isLive ? 'End speaking' : 'Start recording'}
              </span>
            </OatButton>
          </div>

          <div className="order-3 flex flex-col items-center text-center lg:pr-1">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
              Speaking session
            </div>
            <div className="mt-1 text-[11px] font-medium text-on-surface-variant">
              Talk for two minutes.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default ExtemporeSpeakOnly;
