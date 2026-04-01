import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGroq } from '../hooks/useGroq';
import {
  estimateReadingTime,
  parseDeliveryScript
} from '../utils/formatters';

const CANONICAL_ROADMAP_SECTIONS = ['Hook', 'Core Narrative', 'Call to Action', 'Finish'];
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

function SectionPreview({ section, notationPreferences }) {
  const sectionIndex = section.index.toString().padStart(2, '0');
  const shouldShowSectionHeader = notationPreferences.showSections && CANONICAL_ROADMAP_SECTIONS.includes(section.title);
  const tempoVisible = (tempo) => {
    const legacyTempo = notationPreferences.showTempo;
    const tempoToggle = typeof legacyTempo === 'boolean' ? legacyTempo : true;

    if (tempo === 'slow') {
      return tempoToggle && notationPreferences.showSlow !== false;
    }
    if (tempo === 'fast') {
      return tempoToggle && notationPreferences.showFast !== false;
    }
    return false;
  };

  return (
    <article className="roadmap-section">
      {shouldShowSectionHeader && (
        <div className="roadmap-section-header">
          <span className="roadmap-section-index">{sectionIndex}</span>
          <div>
            <h3>{section.title}</h3>
            {section.isCanonical && (
              <p>Editorial section cue</p>
            )}
          </div>
        </div>
      )}

      <div className="roadmap-section-body">
        {section.paragraphs.length === 0 ? (
          <p className="roadmap-empty">Add a paragraph under this section to build the roadmap.</p>
        ) : (
          section.paragraphs.map((paragraph) => (
            <p
              key={paragraph.id}
              className={[
                'roadmap-paragraph',
                tempoVisible(paragraph.tempo) ? `tempo-${paragraph.tempo}` : ''
              ].filter(Boolean).join(' ')}
            >
              {tempoVisible(paragraph.tempo) && (
                <span className={`tempo-chip tempo-${paragraph.tempo}`}>
                  {paragraph.tempo === 'slow' ? 'Slow' : 'Fast'}
                </span>
              )}

              {paragraph.tokens.map((token, index) => {
                if (token.type === 'pause') {
                  if (!notationPreferences.showPauses) {
                    return null;
                  }

                  return (
                    <span key={`${paragraph.id}-pause-${index}`} className="notation-chip notation-pause">
                      {token.value}
                    </span>
                  );
                }

                if (token.type === 'emphasis') {
                  return (
                    <span
                      key={`${paragraph.id}-emphasis-${index}`}
                      className={notationPreferences.showEmphasis ? 'notation-emphasis' : ''}
                    >
                      {token.value}
                    </span>
                  );
                }

                if (token.type === 'enunciation') {
                  return (
                    <span
                      key={`${paragraph.id}-enunciation-${index}`}
                      className={notationPreferences.showEnunciation ? 'notation-enunciation' : ''}
                    >
                      {notationPreferences.showEnunciation ? token.value : token.value}
                    </span>
                  );
                }

                return (
                  <span key={`${paragraph.id}-text-${index}`}>{token.value}</span>
                );
              })}
            </p>
          ))
        )}
      </div>
    </article>
  );
}

export function ScriptEditor({
  script,
  onScriptChange,
  onStartPractice,
  notationPreferences,
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

  const parsedScript = useMemo(() => parseDeliveryScript(script), [script]);
  const estimatedTime = useMemo(() => estimateReadingTime(script), [script]);
  const wordCount = useMemo(() => getWordCount(script), [script]);
  const hasScript = script.trim().length > 0;
  const canonicalSections = useMemo(() => {
    const sectionOrder = new Map(CANONICAL_ROADMAP_SECTIONS.map((title, index) => [title, index]));

    return parsedScript.sections
      .filter((section) => sectionOrder.has(section.title))
      .slice()
      .sort((left, right) => sectionOrder.get(left.title) - sectionOrder.get(right.title));
  }, [parsedScript.sections]);

  const resolvedPreferences = notationPreferences || {
    showSections: true,
    showPauses: true,
    showSlow: true,
    showFast: true,
    showTempo: true,
    showEmphasis: true,
    showEnunciation: true,
    distractionFree: false
  };

  const setPreference = useCallback((key, value) => {
    if (!onNotationPreferencesChange) return;
    onNotationPreferencesChange((prev) => ({
      ...prev,
      [key]: value
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
              <button className="btn btn-secondary" onClick={() => setShowLibrary(false)}>
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
          <div className="glass-strong refined-card delivery-header">
            <div className="delivery-header-copy">
              <div className="eyebrow">Delivery Roadmap</div>
              <h2>Acoustic notations for live coaching while you read</h2>
              <p>
                Let the AI build the full script flow, then shape the delivery with pauses, tempo, emphasis, and section structure.
              </p>
            </div>

            <div className="delivery-header-stats">
              <div>
                <span>Words</span>
                <strong>{wordCount}</strong>
              </div>
              <div>
                <span>Read time</span>
                <strong>~{Math.max(1, Math.ceil(estimatedTime / 60))} min</strong>
              </div>
              <div>
                <span>Sections</span>
                <strong>{canonicalSections.length || 1}</strong>
              </div>
            </div>
          </div>

          <div className="glass-strong refined-panel delivery-notation-panel">
            <div className="sidebar-section-header">
              <span className="eyebrow">Notation settings</span>
              <h3>Choose which cues stay visible</h3>
            </div>

            <div className="notation-row">
              {[
                ['showSections', 'Section headers'],
                ['showPauses', 'Pause markers'],
                ['showSlow', 'Slow cues'],
                ['showFast', 'Fast cues'],
                ['showEmphasis', 'Emphasis words'],
                ['showEnunciation', 'Enunciate phrases']
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className="setting-row refined-button-secondary"
                  onClick={() => setPreference(key, !resolvedPreferences[key])}
                >
                  <span>{label}</span>
                  <span className={resolvedPreferences[key] ? 'toggle-pill active refined-chip refined-chip-active' : 'toggle-pill refined-chip'}>
                    {resolvedPreferences[key] ? 'On' : 'Off'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-strong refined-card delivery-canvas">
            <div className="delivery-canvas-header">
              <div>
                <span className="eyebrow">Canvas preview</span>
                <h3>Structured delivery flow</h3>
              </div>
              <div className="delivery-preview-toggle">
                <button
                  type="button"
                  className={resolvedPreferences.distractionFree ? 'toggle-pill active' : 'toggle-pill'}
                  onClick={() => setPreference('distractionFree', !resolvedPreferences.distractionFree)}
                >
                  {resolvedPreferences.distractionFree ? 'Focus mode on' : 'Focus mode off'}
                </button>
              </div>
            </div>

            <div className="roadmap-preview">
              {canonicalSections.length === 0 ? (
                <div className="roadmap-empty-state">
                  <div className="roadmap-empty-icon">✦</div>
                  <h4>Ask AI to create your first script</h4>
                  <p>
                    The AI will draft the full flow with sections, pauses, emphasis, and tempo shifts for fluent speaking practice.
                  </p>
                </div>
              ) : (
                canonicalSections.map((section, index) => (
                  <SectionPreview
                    key={section.id}
                    section={{ ...section, index: index + 1 }}
                    notationPreferences={resolvedPreferences}
                  />
                ))
              )}
            </div>
          </div>

          <div ref={editorRef} className="glass-strong refined-card delivery-editor">
            <div className="delivery-editor-header">
              <div>
                <span className="eyebrow">Generated script</span>
                <h3>AI writes the script, you stay focused on delivery</h3>
              </div>
              <div className="delivery-editor-meta">
                <span>{wordCount} words</span>
                <span>~{Math.max(1, Math.ceil(estimatedTime / 60))} min</span>
              </div>
            </div>

            <div className="generated-script-note">
              This section is read-only. Ask AI to create or refine the script, then review the flow here before practice.
            </div>
          </div>
        </section>

        <aside className="delivery-sidebar glass-strong refined-panel">
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <span className="eyebrow">Session Setup</span>
              <h3>Shape the roadmap before it reaches the teleprompter</h3>
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

            <label className="field-label" htmlFor="script-tone">
              Tone
            </label>
            <div className="option-grid">
              {[
                ['calm', 'Calm'],
                ['professional', 'Professional'],
                ['casual', 'Casual'],
                ['enthusiastic', 'Enthusiastic']
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={tone === value ? 'option-pill active refined-chip refined-chip-active' : 'option-pill refined-chip'}
                  onClick={() => setTone(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="field-label" htmlFor="script-duration">
              Duration
            </label>
            <div className="duration-block">
              <input
                id="script-duration"
                type="range"
                min="1"
                max="10"
                value={duration}
                onChange={(event) => setDuration(Number(event.target.value))}
              />
              <div className="duration-labels">
                <span>1 min</span>
                <strong>{duration} min</strong>
                <span>10 min</span>
              </div>
            </div>

            <label className="field-label" htmlFor="script-difficulty">
              Density
            </label>
            <div className="option-grid option-grid-compact">
              {[
                ['easy', 'Easy'],
                ['medium', 'Medium'],
                ['hard', 'Hard']
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={difficulty === value ? 'option-pill active refined-chip refined-chip-active' : 'option-pill refined-chip'}
                  onClick={() => setDifficulty(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="switch-card">
              <div>
                <strong>Use current context</strong>
                <p>Let the model pull in current details when they help the delivery.</p>
              </div>
              <button
                type="button"
                className={useCurrentData ? 'toggle-pill active refined-chip refined-chip-active' : 'toggle-pill refined-chip'}
                onClick={() => setUseCurrentData(!useCurrentData)}
              >
                {useCurrentData ? 'On' : 'Off'}
              </button>
            </div>

            <button
              className="btn btn-primary sidebar-primary-action refined-button-primary"
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

          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <span className="eyebrow">Saved drafts</span>
              <h3>Quick access to prior scripts</h3>
            </div>

            <button
              type="button"
              className="btn btn-secondary sidebar-secondary-action refined-button-secondary"
              onClick={() => setShowLibrary(true)}
            >
              Open library
            </button>
          </div>
        </aside>
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
          <button onClick={handleClear} disabled={!script} className="btn btn-secondary refined-button-secondary">
            Clear Script
          </button>
          <button onClick={handleSaveScript} disabled={!script} className="btn btn-secondary refined-button-secondary">
            Save Script
          </button>
          <button onClick={onStartPractice} disabled={!script} className="btn btn-success refined-button-primary">
            Practice
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dock, document.body);
}

export default ScriptEditor;
