import { ArrowClockwise, CheckCircle, Clock, Export, WarningCircle } from '@phosphor-icons/react';
import { buildInterviewReplayTurns, parseInterviewAnalysisSections } from '../utils/interviewArchive';
import { MagicBadge, MagicButton, MagicCard, MagicSectionHeader } from './ui/MagicUI';

function getAnalysisText(session) {
  return String(
    session?.raw?.analysisTranscript
    || session?.liveDiagnostics?.analysisTranscript
    || session?.sessionSummary?.analysisTranscript
    || ''
  ).trim();
}

function AnalysisCopy({ text }) {
  const sections = parseInterviewAnalysisSections(text);
  if (sections.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sections.map((section, index) => (
        <section key={`${index}-${section.title}`} className="rounded-[22px] border border-slate-200 bg-white/75 p-5">
          <h3 className="text-sm font-semibold text-slate-950">{section.title}</h3>
          <div className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{section.body || 'No additional detail was provided.'}</div>
        </section>
      ))}
    </div>
  );
}

export function InterviewCompletion({
  analysisState = 'running',
  analysisError = '',
  session = null,
  onRetry,
  onPracticeAgain,
  onExport
}) {
  const turns = buildInterviewReplayTurns(session || {}).filter((turn) => turn.assistantText || turn.transcript);
  const analysisText = getAnalysisText(session);
  const completed = analysisState === 'completed' && Boolean(session);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 py-4">
      <MagicCard className="overflow-hidden p-0" hover={false}>
        <div className="bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.78),rgba(239,246,255,0.72))] p-6 md:p-8">
          <MagicSectionHeader
            eyebrow="Interview complete"
            title={completed ? 'Your coaching report is ready' : analysisState === 'failed' ? 'Your interview is safe' : 'Turning the conversation into coaching'}
            description={completed
              ? 'Review the evidence below, then repeat the setup to apply the feedback in another conversation.'
              : analysisState === 'failed'
                ? 'The live session ended successfully, but the report could not be completed. Retry without repeating the interview.'
                : 'We are reviewing your responses, structure, and conversational choices. This usually takes less than a minute.'}
            right={(
              <MagicBadge className={completed ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : analysisState === 'failed' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-sky-200 bg-sky-50 text-sky-700'}>
                {completed ? 'Report ready' : analysisState === 'failed' ? 'Needs retry' : 'Analyzing'}
              </MagicBadge>
            )}
          />

          {analysisState === 'running' ? (
            <div className="mt-6 overflow-hidden rounded-full bg-white/80">
              <div className="h-2 w-2/3 animate-pulse rounded-full bg-slate-900" />
            </div>
          ) : null}
        </div>
      </MagicCard>

      {analysisState === 'failed' ? (
        <MagicCard className="p-6" hover={false}>
          <div className="flex items-start gap-3 text-rose-700" role="alert">
            <WarningCircle size={24} className="mt-0.5 shrink-0" />
            <div>
              <h2 className="font-semibold">Analysis did not finish</h2>
              <p className="mt-1 text-sm leading-6">{analysisError || 'The Worker did not complete the report in time.'}</p>
            </div>
          </div>
          <MagicButton className="mt-5" onClick={onRetry}><ArrowClockwise size={18} /> Retry analysis</MagicButton>
        </MagicCard>
      ) : null}

      {completed ? (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <MagicCard className="p-5" hover={false}>
              <CheckCircle size={22} className="text-emerald-600" weight="fill" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Conversation turns</p>
              <p className="mt-1 text-3xl font-semibold text-slate-950">{turns.length}</p>
            </MagicCard>
            <MagicCard className="p-5" hover={false}>
              <Clock size={22} className="text-sky-600" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Session</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{session?.config?.duration || 10} minute format</p>
            </MagicCard>
            <MagicCard className="p-5" hover={false}>
              <CheckCircle size={22} className="text-violet-600" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Target</p>
              <p className="mt-1 text-lg font-semibold text-slate-950">{session?.config?.college || 'MBA interview'}</p>
            </MagicCard>
          </section>

          <MagicCard className="p-6 md:p-8" hover={false}>
            <MagicSectionHeader eyebrow="Coach review" title="What to carry into the next round" />
            {analysisText ? <div className="mt-6"><AnalysisCopy text={analysisText} /></div> : (
              <p className="mt-5 text-sm text-slate-600">The report completed without a readable analysis transcript. Export the session for diagnostics.</p>
            )}
          </MagicCard>

          {turns.length > 0 ? (
            <MagicCard className="p-6 md:p-8" hover={false}>
              <MagicSectionHeader eyebrow="Conversation evidence" title="Review the exchange" description="Use the exact prompts and transcript excerpts to connect coaching advice to what happened." />
              <div className="mt-6 space-y-4">
                {turns.slice(0, 12).map((turn, index) => (
                  <article key={`${turn.turnIndex}-${index}`} className="rounded-[22px] border border-slate-200 bg-white/75 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Turn {index + 1}</p>
                    {turn.assistantText ? <p className="mt-3 font-semibold leading-6 text-slate-950">{turn.assistantText}</p> : null}
                    {turn.transcript ? <p className="mt-3 border-l-2 border-slate-200 pl-4 text-sm leading-6 text-slate-600">{turn.transcript}</p> : null}
                  </article>
                ))}
              </div>
            </MagicCard>
          ) : null}

          <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:justify-end">
            <MagicButton variant="secondary" onClick={onExport}><Export size={18} /> Export report</MagicButton>
            <MagicButton onClick={onPracticeAgain}>Practice this setup again</MagicButton>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default InterviewCompletion;
