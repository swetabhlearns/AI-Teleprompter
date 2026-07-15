import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Microphone, SpeakerHigh, WarningCircle, WifiHigh } from '@phosphor-icons/react';
import { workerApi } from '../api/workerClient';
import {
  getBrowserMediaReadiness,
  getPreflightSummary,
  PREFLIGHT_STATUS,
  stopMediaStream
} from '../utils/interviewPreflight';
import { MagicBadge, MagicButton, MagicCard, MagicSectionHeader } from './ui/MagicUI';

const INITIAL_CHECKS = {
  browser: { status: PREFLIGHT_STATUS.IDLE, message: 'Checking browser audio support…' },
  worker: { status: PREFLIGHT_STATUS.IDLE, message: 'Checking the interview service…' },
  microphone: { status: PREFLIGHT_STATUS.IDLE, message: 'Microphone permission has not been checked.' },
  speaker: { status: PREFLIGHT_STATUS.IDLE, message: 'Play a short tone to confirm you can hear audio.' }
};

function CheckRow({ icon, title, check, action }) {
  const tone = {
    [PREFLIGHT_STATUS.PASSED]: 'border-emerald-200 bg-emerald-50/70',
    [PREFLIGHT_STATUS.FAILED]: 'border-rose-200 bg-rose-50/70',
    [PREFLIGHT_STATUS.CHECKING]: 'border-sky-200 bg-sky-50/70',
    [PREFLIGHT_STATUS.IDLE]: 'border-slate-200 bg-white/75'
  }[check.status];

  return (
    <div className={`flex flex-col gap-3 rounded-[22px] border p-4 sm:flex-row sm:items-center sm:justify-between ${tone}`}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-800 shadow-sm">
          {check.status === PREFLIGHT_STATUS.PASSED ? <CheckCircle size={21} weight="fill" className="text-emerald-600" /> : icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-950">{title}</p>
          <p className="mt-1 text-sm leading-5 text-slate-600">{check.message}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

export function InterviewPreflight({ config, onClose, onBegin, isStarting = false }) {
  const [checks, setChecks] = useState(INITIAL_CHECKS);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const initialChecksStartedRef = useRef(false);
  const summary = useMemo(() => getPreflightSummary(checks), [checks]);

  const updateCheck = useCallback((key, next) => {
    setChecks((current) => ({ ...current, [key]: { ...current[key], ...next } }));
  }, []);

  const checkWorker = useCallback(async () => {
    updateCheck('worker', { status: PREFLIGHT_STATUS.CHECKING, message: 'Contacting the interview service…' });
    try {
      const health = await workerApi.getHealth();
      if (health?.status !== 'healthy') throw new Error('The interview service is responding but not healthy.');
      updateCheck('worker', { status: PREFLIGHT_STATUS.PASSED, message: 'Interview service is healthy.' });
    } catch (error) {
      updateCheck('worker', {
        status: PREFLIGHT_STATUS.FAILED,
        message: error?.message || 'The interview service could not be reached.'
      });
    }
  }, [updateCheck]);

  const checkMicrophone = useCallback(async () => {
    updateCheck('microphone', { status: PREFLIGHT_STATUS.CHECKING, message: 'Waiting for microphone permission…' });
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks()[0];
      updateCheck('microphone', {
        status: PREFLIGHT_STATUS.PASSED,
        message: track?.label ? `Microphone ready: ${track.label}` : 'Microphone permission granted.'
      });
    } catch (error) {
      const denied = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError';
      updateCheck('microphone', {
        status: PREFLIGHT_STATUS.FAILED,
        message: denied
          ? 'Microphone access was blocked. Allow it in browser settings, then retry.'
          : (error?.message || 'No working microphone could be opened.')
      });
    } finally {
      stopMediaStream(stream);
    }
  }, [updateCheck]);

  const testSpeaker = useCallback(async () => {
    updateCheck('speaker', { status: PREFLIGHT_STATUS.CHECKING, message: 'Playing a short confirmation tone…' });
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 523.25;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.38);
      await new Promise((resolve) => setTimeout(resolve, 450));
      await context.close();
      updateCheck('speaker', { status: PREFLIGHT_STATUS.PASSED, message: 'Speaker test completed.' });
    } catch (error) {
      updateCheck('speaker', { status: PREFLIGHT_STATUS.FAILED, message: error?.message || 'The speaker test could not play.' });
    }
  }, [updateCheck]);

  useEffect(() => {
    if (initialChecksStartedRef.current) return;
    initialChecksStartedRef.current = true;
    updateCheck('browser', getBrowserMediaReadiness(window));
    void checkWorker();
  }, [checkWorker, updateCheck]);

  return (
    <div className="flex flex-1 items-center justify-center py-4">
      <MagicCard className="w-full max-w-3xl overflow-hidden p-0" hover={false}>
        <div className="border-b border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.82))] p-6 md:p-8">
          <MagicSectionHeader
            eyebrow="Private ready room"
            title="Make sure the conversation can flow"
            description="We will confirm your browser, microphone, speaker, and interview service before opening the live session."
            right={<MagicBadge>{summary.passed} of {summary.total} ready</MagicBadge>}
          />
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-600">
            <MagicBadge>{config?.college || 'School not selected'}</MagicBadge>
            <MagicBadge>{config?.duration || 10} minutes</MagicBadge>
            <MagicBadge>{config?.profile?.name || 'Candidate'}</MagicBadge>
          </div>
        </div>

        <div className="space-y-3 p-6 md:p-8">
          <label className="flex cursor-pointer gap-3 rounded-[18px] border border-sky-200 bg-sky-50/70 px-4 py-3 text-sm text-slate-700">
            <input type="checkbox" className="mt-1 size-4" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} />
            <span>I understand that microphone audio is sent to Gemini and Groq for the live conversation and transcription. Raw audio is not stored; transcripts and analysis are stored until I delete them.</span>
          </label>
          <CheckRow title="Browser audio" icon={<CheckCircle size={21} />} check={checks.browser} />
          <CheckRow
            title="Interview service"
            icon={<WifiHigh size={21} />}
            check={checks.worker}
            action={checks.worker.status === PREFLIGHT_STATUS.FAILED ? <MagicButton variant="secondary" onClick={checkWorker}>Retry</MagicButton> : null}
          />
          <CheckRow
            title="Microphone"
            icon={<Microphone size={21} />}
            check={checks.microphone}
            action={checks.microphone.status !== PREFLIGHT_STATUS.PASSED ? <MagicButton variant="secondary" onClick={checkMicrophone} disabled={!consentAccepted || checks.microphone.status === PREFLIGHT_STATUS.CHECKING}>{checks.microphone.status === PREFLIGHT_STATUS.FAILED ? 'Retry' : 'Check microphone'}</MagicButton> : null}
          />
          <CheckRow
            title="Speaker"
            icon={<SpeakerHigh size={21} />}
            check={checks.speaker}
            action={<MagicButton variant="secondary" onClick={testSpeaker} disabled={checks.speaker.status === PREFLIGHT_STATUS.CHECKING}>Play test tone</MagicButton>}
          />

          {summary.failed > 0 ? (
            <div className="flex gap-3 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
              <WarningCircle size={20} className="mt-0.5 shrink-0" />
              Resolve the failed check before starting. Your setup choices are safe and will remain here.
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <MagicButton variant="secondary" onClick={onClose} disabled={isStarting}>Back to setup</MagicButton>
            <MagicButton onClick={onBegin} disabled={!consentAccepted || !summary.isReady || isStarting} className="!min-w-48">
              {isStarting ? 'Opening live session…' : 'Enter interview'}
            </MagicButton>
          </div>
        </div>
      </MagicCard>
    </div>
  );
}

export default InterviewPreflight;
