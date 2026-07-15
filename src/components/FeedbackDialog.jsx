import { useEffect, useRef, useState } from 'react';
import { CheckCircle, ChatCircleDots, ThumbsDown, ThumbsUp } from '@phosphor-icons/react';
import { MagicButton, MagicSelect, MagicTextarea } from './ui/MagicUI';
import { submitBetaFeedback } from '../utils/betaFeedback';

const MODE_LABELS = { script: 'Script', interview: 'Interview', extempore: 'Extempore' };

export function FeedbackDialog({ target, onClose, onSubmitted }) {
  const dialogRef = useRef(null);
  const [sentiment, setSentiment] = useState(target.sentiment || '');
  const [category, setCategory] = useState(target.kind === 'session' ? 'session_quality' : 'feature_request');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    dialog.showModal();
    const handleCancel = (event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      if (dialog.open) dialog.close();
    };
  }, [onClose]);

  const submit = async (event) => {
    event.preventDefault();
    if (target.kind === 'session' && !sentiment) {
      setError('Choose whether this session was helpful.');
      return;
    }
    setStatus('submitting');
    setError('');
    try {
      const result = await submitBetaFeedback({
        kind: target.kind,
        sentiment,
        category,
        mode: target.activity?.mode || '',
        activityId: target.activity?.id || '',
        message
      });
      setStatus(result.status);
      onSubmitted(result);
    } catch (submitError) {
      setStatus('idle');
      setError(submitError?.message || 'Feedback could not be saved.');
    }
  };

  const completed = status === 'sent' || status === 'queued';
  const heading = target.kind === 'session'
    ? `How was this ${MODE_LABELS[target.activity?.mode] || 'practice'} session?`
    : 'Help shape the beta';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="feedback-title"
      className="m-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-0 text-slate-950 shadow-[0_32px_100px_rgba(15,23,42,0.24)] backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm"
    >
      <div className="p-6 sm:p-8">
        {completed ? (
          <div className="py-4 text-center" role="status">
            <CheckCircle size={42} className="mx-auto text-emerald-600" weight="fill" aria-hidden="true" />
            <h2 id="feedback-title" className="mt-4 text-2xl font-semibold tracking-[-0.04em]">Thank you—feedback saved.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {status === 'sent' ? 'Your anonymous feedback was sent.' : 'You are offline, so this was queued in your browser and will retry later.'}
            </p>
            <MagicButton className="mt-6" onClick={onClose}>Done</MagicButton>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <ChatCircleDots size={28} className="text-emerald-700" aria-hidden="true" />
                <h2 id="feedback-title" className="mt-4 text-2xl font-semibold tracking-[-0.04em]">{heading}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">A quick signal helps prioritize what to improve next.</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-full px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">Close</button>
            </div>

            {target.kind === 'session' ? (
              <fieldset className="mt-6">
                <legend className="text-sm font-semibold text-slate-800">Was this session useful?</legend>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button type="button" aria-pressed={sentiment === 'helpful'} onClick={() => setSentiment('helpful')} className={`flex min-h-14 items-center justify-center gap-2 rounded-[18px] border font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${sentiment === 'helpful' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><ThumbsUp size={20} /> Helpful</button>
                  <button type="button" aria-pressed={sentiment === 'not_helpful'} onClick={() => setSentiment('not_helpful')} className={`flex min-h-14 items-center justify-center gap-2 rounded-[18px] border font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${sentiment === 'not_helpful' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><ThumbsDown size={20} /> Needs work</button>
                </div>
              </fieldset>
            ) : null}

            <label className="mt-5 block text-sm font-semibold text-slate-800">
              Feedback type
              <MagicSelect className="mt-2" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="session_quality">Session quality</option>
                <option value="technical_issue">Technical issue</option>
                <option value="feature_request">Feature request</option>
                <option value="other">Something else</option>
              </MagicSelect>
            </label>

            <label className="mt-5 block text-sm font-semibold text-slate-800">
              Optional note
              <MagicTextarea className="mt-2 min-h-32" maxLength={1000} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What worked, failed, or would make this more useful?" />
            </label>
            <p className="mt-3 text-xs leading-5 text-slate-500">Only this rating, category, mode, and note are sent. Audio, transcripts, scripts, answers, and profile details are never included.</p>
            {error ? <p className="mt-3 text-sm font-medium text-rose-600" role="alert">{error}</p> : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <MagicButton type="button" variant="secondary" onClick={onClose}>Cancel</MagicButton>
              <MagicButton type="submit" disabled={status === 'submitting'}>{status === 'submitting' ? 'Sending…' : 'Send anonymous feedback'}</MagicButton>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
