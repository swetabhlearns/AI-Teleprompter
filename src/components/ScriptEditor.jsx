import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGroq } from '../hooks/useGroq';
import {
  estimateReadingTime
} from '../utils/formatters';
import { showOatToast } from '../utils/oat';
import {
  MagicButton,
  MagicCard,
  MagicField,
  MagicInput,
  MagicSelect,
  MagicTextarea
} from './ui/MagicUI';

const SCRIPTS_STORAGE_KEY = 'teleprompter_saved_scripts';

function loadSavedScripts() {
  try {
    const saved = localStorage.getItem(SCRIPTS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveScriptsToStorage(scripts) {
  try {
    localStorage.setItem(SCRIPTS_STORAGE_KEY, JSON.stringify(scripts));
  } catch (error) {
    console.error('Failed to save scripts:', error);
  }
}

function getWordCount(script) {
  return script?.trim().split(/\s+/).filter(Boolean).length || 0;
}

export function ScriptEditor({
  script,
  onScriptChange,
  onStartPractice,
  onNotationPreferencesChange
}) {
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('calm');
  const [difficulty, setDifficulty] = useState('medium');
  const [duration, setDuration] = useState(2);
  const [useCurrentData, setUseCurrentData] = useState(false);
  const [savedScripts, setSavedScripts] = useState(loadSavedScripts);
  const [showLibrary, setShowLibrary] = useState(false);
  const editorRef = useRef(null);
  const { generateScript, refineScript, isLoading, error } = useGroq();

  const wordCount = useMemo(() => getWordCount(script), [script]);
  const hasScript = script.trim().length > 0;

  useEffect(() => {
    if (!onNotationPreferencesChange) return;
    onNotationPreferencesChange((prev) => ({
      ...prev,
      showSections: true,
      showPauses: true,
      showSlow: true,
      showFast: true,
      showTempo: true,
      showEmphasis: true,
      showEnunciation: true
    }));
  }, [onNotationPreferencesChange]);

  const captureToast = useCallback((message, type = 'success') => {
    showOatToast(message, type === 'error' ? 'Error' : 'Script');
  }, []);

  const handleGenerate = useCallback(async () => {
    const trimmedTopic = topic.trim();
    if (!trimmedTopic && !script.trim()) return;

    try {
      if (window.posthog) {
        window.posthog.capture('script_generated', {
          topic_length: trimmedTopic.length,
          tone,
          difficulty,
          duration_target: duration,
          use_current_data: useCurrentData
        });
      }

      const generatedScript = script.trim()
        ? await refineScript(script, {
          topic: trimmedTopic || 'this script',
          tone,
          targetDuration: duration * 60,
          difficulty,
          useCurrentData
        })
        : await generateScript(trimmedTopic, tone, duration * 60, difficulty, useCurrentData);

      onScriptChange(generatedScript);
      captureToast(script.trim() ? 'Script refined into the roadmap format' : 'New roadmap script generated');
    } catch (err) {
      console.error('Script generation failed:', err);
      captureToast('Script generation failed', 'error');
    }
  }, [
    captureToast,
    difficulty,
    duration,
    generateScript,
    onScriptChange,
    refineScript,
    script,
    tone,
    topic,
    useCurrentData
  ]);

  const handleSaveScript = useCallback(() => {
    if (!script.trim()) return;

    const title = window.prompt('Enter a name for this script:', topic || 'Untitled Script');
    if (!title) return;

    if (window.posthog) {
      window.posthog.capture('script_saved', {
        word_count: wordCount
      });
    }

    const newScript = {
      id: Date.now(),
      title,
      content: script,
      createdAt: new Date().toISOString(),
      wordCount
    };

    const updated = [newScript, ...savedScripts].slice(0, 20);
    setSavedScripts(updated);
    saveScriptsToStorage(updated);
    captureToast(`"${title}" saved to your library`);
  }, [captureToast, script, savedScripts, topic, wordCount]);

  const handleLoadScript = useCallback((savedScript) => {
    onScriptChange(savedScript.content);
    setShowLibrary(false);
    captureToast(`"${savedScript.title}" loaded into the canvas`);

    window.setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }, [captureToast, onScriptChange]);

  const handleDeleteScript = useCallback((id) => {
    if (!window.confirm('Delete this script?')) return;

    const updated = savedScripts.filter((saved) => saved.id !== id);
    setSavedScripts(updated);
    saveScriptsToStorage(updated);
  }, [savedScripts]);

  const handleClear = useCallback(() => {
    onScriptChange('');
    setTopic('');
  }, [onScriptChange]);

  const showRefine = hasScript;
  const primaryButtonLabel = showRefine ? 'Refine Script' : 'Create Script';

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 pb-32 pt-2 sm:gap-8">
      {showLibrary && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-md"
          onClick={() => setShowLibrary(false)}
        >
          <MagicCard
            className="w-full max-w-3xl overflow-hidden p-0"
            hover={false}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200/70 px-5 py-5 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Roadmap drafts</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{savedScripts.length} drafts stored locally in your browser</p>
                </div>
                <MagicButton variant="secondary" onClick={() => setShowLibrary(false)}>
                  Close
                </MagicButton>
              </div>
            </div>

            <div className="max-h-[68vh] overflow-auto p-4 sm:p-5">
              {savedScripts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                  <div className="text-3xl">📭</div>
                  <p className="mt-4 text-base font-medium text-slate-900">No saved scripts yet.</p>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Generate or refine one, then save it here for later practice.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {savedScripts.map((saved) => (
                    <button
                      key={saved.id}
                      className="group rounded-[22px] border border-slate-200 bg-white/80 p-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
                      onClick={() => handleLoadScript(saved)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h4 className="truncate text-sm font-semibold text-slate-950">{saved.title}</h4>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
                            {saved.content.slice(0, 120)}
                            {saved.content.length > 120 ? '…' : ''}
                          </p>
                          <p className="mt-3 text-xs text-slate-400">
                            {saved.wordCount} words · {new Date(saved.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 transition group-hover:text-slate-900"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteScript(saved.id);
                          }}
                        >
                          Delete
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </MagicCard>
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <MagicCard className="p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="mt-3 text-[2.2rem] font-semibold tracking-[-0.05em] text-slate-950">
                AI Script Generator for Teleprompter Practice
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Create interview answers, presentation scripts, and public speaking practice copy with a focused AI writing workspace, live teleprompter rehearsal, and script refinement tools.
              </p>
            </div>
            <MagicButton variant="secondary" onClick={() => setShowLibrary(true)}>
              Open library
            </MagicButton>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <MagicField label="Tone">
              <MagicSelect value={tone} onChange={(event) => setTone(event.target.value)}>
                <option value="calm">Calm</option>
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="enthusiastic">Enthusiastic</option>
              </MagicSelect>
            </MagicField>

            <MagicField label="Density">
              <MagicSelect value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </MagicSelect>
            </MagicField>

            <MagicField label="Duration">
              <MagicSelect value={String(duration)} onChange={(event) => setDuration(Number(event.target.value))}>
                <option value="1">1 min</option>
                <option value="2">2 min</option>
                <option value="3">3 min</option>
                <option value="5">5 min</option>
                <option value="8">8 min</option>
                <option value="10">10 min</option>
              </MagicSelect>
            </MagicField>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
            <label className="flex items-center gap-3 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={useCurrentData}
                onChange={() => setUseCurrentData((prev) => !prev)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
              />
              Use current context
            </label>
          </div>

          <div className="mt-6 space-y-3">
            <MagicField label="Prompt / topic">
              <MagicInput
                id="script-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="What is this speech about?"
              />
            </MagicField>
            <div className="flex flex-wrap gap-3">
              <MagicButton onClick={handleGenerate} disabled={isLoading || (!topic.trim() && !script.trim())}>
                {isLoading ? 'Working…' : primaryButtonLabel}
              </MagicButton>
              <MagicButton variant="ghost" onClick={handleClear} disabled={!script && !topic}>
                Reset draft
              </MagicButton>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </MagicCard>

        <MagicCard ref={editorRef} className="p-6 md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="mt-3 text-[2rem] font-semibold tracking-[-0.05em] text-slate-950">Canvas</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Refine AI-generated scripts in a distraction-free editor built for teleprompter practice, interview prep, and presentation rehearsal.
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-white/75 px-3 py-1.5 text-xs font-medium text-slate-500">
              {wordCount} words
            </div>
          </div>

          <MagicTextarea
            className="mt-6 min-h-[560px] font-mono text-[15px] leading-7 text-slate-800"
            value={script}
            readOnly
            placeholder="Generated script will appear here."
          />
        </MagicCard>
      </section>

      <ScriptActionsDock
        showRefine={showRefine}
        script={script}
        handleClear={handleClear}
        handleSaveScript={handleSaveScript}
        onStartPractice={onStartPractice}
      />
    </div>
  );
}

function ScriptActionsDock({ showRefine, script, handleClear, handleSaveScript, onStartPractice }) {
  if (!showRefine) {
    return null;
  }

  const dock = (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:bottom-5" aria-label="Script actions">
      <MagicDock className="flex w-fit items-center gap-2">
        <MagicButton variant="secondary" onClick={handleClear} disabled={!script}>
          Clear Script
        </MagicButton>
        <MagicButton variant="secondary" onClick={handleSaveScript} disabled={!script}>
          Save Script
        </MagicButton>
        <MagicButton variant="accent" onClick={onStartPractice} disabled={!script}>
          Practice
        </MagicButton>
      </MagicDock>
    </div>
  );

  return createPortal(dock, document.body);
}

export default ScriptEditor;
