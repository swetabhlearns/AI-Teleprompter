import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRight, ClockCounterClockwise, Trash } from '@phosphor-icons/react';
import { MagicBadge, MagicButton, MagicCard, MagicSectionHeader } from '../../components/ui/MagicUI';
import { clearPracticeHistory, loadPracticeActivities, PRACTICE_HISTORY_EVENT } from '../../utils/practiceHistory';

const MODE_LABELS = { script: 'Script', interview: 'Interview', extempore: 'Extempore' };
const MODE_PATHS = { script: '/script', interview: '/interview', extempore: '/extempore' };

function formatDate(value) {
  if (!value) return 'Recently';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function HistoryRoute() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState(loadPracticeActivities);
  const totals = useMemo(() => activities.reduce((result, item) => ({
    ...result,
    [item.mode]: (result[item.mode] || 0) + 1
  }), {}), [activities]);

  useEffect(() => {
    const refresh = () => setActivities(loadPracticeActivities());
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
          <div className="mt-5 space-y-3">
            {activities.map((activity) => (
              <article key={activity.id} className="flex flex-col gap-4 rounded-[22px] border border-slate-200 bg-white/75 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <MagicBadge>{MODE_LABELS[activity.mode] || activity.mode}</MagicBadge>
                    <span className="text-xs text-slate-500">{formatDate(activity.occurredAt)}</span>
                  </div>
                  <h3 className="mt-3 truncate font-semibold text-slate-950">{activity.title || 'Practice session'}</h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{activity.summary || 'Completed practice activity.'}</p>
                </div>
                <MagicButton variant="secondary" onClick={() => navigate({ to: MODE_PATHS[activity.mode] || '/' })}>
                  {activity.actionLabel || 'Open mode'} <ArrowRight size={17} />
                </MagicButton>
              </article>
            ))}
          </div>
        </MagicCard>
      )}
    </div>
  );
}

export default HistoryRoute;
