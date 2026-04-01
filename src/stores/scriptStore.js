import { create } from 'zustand';

const SCRIPT_PREFERENCES_KEY = 'teleprompter_script_preferences_v1';

export const DEFAULT_SCRIPT_PREFERENCES = {
  showSections: true,
  showPauses: true,
  showSlow: true,
  showFast: true,
  showEmphasis: true,
  showEnunciation: true,
  distractionFree: false
};

function normalizeScriptPreferences(preferences = {}) {
  const resolved = {
    ...DEFAULT_SCRIPT_PREFERENCES,
    ...preferences
  };

  if (typeof preferences.showTempo === 'boolean') {
    resolved.showSlow = preferences.showTempo;
    resolved.showFast = preferences.showTempo;
  }

  return resolved;
}

function loadScriptPreferences() {
  try {
    const raw = localStorage.getItem(SCRIPT_PREFERENCES_KEY);
    if (!raw) return DEFAULT_SCRIPT_PREFERENCES;
    return normalizeScriptPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_SCRIPT_PREFERENCES;
  }
}

function persistScriptPreferences(preferences) {
  try {
    localStorage.setItem(SCRIPT_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to persist script preferences:', error);
  }
}

export const useScriptStore = create((set) => ({
  script: '',
  scriptPreferences: loadScriptPreferences(),
  setScript: (script) => set({ script }),
  setScriptPreferences: (scriptPreferences) => {
    const nextPreferences = typeof scriptPreferences === 'function'
      ? scriptPreferences(useScriptStore.getState().scriptPreferences)
      : scriptPreferences;
    const normalized = normalizeScriptPreferences(nextPreferences);
    persistScriptPreferences(normalized);
    set({ scriptPreferences: normalized });
  },
  resetScript: () => {
    const scriptPreferences = loadScriptPreferences();
    set({
      script: '',
      scriptPreferences
    });
  }
}));
