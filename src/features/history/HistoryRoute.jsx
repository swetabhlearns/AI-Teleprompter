import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRight, ClockCounterClockwise, MagnifyingGlass, Trash } from '@phosphor-icons/react';
import { MagicBadge, MagicButton, MagicCard, MagicInput, MagicSectionHeader, MagicSelect } from '../../components/ui/MagicUI';
import { clearPracticeHistory, loadPracticeActivities, PRACTICE_HISTORY_EVENT, summarizePracticeActivities } from '../../utils/practiceHistory';
import { buildNextPracticeRecommendation, loadPracticeGoal, savePracticeGoal } from '../../utils/practiceGoals';
import { loadPracticeDrills, startPracticeDrill, summarizePracticeDrills } from '../../utils/practiceDrills';

const MODE_LABELS = { script: 'Script', interview: 'Interview', extempore: 'Extempore' };
const MODE_PATHS = { script: '/script', interview: '/interview', extempore: '/extempore' };

function formatDate(value) {
  if (!value) return 'Recently';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function HistoryRoute() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState(loadPracticeActivities);
  const [query, setQuery] = useState('');
  const [modeFilter, setModeFilter] = useState('all');
  const [goal, setGoal] = useState(loadPracticeGoal);
  const [drills, setDrills] = useState(loadPracticeDrills);
  const totals = useMemo(() => activities.reduce((result, item) => ({
    ...result,
    [item.mode]: (result[item.mode] || 0) + 1
  }), {}), [activities]);
  const insights = useMemo(() => summarizePracticeActivities(activities), [activities]);
  const recommendation = useMemo(() => buildNextPracticeRecommendation(activities, goal), [activities, goal]);
  const drillSummary = useMemo(() => summarizePracticeDrills(drills), [drills]);
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
          right={<MagicBadge>{activities.length} activities</MagicBadge>}
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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">Active days</p>
              <p className="mt-2 text-2xl font-semibold">{insights.activeDays}</p>
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
            {drillSummary.active ? (
              <p className="mt-3 text-xs font-medium text-emerald-800">Active drill: {MODE_LABELS[drillSummary.active.mode]} · started {formatDate(drillSummary.active.startedAt)}</p>
            ) : null}
            <MagicButton className="mt-4 !min-h-10 !px-4 !py-2" onClick={startRecommendedDrill}>{drillSummary.active?.mode === recommendation.mode ? 'Continue this drill' : 'Start this drill'} <ArrowRight size={17} /></MagicButton>
          </div>
        </div>
      </MagicCard>

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
                <MagicButton variant="secondary" onClick={() => openActivity(activity)}>
                  {activity.actionLabel || 'Open mode'} <ArrowRight size={17} />
                </MagicButton>
              </article>
            ))}
            {filteredActivities.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-slate-200 px-5 py-8 text-center text-sm text-slate-500">No activities match this filter.</div>
            ) : null}
          </div>
        </MagicCard>
      )}
    </div>
  );
}

export default HistoryRoute;
