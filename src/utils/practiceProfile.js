const THEME_DEFINITIONS = [
  {
    id: 'structure',
    label: 'Answer structure',
    pattern: /\b(structur|framework|opening|conclusion|point first|lead with|organize|sequence)\w*/i
  },
  {
    id: 'examples',
    label: 'Specific examples',
    pattern: /\b(example|specific|evidence|quantif|metric|story|detail)\w*/i
  },
  {
    id: 'pacing',
    label: 'Pacing',
    pattern: /\b(pace|pacing|speed|slow|rushing|tempo|words per minute)\w*/i
  },
  {
    id: 'concision',
    label: 'Concision',
    pattern: /\b(concis|brief|shorten|rambl|filler|repetit|direct)\w*/i
  },
  {
    id: 'delivery',
    label: 'Confident delivery',
    pattern: /\b(confiden|delivery|energy|emphasis|voice|eye contact|natural)\w*/i
  },
  {
    id: 'recovery',
    label: 'Pause recovery',
    pattern: /\b(pause|recover|restart|bridge phrase|silence|hesitat)\w*/i
  }
];

function activityText(activity) {
  return [activity?.recommendation, activity?.summary, activity?.title]
    .filter(Boolean)
    .join(' ');
}

export function detectPracticeThemes(activity) {
  const text = activityText(activity);
  return THEME_DEFINITIONS
    .filter((theme) => theme.pattern.test(text))
    .map(({ id, label }) => ({ id, label }));
}

export function buildPracticeProfile(activities = []) {
  const modes = ['script', 'interview', 'extempore'];
  const modeCounts = Object.fromEntries(modes.map((mode) => [mode, 0]));
  const themes = new Map();

  activities.forEach((activity, index) => {
    if (activity?.mode in modeCounts) modeCounts[activity.mode] += 1;
    for (const theme of detectPracticeThemes(activity)) {
      const existing = themes.get(theme.id) || {
        ...theme,
        count: 0,
        modes: new Set(),
        latestIndex: index,
        latestRecommendation: ''
      };
      existing.count += 1;
      existing.latestIndex = Math.min(existing.latestIndex, index);
      if (activity?.mode) existing.modes.add(activity.mode);
      if (!existing.latestRecommendation && activity?.recommendation) {
        existing.latestRecommendation = activity.recommendation;
      }
      themes.set(theme.id, existing);
    }
  });

  const topThemes = [...themes.values()]
    .sort((a, b) => b.count - a.count || a.latestIndex - b.latestIndex)
    .slice(0, 3)
    .map((theme) => ({
      id: theme.id,
      label: theme.label,
      count: theme.count,
      modes: [...theme.modes],
      latestRecommendation: theme.latestRecommendation
    }));
  const practicedModes = modes.filter((mode) => modeCounts[mode] > 0);

  return {
    activityCount: activities.length,
    modeCounts,
    practicedModes,
    coverage: practicedModes.length,
    topThemes,
    recurringThemes: topThemes.filter((theme) => theme.count >= 2)
  };
}
