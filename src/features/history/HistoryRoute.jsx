import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRight, ChatCircleDots, CheckCircle, ClockCounterClockwise, Fire, MagnifyingGlass, ThumbsDown, ThumbsUp, Trash, TrendUp } from '@phosphor-icons/react';
import { MagicBadge, MagicButton, MagicCard, MagicInput, MagicSectionHeader, MagicSelect } from '../../components/ui/MagicUI';
import { FeedbackDialog } from '../../components/FeedbackDialog';
import { flushQueuedFeedback, loadFeedbackReceipts } from '../../utils/betaFeedback';
import { clearPracticeHistory, loadPracticeActivities, PRACTICE_HISTORY_EVENT, summarizePracticeActivities } from '../../utils/practiceHistory';
import { buildNextPracticeRecommendation, loadPracticeGoal, savePracticeGoal } from '../../utils/practiceGoals';
import { buildPracticeProfile } from '../../utils/practiceProfile';
import { loadPracticeDrills, startPracticeDrill, summarizePracticeDrills } from '../../utils/practiceDrills';

const MODE_LABELS = { script: 'Script', interview: 'Interview', extempore: 'Extempore' };
const MODE_PATHS = { script: '/script', interview: '/interview', extempore: '/extempore' };

function formatDate(value) {
  if (!value) return 'Recently';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatTrend(trend) {
  if (trend.current > 0 && trend.previous === 0) return 'New this week';
  if (trend.delta === 0) return 'Same as prior week';
  return `${trend.delta > 0 ? '+' : ''}${trend.delta} vs prior week`;
}

export function HistoryRoute() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState(loadPracticeActivities);
  const [query, setQuery] = useState('');
  const [modeFilter, setModeFilter] = useState('all');
  const [goal, setGoal] = useState(loadPracticeGoal);
  const [drills, setDrills] = useState(loadPracticeDrills);
  const [feedbackTarget, setFeedbackTarget] = useState(null);
  const [feedbackReceipts, setFeedbackReceipts] = useState(loadFeedbackReceipts);
  const closeFeedback = useCallback(() => setFeedbackTarget(null), []);
  const refreshFeedbackReceipts = useCallback(() => setFeedbackReceipts(loadFeedbackReceipts()), []);
  const totals = useMemo(() => activities.reduce((result, item) => ({
    ...result,
    [item.mode]: (result[item.mode] || 0) + 1
  }), {}), [activities]);
  const insights = useMemo(() => summarizePracticeActivities(activities), [activities]);
  const recommendation = useMemo(() => buildNextPracticeRecommendation(activities, goal), [activities, goal]);
  const profile = useMemo(() => buildPracticeProfile(activities), [activities]);
  const drillSummary = useMemo(() => summarizePracticeDrills(drills), [drills]);
  const completedDrills = useMemo(() => drills.filter((drill) => drill.status === 'completed').slice(0, 3), [drills]);
  const weeklyProgress = Math.min(100, Math.round((insights.recentCount / goal.weeklyTarget) * 100));
  const sessionsRemaining = Math.max(0, goal.weeklyTarget - insights.recentCount);
  const filteredActivities = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return activities.filter((activity) => {
      if (modeFilter !== 'all' && activity.mode !== modeFilter) return false;
      if (!normalizedQuery) return true;
      return `${activity.title || ''} ${activity.summary || ''}`.toLowerCase().includes(normalizedQuery);
    });
  }, [activities, modeFilter, query]);

  useEffect(() => {
    const refresh = () => {
      setActivities(loadPracticeActivities());
      setDrills(loadPracticeDrills());
    };
    window.addEventListener(PRACTICE_HISTORY_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(PRACTICE_HISTORY_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    void flushQueuedFeedback().then(refreshFeedbackReceipts);
  }, [refreshFeedbackReceipts]);

  const handleClear = () => {
    if (!window.confirm('Clear the activity index from this browser? Your saved interview reports and scripts will not be deleted.')) return;
    clearPracticeHistory();
    setActivities([]);
  };

  const openActivity = (activity) => {
    if (activity.mode === 'interview' && activity.referenceId) {
      void navigate({ to: '/interview', search: { report: activity.referenceId } });
      return;
    }
    void navigate({ to: MODE_PATHS[activity.mode] || '/' });
  };

  const updateGoal = (patch) => {
    const next = savePracticeGoal({ ...goal, ...patch });
    setGoal(next);
  };

  const startRecommendedDrill = () => {
    const drill = startPracticeDrill(recommendation);
    if (drill) setDrills(loadPracticeDrills());
    void navigate({ to: MODE_PATHS[recommendation.mode] });
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-4">
      <MagicCard className="p-6 md:p-8" hover={false}>
        <MagicSectionHeader
          eyebrow="Practice history"
          title="Your improvement trail"
          description="A lightweight index of work completed in this browser. Full scripts and interview reports stay in their existing libraries."
          right={(
            <div className="flex flex-wrap items-center justify-end gap-2">
              <MagicBadge>{activities.length} activities</MagicBadge>
              <MagicButton className="!min-h-10 !px-4 !py-2" variant="secondary" onClick={() => setFeedbackTarget({ kind: 'beta' })}><ChatCircleDots size={17} /> Share feedback</MagicButton>
            </div>
          )}
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {Object.entries(MODE_LABELS).map(([mode, label]) => (
            <div key={mode} className="rounded-[20px] border border-slate-200 bg-white/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">{totals[mode] || 0}</p>
            </div>
          ))}
        </div>
        {activities.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[20px] bg-slate-950 p-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Current streak</p>
              <p className="mt-2 text-2xl font-semibold">{insights.currentStreak} day{insights.currentStreak === 1 ? '' : 's'}</p>
              <p className="mt-1 text-xs text-slate-300">Best: {insights.bestStreak} day{insights.bestStreak === 1 ? '' : 's'}</p>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-white/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Last 7 days</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{insights.recentCount}</p>
              <p className="mt-1 text-xs text-slate-500">{insights.recentDelta >= 0 ? '+' : ''}{insights.recentDelta} vs prior week</p>
            </div>
            <div className="rounded-[20px] border border-slate-200 bg-white/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Most practiced</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{MODE_LABELS[insights.mostPracticedMode] || '—'}</p>
            </div>
          </div>
        ) : null}
      </MagicCard>

      <MagicCard className="p-6 md:p-8" hover={false}>
        <MagicSectionHeader
          eyebrow="Weekly practice goal"
          title={sessionsRemaining === 0 ? 'Goal reached—choose the next deliberate rep' : `${sessionsRemaining} session${sessionsRemaining === 1 ? '' : 's'} to go`}
          description="Progress is based on completed activities in the last seven days, not an artificial quality score."
          right={<MagicBadge>{insights.recentCount} / {goal.weeklyTarget} · {drillSummary.completedCount} drills followed through</MagicBadge>}
        />
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${weeklyProgress}% of weekly practice goal completed`}>
          <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${weeklyProgress}%` }} />
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[0.7fr_0.7fr_1.6fr]">
          <label className="text-sm font-medium text-slate-700">
            Sessions per week
            <MagicSelect className="mt-2" value={String(goal.weeklyTarget)} onChange={(event) => updateGoal({ weeklyTarget: Number(event.target.value) })}>
              {[1, 2, 3, 4, 5, 6, 7].map((value) => <option key={value} value={value}>{value}</option>)}
            </MagicSelect>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Focus
            <MagicSelect className="mt-2" value={goal.focusMode} onChange={(event) => updateGoal({ focusMode: event.target.value })}>
              <option value="balanced">Balanced</option>
              <option value="script">Script</option>
              <option value="interview">Interview</option>
              <option value="extempore">Extempore</option>
            </MagicSelect>
          </label>
          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Next deliberate rep · {MODE_LABELS[recommendation.mode]}</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">{recommendation.text}</p>
            <p className="mt-3 text-xs leading-5 text-emerald-800"><span className="font-semibold">Why this:</span> {recommendation.reason}</p>
            {drillSummary.active ? (
              <p className="mt-3 text-xs font-medium text-emerald-800">Active drill: {MODE_LABELS[drillSummary.active.mode]} · started {formatDate(drillSummary.active.startedAt)}</p>
            ) : null}
            <MagicButton className="mt-4 !min-h-10 !px-4 !py-2" onClick={startRecommendedDrill}>{drillSummary.active?.mode === recommendation.mode ? 'Continue this drill' : 'Start this drill'} <ArrowRight size={17} /></MagicButton>
          </div>
        </div>
      </MagicCard>

      {activities.length > 0 ? (
        <MagicCard className="p-6 md:p-8" hover={false}>
          <MagicSectionHeader
            eyebrow="Practice momentum"
            title="Consistency and follow-through"
            description="A factual view of completed practice. Weekly comparisons use session counts and do not imply a quality score."
            right={<MagicBadge>{insights.activeDays} active day{insights.activeDays === 1 ? '' : 's'} overall</MagicBadge>}
          />
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <section aria-labelledby="mode-trends-title">
              <div className="flex items-center gap-2">
                <TrendUp size={20} className="text-emerald-700" aria-hidden="true" />
                <h3 id="mode-trends-title" className="font-semibold text-slate-950">Mode rhythm</h3>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {Object.entries(MODE_LABELS).map(([mode, label]) => {
                  const trend = insights.modeTrends[mode];
                  return (
                    <div key={mode} className="rounded-[20px] border border-slate-200 bg-white/75 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
                      <p className="mt-3 text-3xl font-semibold text-slate-950">{trend.current}</p>
                      <p className={`mt-1 text-xs ${trend.delta > 0 ? 'font-medium text-emerald-700' : 'text-slate-500'}`}>{formatTrend(trend)}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-slate-950 px-5 py-4 text-white">
                <Fire size={22} className="shrink-0 text-amber-300" weight="fill" aria-hidden="true" />
                <p className="text-sm leading-6"><span className="font-semibold">{insights.currentStreak}-day current streak.</span> Your longest run is {insights.bestStreak} day{insights.bestStreak === 1 ? '' : 's'}.</p>
              </div>
            </section>

            <section aria-labelledby="follow-through-title" className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 id="follow-through-title" className="font-semibold text-slate-950">Drill follow-through</h3>
                <MagicBadge>{drillSummary.completedCount} completed</MagicBadge>
              </div>
              {completedDrills.length > 0 ? (
                <ol className="mt-4 space-y-3">
                  {completedDrills.map((drill) => (
                    <li key={drill.id} className="flex gap-3 rounded-[18px] bg-white p-4">
                      <CheckCircle size={20} className="mt-0.5 shrink-0 text-emerald-600" weight="fill" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">{MODE_LABELS[drill.mode] || drill.mode}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-700">{drill.text}</p>
                        <p className="mt-2 text-xs text-slate-400">Completed {formatDate(drill.completedAt)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="mt-4 rounded-[18px] border border-dashed border-slate-200 bg-white px-4 py-6 text-sm leading-6 text-slate-500">
                  Start the recommended drill, then complete an activity in that mode to record follow-through.
                </div>
              )}
            </section>
          </div>
        </MagicCard>
      ) : null}

      {activities.length > 0 ? (
        <MagicCard className="p-6 md:p-8" hover={false}>
          <MagicSectionHeader
            eyebrow="Personal practice profile"
            title={profile.recurringThemes.length > 0 ? 'Patterns worth another deliberate rep' : 'Your coaching patterns are taking shape'}
            description="Built only from coaching notes saved in this browser. Themes show repetition, not a quality score or diagnosis."
            right={<MagicBadge>{profile.coverage} / 3 modes explored</MagicBadge>}
          />
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {profile.topThemes.length > 0 ? profile.topThemes.map((theme) => (
              <div key={theme.id} className="rounded-[22px] border border-slate-200 bg-white/75 p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-950">{theme.label}</p>
                  <MagicBadge>{theme.count} note{theme.count === 1 ? '' : 's'}</MagicBadge>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {theme.count >= 2
                    ? `This theme has repeated across ${theme.modes.length} practice mode${theme.modes.length === 1 ? '' : 's'}.`
                    : 'One coaching note so far—another session will show whether it is a pattern.'}
                </p>
              </div>
            )) : (
              <div className="rounded-[22px] border border-dashed border-slate-200 p-5 text-sm leading-6 text-slate-500 md:col-span-3">
                Complete sessions with coaching feedback to reveal recurring themes here.
              </div>
            )}
          </div>
        </MagicCard>
      ) : null}

      {activities.length === 0 ? (
        <MagicCard className="p-8 text-center" hover={false}>
          <ClockCounterClockwise size={32} className="mx-auto text-slate-400" />
          <h2 className="mt-4 text-xl font-semibold text-slate-950">Your next session starts the trail</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Save a script, finish an interview report, or complete an extempore attempt to see it here.</p>
          <MagicButton className="mt-5" onClick={() => navigate({ to: '/script' })}>Start with a script</MagicButton>
        </MagicCard>
      ) : (
        <MagicCard className="p-5 md:p-6" hover={false}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-950">Recent activity</h2>
            <MagicButton variant="ghost" onClick={handleClear}><Trash size={17} /> Clear index</MagicButton>
          </div>
          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block flex-1">
              <span className="sr-only">Search practice history</span>
              <MagnifyingGlass size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <MagicInput className="pl-11" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles and coaching notes" />
            </label>
            <div className="flex flex-wrap gap-2" aria-label="Filter practice history by mode">
              {['all', ...Object.keys(MODE_LABELS)].map((mode) => (
                <MagicButton key={mode} variant={modeFilter === mode ? 'primary' : 'secondary'} className="!min-h-10 !px-4 !py-2" onClick={() => setModeFilter(mode)}>
                  {mode === 'all' ? 'All' : MODE_LABELS[mode]}
                </MagicButton>
              ))}
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {filteredActivities.map((activity) => (
              <article key={activity.id} className="flex flex-col gap-4 rounded-[22px] border border-slate-200 bg-white/75 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <MagicBadge>{MODE_LABELS[activity.mode] || activity.mode}</MagicBadge>
                    <span className="text-xs text-slate-500">{formatDate(activity.occurredAt)}</span>
                  </div>
                  <h3 className="mt-3 truncate font-semibold text-slate-950">{activity.title || 'Practice session'}</h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{activity.summary || 'Completed practice activity.'}</p>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  {feedbackReceipts[activity.id] ? (
                    <MagicBadge className={feedbackReceipts[activity.id].status === 'queued' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>
                      {feedbackReceipts[activity.id].status === 'queued' ? 'Feedback queued' : 'Feedback sent'}
                    </MagicBadge>
                  ) : (
                    <div className="flex items-center gap-1" aria-label={`Rate ${activity.title || 'this session'}`}>
                      <span className="mr-1 text-xs text-slate-500">Useful?</span>
                      <button type="button" aria-label="Helpful" onClick={() => setFeedbackTarget({ kind: 'session', sentiment: 'helpful', activity })} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"><ThumbsUp size={17} /></button>
                      <button type="button" aria-label="Needs work" onClick={() => setFeedbackTarget({ kind: 'session', sentiment: 'not_helpful', activity })} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"><ThumbsDown size={17} /></button>
                    </div>
                  )}
                  <MagicButton variant="secondary" onClick={() => openActivity(activity)}>
                    {activity.actionLabel || 'Open mode'} <ArrowRight size={17} />
                  </MagicButton>
                </div>
              </article>
            ))}
            {filteredActivities.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-slate-200 px-5 py-8 text-center text-sm text-slate-500">No activities match this filter.</div>
            ) : null}
          </div>
        </MagicCard>
      )}
      {feedbackTarget ? <FeedbackDialog target={feedbackTarget} onClose={closeFeedback} onSubmitted={refreshFeedbackReceipts} /> : null}
    </div>
  );
}

export default HistoryRoute;
