import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRight, CheckCircle, FileText, MicrophoneStage, Sparkle } from '@phosphor-icons/react';
import { MagicBadge, MagicButton, MagicSelect } from './ui/MagicUI';
import { buildNextPracticeRecommendation, savePracticeGoal } from '../utils/practiceGoals';
import { startPracticeDrill } from '../utils/practiceDrills';
import { saveOnboardingState } from '../utils/onboarding';
import { trackBetaEvent } from '../utils/betaTelemetry';

const GOALS = [
  {
    value: 'script',
    title: 'Write and deliver clearly',
    description: 'Turn an idea into a structured script, then rehearse it.',
    icon: FileText
  },
  {
    value: 'interview',
    title: 'Become interview-ready',
    description: 'Practice realistic questions and review grounded feedback.',
    icon: MicrophoneStage
  },
  {
    value: 'extempore',
    title: 'Think confidently on the spot',
    description: 'Build structured answers without a prepared script.',
    icon: Sparkle
  },
  {
    value: 'balanced',
    title: 'Build all-round speaking confidence',
    description: 'Rotate across writing, interviews, and spontaneous speaking.',
    icon: CheckCircle
  }
];

const MODE_DETAILS = {
  script: { label: 'Script', path: '/script', time: 'About 5 minutes' },
  interview: { label: 'Interview', path: '/interview', time: 'About 10 minutes' },
  extempore: { label: 'Extempore', path: '/extempore', time: 'About 3 minutes' }
};

export function OnboardingDialog({ onClose }) {
  const dialogRef = useRef(null);
  const navigate = useNavigate();
  const [step, setStep] = useState('goal');
  const [focusMode, setFocusMode] = useState('balanced');
  const [weeklyTarget, setWeeklyTarget] = useState(3);
  const recommendation = useMemo(
    () => buildNextPracticeRecommendation([], { focusMode, weeklyTarget }),
    [focusMode, weeklyTarget]
  );
  const mode = MODE_DETAILS[recommendation.mode];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    dialog.showModal();
    const handleCancel = (event) => {
      event.preventDefault();
      saveOnboardingState({ status: 'dismissed' });
      void trackBetaEvent('onboarding_dismissed');
      onClose();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      if (dialog.open) dialog.close();
    };
  }, [onClose]);

  const skip = () => {
    saveOnboardingState({ status: 'dismissed' });
    void trackBetaEvent('onboarding_dismissed');
    onClose();
  };

  const createPlan = () => {
    savePracticeGoal({ focusMode, weeklyTarget });
    saveOnboardingState({ status: 'completed' });
    void trackBetaEvent('onboarding_completed', { mode: focusMode });
    setStep('ready');
  };

  const startFirstSession = () => {
    startPracticeDrill(recommendation);
    onClose();
    void navigate({ to: mode.path });
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="onboarding-title"
      className="m-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-[30px] border border-slate-200 bg-white/95 p-0 text-slate-950 shadow-[0_32px_100px_rgba(15,23,42,0.24)] backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm"
    >
      <div className="p-6 sm:p-8 md:p-10">
        {step === 'goal' ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <MagicBadge className="border-emerald-200 bg-emerald-50 text-emerald-700">Your private practice plan</MagicBadge>
                <h1 id="onboarding-title" className="mt-5 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">What would you most like to improve?</h1>
                <p className="mt-3 text-sm leading-6 text-slate-600">Choose a starting point. Your plan and activity stay in this browser—no account required.</p>
              </div>
              <button type="button" onClick={skip} className="rounded-full px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">
                Skip for now
              </button>
            </div>

            <fieldset className="mt-7 grid gap-3 md:grid-cols-2">
              <legend className="sr-only">Primary speaking goal</legend>
              {GOALS.map((goal) => {
                const Icon = goal.icon;
                const selected = focusMode === goal.value;
                return (
                  <label key={goal.value} className={`flex cursor-pointer gap-4 rounded-[22px] border p-5 transition focus-within:ring-2 focus-within:ring-emerald-500/40 ${selected ? 'border-emerald-400 bg-emerald-50/70' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    <input className="sr-only" type="radio" name="practice-goal" value={goal.value} checked={selected} onChange={() => setFocusMode(goal.value)} />
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${selected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`} aria-hidden="true"><Icon size={22} /></span>
                    <span>
                      <span className="block font-semibold text-slate-950">{goal.title}</span>
                      <span className="mt-1 block text-sm leading-5 text-slate-500">{goal.description}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="mt-7 flex flex-col gap-4 rounded-[22px] bg-slate-50 p-5 sm:flex-row sm:items-end sm:justify-between">
              <label className="text-sm font-medium text-slate-700">
                Sessions per week
                <MagicSelect className="mt-2 min-w-48 bg-white" value={String(weeklyTarget)} onChange={(event) => setWeeklyTarget(Number(event.target.value))}>
                  <option value="2">2 · gentle start</option>
                  <option value="3">3 · recommended</option>
                  <option value="5">5 · focused routine</option>
                </MagicSelect>
              </label>
              <MagicButton onClick={createPlan}>Build my practice plan <ArrowRight size={18} /></MagicButton>
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-2xl py-4 text-center sm:py-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-emerald-100 text-emerald-700" aria-hidden="true"><CheckCircle size={34} weight="fill" /></div>
            <MagicBadge className="mt-6 border-emerald-200 bg-emerald-50 text-emerald-700">Plan ready · {weeklyTarget} sessions per week</MagicBadge>
            <h1 id="onboarding-title" className="mt-5 text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">Start with {mode.label}</h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600">{recommendation.text}</p>
            <p className="mt-3 text-sm font-medium text-slate-500">{mode.time} · You can change this plan anytime in History</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <MagicButton onClick={startFirstSession}>Start first session <ArrowRight size={18} /></MagicButton>
              <MagicButton variant="secondary" onClick={onClose}>Explore on my own</MagicButton>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
