import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGroq } from '../hooks/useGroq';
import {
  estimateReadingTime
} from '../utils/formatters';

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
  const [toast, setToast] = useState(null);
  const editorRef = useRef(null);
  const { generateScript, refineScript, isLoading, error } = useGroq();

  const estimatedTime = useMemo(() => estimateReadingTime(script), [script]);
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
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 2800);
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
    <div className={`delivery-workspace ${showRefine ? 'delivery-workspace-has-dock' : ''}`}>
      {showLibrary && (
        <div className="library-backdrop" onClick={() => setShowLibrary(false)}>
          <div className="library-modal glass-strong refined-card" onClick={(event) => event.stopPropagation()}>
            <div className="library-modal-header">
              <div>
                <h3>Saved Scripts</h3>
                <p>{savedScripts.length} roadmap drafts in your library</p>
              </div>
              <button className="refined-button-secondary" onClick={() => setShowLibrary(false)}>
                Close
              </button>
            </div>

            <div className="library-list">
              {savedScripts.length === 0 ? (
                <div className="library-empty">
                  <div className="library-empty-icon">📭</div>
                  <p>No saved scripts yet.</p>
                  <span>Generate or refine one, then save it here.</span>
                </div>
              ) : (
                savedScripts.map((saved) => (
                  <button
                    key={saved.id}
                    className="library-item"
                    onClick={() => handleLoadScript(saved)}
                  >
                    <div className="library-item-copy">
                      <h4>{saved.title}</h4>
                      <p>{saved.content.slice(0, 120)}{saved.content.length > 120 ? '…' : ''}</p>
                      <span>{saved.wordCount} words · {new Date(saved.createdAt).toLocaleDateString()}</span>
                    </div>
                    <span
                      className="library-delete"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteScript(saved.id);
                      }}
                    >
                      Delete
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="delivery-layout">
        <section className="delivery-main">
          <div className="refined-card delivery-generator-card">
            <div className="delivery-editor-header delivery-generator-header">
              <div>
                <span className="eyebrow">Generation Input</span>
                <h3>Prompt and setup</h3>
              </div>
              <div className="delivery-editor-meta">
                <button type="button" className="refined-button-secondary script-header-btn" onClick={() => setShowLibrary(true)}>
                  Open library
                </button>
              </div>
            </div>

            <div className="script-filters-row">
              <label className="script-filter">
                <span className="field-label">Tone</span>
                <select className="refined-select" value={tone} onChange={(event) => setTone(event.target.value)}>
                  <option value="calm">Calm</option>
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="enthusiastic">Enthusiastic</option>
                </select>
              </label>

              <label className="script-filter">
                <span className="field-label">Density</span>
                <select className="refined-select" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>

              <label className="script-filter">
                <span className="field-label">Duration</span>
                <select className="refined-select" value={String(duration)} onChange={(event) => setDuration(Number(event.target.value))}>
                  <option value="1">1 min</option>
                  <option value="2">2 min</option>
                  <option value="3">3 min</option>
                  <option value="5">5 min</option>
                  <option value="8">8 min</option>
                  <option value="10">10 min</option>
                </select>
              </label>

              <label className="script-filter script-filter-check">
                <input
                  type="checkbox"
                  checked={useCurrentData}
                  onChange={() => setUseCurrentData((prev) => !prev)}
                />
                <span>Use current context</span>
              </label>
            </div>

            <label className="field-label" htmlFor="script-topic">
              Prompt / topic
            </label>
            <input
              id="script-topic"
              className="input refined-input"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="What is this speech about?"
            />

            <button
              className="refined-button-primary script-generate-btn"
              onClick={handleGenerate}
              disabled={isLoading || (!topic.trim() && !script.trim())}
            >
              {isLoading ? 'Working…' : primaryButtonLabel}
            </button>

            {error && (
              <div className="error-panel">
                {error}
              </div>
            )}
          </div>

          <div ref={editorRef} className="refined-card delivery-editor">
            <div className="delivery-editor-header">
              <div>
                <span className="eyebrow">Generated script</span>
                <h3>Script canvas</h3>
              </div>
              <div className="delivery-editor-meta">
                <span>{wordCount} words</span>
                <span>~{Math.max(1, Math.ceil(estimatedTime / 60))} min</span>
              </div>
            </div>

            <p className="generated-script-note">
              This section is read-only. Generate or refine your script, then rehearse directly from this canvas.
            </p>
            <textarea
              className="textarea refined-textarea delivery-textarea"
              value={script}
              readOnly
              placeholder="Generated script will appear here."
            />
          </div>
        </section>
      </div>

      <ScriptActionsDock
        showRefine={showRefine}
        script={script}
        handleClear={handleClear}
        handleSaveScript={handleSaveScript}
        onStartPractice={onStartPractice}
      />

      {toast && (
        <div className={`script-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

function ScriptActionsDock({ showRefine, script, handleClear, handleSaveScript, onStartPractice }) {
  if (!showRefine) {
    return null;
  }

  const dock = (
    <div className="delivery-actions-dock refined-dock" aria-label="Script actions">
      <div className="delivery-actions-dock-shell refined-dock-inner">
        <div className="delivery-actions">
          <button onClick={handleClear} disabled={!script} className="refined-button-secondary">
            Clear Script
          </button>
          <button onClick={handleSaveScript} disabled={!script} className="refined-button-secondary">
            Save Script
          </button>
          <button onClick={onStartPractice} disabled={!script} className="refined-button-primary">
            Practice
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dock, document.body);
}

export default ScriptEditor;
