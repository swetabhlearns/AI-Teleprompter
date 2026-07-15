import { createPortal } from 'react-dom';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { CheckCircle, Lightbulb, Target } from '@phosphor-icons/react';
import { usePracticeStore } from '../../stores/practiceStore';
import { useScriptStore } from '../../stores/scriptStore';
import Teleprompter from '../../components/Teleprompter';
import {
  MagicBackground,
  MagicBadge,
  MagicBentoCard,
  MagicBentoGrid,
  MagicButton,
  MagicCard,
  MagicDock,
  MagicSectionHeader
} from '../../components/ui/MagicUI';

function PracticeMetric({ label, value, detail, tone = 'neutral', icon }) {
  const toneClasses = {
    neutral: 'border-slate-200 bg-white/70 text-slate-700',
    good: 'border-emerald-200 bg-emerald-50/90 text-emerald-700',
    warn: 'border-amber-200 bg-amber-50/90 text-amber-700',
    active: 'border-sky-200 bg-sky-50/90 text-sky-700'
  };

  return (
    <div className={`rounded-[22px] border p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)] ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <p className="mt-2 text-[1.4rem] font-semibold tracking-[-0.04em] text-slate-950">{value}</p>
          {detail ? <p className="mt-1 text-sm leading-6 text-slate-500">{detail}</p> : null}
        </div>
        {icon ? <div className="text-2xl">{icon}</div> : null}
      </div>
    </div>
  );
}

function StepItem({ index, title, copy, accent = false }) {
  return (
    <div className={`flex gap-4 rounded-[22px] border p-4 ${accent ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white/70'}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${accent ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'}`}>
        {index}
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">{copy}</p>
      </div>
    </div>
  );
}

function ShortcutRow({ keyText, label }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
      <span className="inline-flex min-w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-950 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
        {keyText}
      </span>
      <span className="text-sm font-medium text-slate-600">{label}</span>
    </div>
  );
}

export function PracticeRoute() {
  const navigate = useNavigate();
  const script = useScriptStore((state) => state.script);
  const scriptPreferences = useScriptStore((state) => state.scriptPreferences);
  const isPracticing = usePracticeStore((state) => state.isPracticing);
  const practicePaused = usePracticeStore((state) => state.practicePaused);
  const practiceSpeed = usePracticeStore((state) => state.practiceSpeed);
  const practiceSessionKey = usePracticeStore((state) => state.practiceSessionKey);
  const setIsPracticing = usePracticeStore((state) => state.setIsPracticing);
  const setPracticePaused = usePracticeStore((state) => state.setPracticePaused);
  const setPracticeSpeed = usePracticeStore((state) => state.setPracticeSpeed);
  const bumpPracticeSessionKey = usePracticeStore((state) => state.bumpPracticeSessionKey);
  const [isPracticeModalOpen, setIsPracticeModalOpen] = useState(false);

  const startPractice = useCallback(() => {
    bumpPracticeSessionKey();
    setIsPracticeModalOpen(true);
    setIsPracticing(true);
    setPracticePaused(false);
  }, [bumpPracticeSessionKey, setIsPracticing, setPracticePaused]);

  const endPractice = useCallback(() => {
    setIsPracticing(false);
    setPracticePaused(false);
    setIsPracticeModalOpen(false);
    bumpPracticeSessionKey();
  }, [bumpPracticeSessionKey, setIsPracticing, setPracticePaused]);

  const handleResetPracticeScroll = useCallback(() => {
    setPracticeSpeed(20);
    setPracticePaused(false);
    bumpPracticeSessionKey();
  }, [bumpPracticeSessionKey, setPracticePaused, setPracticeSpeed]);

  const handleCancelPractice = useCallback(() => {
    endPractice();
    setPracticeSpeed(20);
    void navigate({ to: '/script' });
  }, [endPractice, navigate, setPracticeSpeed]);

  const sessionStateLabel = isPracticing
    ? (practicePaused ? 'Paused' : 'Practicing')
    : 'Ready to begin';

  const sessionStateTone = isPracticing
    ? (practicePaused ? 'warn' : 'good')
    : 'neutral';

  const controlHint = 'Use Space to pause, ↑/↓ to change pace, and R to reset.';
  const practiceSteps = [
    {
      title: 'Set your pace',
      copy: 'Adjust the scroll speed before you begin. Slower pacing gives you more control over phrasing.'
    },
    {
      title: 'Open the modal',
      copy: 'Press Start Practice to launch the teleprompter in a focused overlay with controls in one place.'
    },
    {
      title: 'Stay in rhythm',
      copy: 'Pause, resume, or change speed without leaving the practice view. The teleprompter stays centered.'
    },
    {
      title: 'Reset anytime',
      copy: 'If the flow feels off, reset the scroll and start again from the top.',
      accent: true
    }
  ];

  useEffect(() => {
    if (!isPracticeModalOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        endPractice();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [endPractice, isPracticeModalOpen]);

  return (
    <MagicBackground className="flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-5 px-4 pb-36 pt-4 md:px-6 md:pb-40 md:pt-6">
        <MagicCard className="overflow-hidden p-0" hover={false}>
          <div className="bg-[linear-gradient(135deg,_rgba(255,255,255,0.92)_0%,_rgba(236,253,245,0.75)_55%,_rgba(239,246,255,0.8)_100%)] px-5 py-6 md:px-8 md:py-7">
            <MagicSectionHeader
              eyebrow="Practice Studio"
              title="Train speech, pacing, and clarity in one focused workspace"
              description="This mode is scroll-only. It opens the teleprompter in a modal and does not request microphone permission."
              right={(
                <MagicButton variant="ghost" onClick={handleCancelPractice} className="px-4">
                  Exit Practice
                </MagicButton>
              )}
            />

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <MagicBadge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                {sessionStateLabel}
              </MagicBadge>
              <MagicBadge>{script ? 'Script loaded' : 'No script loaded'}</MagicBadge>
              <MagicBadge>{`Speed ${practiceSpeed}%`}</MagicBadge>
              <MagicBadge>{controlHint}</MagicBadge>
            </div>
          </div>
        </MagicCard>

        <MagicBentoGrid className="md:grid-cols-2 xl:grid-cols-4">
          <MagicBentoCard
            title="Session"
            value={sessionStateLabel}
            description={isPracticing ? 'The scroll session is active.' : 'You can prepare before opening the modal.'}
            icon={<CheckCircle className="h-6 w-6 text-slate-700" weight="duotone" />}
          />
          <MagicBentoCard
            title="Pace"
            value={`${practiceSpeed}%`}
            description="Lower for careful delivery, higher for performance rehearsal."
            icon={<span className="text-2xl">≈</span>}
          />
          <MagicBentoCard
            title="Mode"
            value="Scroll only"
            description="No audio capture, no mic permission, no saved practice recording."
            icon={<Target className="h-6 w-6 text-slate-700" weight="duotone" />}
          />
          <MagicBentoCard
            title="Script"
            value={script ? 'Ready' : 'Empty'}
            description={script ? 'Your teleprompter content is loaded.' : 'Open Script first so practice has content.'}
            icon={<Lightbulb className="h-6 w-6 text-slate-700" weight="duotone" />}
          />
        </MagicBentoGrid>

        <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1.55fr)_380px]">
          <MagicCard className="flex min-h-[min(72vh,900px)] flex-col overflow-hidden p-0" hover={false}>
            <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 px-5 py-4 md:px-6">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700/80">Teleprompter stage</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Open the modal to practice in a focused overlay with the teleprompter controls built in.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <MagicBadge className={isPracticing ? (practicePaused ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700') : ''}>
                  {sessionStateLabel}
                </MagicBadge>
                <MagicBadge>No mic access</MagicBadge>
              </div>
            </div>

            <div className="practice-teleprompter-shell flex min-h-0 w-full flex-1 p-3 md:p-5">
              <Teleprompter
                key={practiceSessionKey}
                script={script}
                isActive={false}
                isSpeaking={false}
                audioLevel={0}
                notationPreferences={scriptPreferences}
                isPaused={practicePaused}
                onPauseChange={setPracticePaused}
                speed={practiceSpeed}
                onSpeedChange={setPracticeSpeed}
                variant="panel"
                showControls={false}
                showHints={false}
                showLiveIndicator={false}
              />
            </div>
          </MagicCard>

          <div className="flex min-h-0 flex-col gap-5">
            <MagicCard className="p-5" hover={false}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700/80">How to use it</p>
                  <h3 className="mt-2 text-[1.15rem] font-semibold tracking-[-0.03em] text-slate-950">A simple practice flow</h3>
                </div>
                <MagicBadge>4 steps</MagicBadge>
              </div>

              <div className="mt-4 space-y-3">
                {practiceSteps.map((step, index) => (
                  <StepItem
                    key={step.title}
                    index={index + 1}
                    title={step.title}
                    copy={step.copy}
                    accent={step.accent}
                  />
                ))}
              </div>
            </MagicCard>

            <MagicCard className="p-5" hover={false}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700/80">Session state</p>
                  <h3 className="mt-2 text-[1.15rem] font-semibold tracking-[-0.03em] text-slate-950">What practice does now</h3>
                </div>
                <MagicBadge className={`capitalize ${sessionStateTone === 'good' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : sessionStateTone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-700' : ''}`}>
                  {sessionStateLabel}
                </MagicBadge>
              </div>

              <div className="mt-4 grid gap-3">
                <PracticeMetric
                  label="Mode"
                  value="Scroll only"
                  detail="The practice screen does not ask for microphone permission."
                  tone="active"
                  icon={<Target className="h-6 w-6" weight="duotone" />}
                />
                <PracticeMetric
                  label="Script"
                  value={script ? 'Loaded' : 'Missing'}
                  detail={script ? 'Your teleprompter content is ready.' : 'Open Script first before starting practice.'}
                  tone={script ? 'good' : 'warn'}
                  icon={<CheckCircle className="h-6 w-6" weight="duotone" />}
                />
                <PracticeMetric
                  label="Pacing"
                  value={`${practiceSpeed}%`}
                  detail="Adjust with the dock or keyboard shortcuts."
                  tone={practiceSpeed >= 50 ? 'active' : 'neutral'}
                  icon={<span className="text-2xl">↔</span>}
                />
              </div>
            </MagicCard>

            <MagicCard className="p-5" hover={false}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700/80">Shortcuts</p>
                  <h3 className="mt-2 text-[1.15rem] font-semibold tracking-[-0.03em] text-slate-950">Stay hands-on while you practice</h3>
                </div>
                <MagicBadge>Keyboard</MagicBadge>
              </div>

              <div className="mt-4 grid gap-3">
                <ShortcutRow keyText="Space" label="Pause or resume the teleprompter" />
                <ShortcutRow keyText="↑ / ↓" label="Move the speed up or down" />
                <ShortcutRow keyText="R" label="Reset the scroll position" />
              </div>
            </MagicCard>
          </div>
        </div>
      </div>

      {!isPracticeModalOpen && (
        <div className="fixed inset-x-0 bottom-4 z-50 px-4 md:bottom-6 md:px-6">
          <MagicDock className="mx-auto w-full max-w-[1600px] rounded-[28px] px-4 py-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)] xl:items-center">
              <div className="flex flex-wrap items-center gap-3">
                <MagicBadge>Speed</MagicBadge>
                <MagicButton
                  type="button"
                  variant="secondary"
                  className="!min-h-10 !px-4 !py-2 text-sm"
                  onClick={() => setPracticeSpeed((prev) => Math.max(5, prev - 10))}
                >
                  −
                </MagicButton>
                <div className="flex min-w-[220px] flex-1 items-center gap-3">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-[width] duration-300"
                      style={{ width: `${practiceSpeed}%` }}
                    />
                  </div>
                  <span className="min-w-12 text-sm font-semibold text-slate-700">{practiceSpeed}%</span>
                </div>
                <MagicButton
                  type="button"
                  variant="secondary"
                  className="!min-h-10 !px-4 !py-2 text-sm"
                  onClick={() => setPracticeSpeed((prev) => Math.min(100, prev + 10))}
                >
                  +
                </MagicButton>
                <span className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 lg:inline-flex">
                  {controlHint}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-start gap-3 xl:justify-center">
                <MagicButton
                  onClick={startPractice}
                  disabled={!script}
                  variant="accent"
                  className="!min-h-11 !min-w-[170px] !px-5 !py-2 text-sm"
                >
                  <span>▶</span>
                  <span>Start Practice</span>
                </MagicButton>
                <MagicButton
                  type="button"
                  variant={practicePaused ? 'secondary' : 'accent'}
                  className="!min-h-11 !min-w-[132px] !px-4 !py-2 text-sm"
                  onClick={() => setPracticePaused(!practicePaused)}
                  disabled={!isPracticing}
                  aria-pressed={practicePaused}
                  aria-label={practicePaused ? 'Resume practice' : 'Pause practice'}
                >
                  <span>{practicePaused ? '▶' : '⏸'}</span>
                  <span>{practicePaused ? 'Resume' : 'Pause'}</span>
                </MagicButton>
              </div>

              <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                <MagicButton
                  type="button"
                  variant="secondary"
                  className="!min-h-11 !px-4 !py-2 text-sm"
                  onClick={handleResetPracticeScroll}
                >
                  <span>↺</span>
                  <span>Reset</span>
                </MagicButton>
                <MagicButton
                  type="button"
                  variant="ghost"
                  className="!min-h-11 !px-4 !py-2 text-sm"
                  onClick={handleCancelPractice}
                >
                  Exit Practice
                </MagicButton>
              </div>
            </div>
          </MagicDock>
        </div>
      )}

      {isPracticeModalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[1000] bg-slate-950/45 px-4 py-4 backdrop-blur-md md:px-6 md:py-6"
              onClick={endPractice}
              role="presentation"
            >
              <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-center">
                <MagicCard
                  className="flex h-full max-h-[92vh] w-full max-w-[1440px] flex-col overflow-hidden p-0"
                  hover={false}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 px-5 py-4 md:px-6">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700/80">Practice modal</p>
                      <h3 className="mt-2 text-[1.2rem] font-semibold tracking-[-0.03em] text-slate-950">
                        Teleprompter is live
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">
                        Scroll-only practice. No microphone permission is requested here.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <MagicButton variant="secondary" onClick={endPractice} className="px-4">
                        Close practice
                      </MagicButton>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 p-3 md:p-5">
                    <div className="practice-teleprompter-shell flex min-h-0 w-full flex-1">
                      <Teleprompter
                        key={`modal-${practiceSessionKey}`}
                        script={script}
                        isActive={isPracticeModalOpen}
                        isSpeaking={false}
                        audioLevel={0}
                        notationPreferences={scriptPreferences}
                        isPaused={practicePaused}
                        onPauseChange={setPracticePaused}
                        speed={practiceSpeed}
                        onSpeedChange={setPracticeSpeed}
                        variant="overlay"
                        showControls
                        showHints
                        showLiveIndicator={false}
                      />
                    </div>
                  </div>
                </MagicCard>
              </div>
            </div>,
            document.body,
          )
        : null}
    </MagicBackground>
  );
}

export default PracticeRoute;
