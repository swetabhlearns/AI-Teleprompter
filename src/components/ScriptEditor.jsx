import { useState, useEffect, useRef } from 'react';
import { useGroq } from '../hooks/useGroq';
import { estimateReadingTime } from '../utils/formatters';

// LocalStorage key for saved scripts
const SCRIPTS_STORAGE_KEY = 'teleprompter_saved_scripts';

/**
 * Load saved scripts from localStorage
 */
function loadSavedScripts() {
    try {
        const saved = localStorage.getItem(SCRIPTS_STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
}

/**
 * Save scripts to localStorage
 */
function saveScriptsToStorage(scripts) {
    try {
        localStorage.setItem(SCRIPTS_STORAGE_KEY, JSON.stringify(scripts));
    } catch (e) {
        console.error('Failed to save scripts:', e);
    }
}

/**
 * ScriptEditor Component
 * AI-powered script generation with a library of saved scripts
 */
export function ScriptEditor({ script, onScriptChange, onStartPractice }) {
    const [topic, setTopic] = useState('');
    const [tone, setTone] = useState('calm');
    const [difficulty, setDifficulty] = useState('easy');
    const [duration, setDuration] = useState(2);
    const [savedScripts, setSavedScripts] = useState([]);
    const [showLibrary, setShowLibrary] = useState(false);
    const [toast, setToast] = useState(null);
    const { generateScript, isLoading, error } = useGroq();

    // Ref for script editor section
    const scriptEditorRef = useRef(null);

    // Load saved scripts on mount
    useEffect(() => {
        setSavedScripts(loadSavedScripts());
    }, []);

    const tones = [
        { value: 'calm', label: '😌 Calm', desc: 'Relaxed pace' },
        { value: 'professional', label: '💼 Professional', desc: 'Formal tone' },
        { value: 'casual', label: '😊 Casual', desc: 'Friendly chat' },
        { value: 'enthusiastic', label: '🔥 Enthusiastic', desc: 'High energy' },
        { value: 'educational', label: '📚 Educational', desc: 'Clear teaching' }
    ];

    const difficulties = [
        { value: 'easy', label: '🌱 Easy', desc: 'Simple words, short sentences', color: '#10b981' },
        { value: 'medium', label: '🌿 Medium', desc: 'Moderate complexity', color: '#6366f1' },
        { value: 'hard', label: '🌳 Hard', desc: 'Varied vocabulary', color: '#f59e0b' },
        { value: 'expert', label: '🔥 Expert', desc: 'Complex structure', color: '#ef4444' }
    ];

    const handleGenerate = async () => {
        if (!topic.trim()) return;

        try {
            const generatedScript = await generateScript(topic, tone, duration * 60, difficulty);
            onScriptChange(generatedScript);
        } catch (err) {
            console.error('Script generation failed:', err);
        }
    };

    const handleSaveScript = () => {
        if (!script.trim()) return;

        const title = prompt('Enter a name for this script:', topic || 'Untitled Script');
        if (!title) return;

        const newScript = {
            id: Date.now(),
            title,
            content: script,
            createdAt: new Date().toISOString(),
            wordCount: script.trim().split(/\s+/).filter(w => w).length
        };

        const updated = [newScript, ...savedScripts].slice(0, 20); // Keep max 20 scripts
        setSavedScripts(updated);
        saveScriptsToStorage(updated);
    };

    const handleLoadScript = (savedScript) => {
        onScriptChange(savedScript.content);
        setShowLibrary(false);

        // Show toast notification
        setToast({ message: `"${savedScript.title}" added to editor`, type: 'success' });
        setTimeout(() => setToast(null), 3000);

        // Scroll to script editor section after a brief delay
        setTimeout(() => {
            scriptEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    const handleDeleteScript = (id) => {
        if (!confirm('Delete this script?')) return;
        const updated = savedScripts.filter(s => s.id !== id);
        setSavedScripts(updated);
        saveScriptsToStorage(updated);
    };

    const handleClear = () => {
        onScriptChange('');
        setTopic('');
    };

    const estimatedTime = script ? estimateReadingTime(script) : 0;
    const wordCount = script ? script.trim().split(/\s+/).filter(w => w).length : 0;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Saved Scripts Library Modal */}
            {showLibrary && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.8)',
                        backdropFilter: 'blur(8px)',
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '20px'
                    }}
                    onClick={() => setShowLibrary(false)}
                >
                    <div
                        className="glass-strong"
                        style={{
                            width: '100%',
                            maxWidth: '600px',
                            maxHeight: '80vh',
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            borderRadius: '24px'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            <h3 style={{ color: 'white', fontSize: '20px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                📚 Script Library
                                <span style={{ fontSize: '14px', fontWeight: '400', color: 'rgba(255,255,255,0.5)' }}>
                                    ({savedScripts.length} saved)
                                </span>
                            </h3>
                        </div>

                        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                            {savedScripts.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)' }}>
                                    <p style={{ fontSize: '48px', marginBottom: '16px' }}>📭</p>
                                    <p>No saved scripts yet</p>
                                    <p style={{ fontSize: '14px', marginTop: '8px' }}>Generate or write a script, then save it!</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {savedScripts.map(s => (
                                        <div
                                            key={s.id}
                                            style={{
                                                background: 'rgba(255,255,255,0.05)',
                                                borderRadius: '14px',
                                                padding: '16px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                border: '1px solid transparent'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ flex: 1 }} onClick={() => handleLoadScript(s)}>
                                                    <h4 style={{ color: 'white', fontWeight: '600', marginBottom: '6px' }}>{s.title}</h4>
                                                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: '1.4' }}>
                                                        {s.content.slice(0, 100)}...
                                                    </p>
                                                    <div style={{ marginTop: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.4)', display: 'flex', gap: '16px' }}>
                                                        <span>{s.wordCount} words</span>
                                                        <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteScript(s.id); }}
                                                    style={{
                                                        background: 'rgba(239,68,68,0.15)',
                                                        border: 'none',
                                                        borderRadius: '8px',
                                                        padding: '8px 12px',
                                                        color: '#fca5a5',
                                                        cursor: 'pointer',
                                                        fontSize: '12px'
                                                    }}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <button
                                onClick={() => setShowLibrary(false)}
                                className="btn btn-secondary"
                                style={{ width: '100%' }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Generation Section */}
            <div className="glass-strong" style={{ padding: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '28px' }}>🤖</span>
                        AI Script Generator
                    </h2>

                    {/* Library Button */}
                    <button
                        onClick={() => setShowLibrary(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 18px',
                            borderRadius: '12px',
                            background: savedScripts.length > 0 ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.1)',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '500'
                        }}
                    >
                        📚 My Scripts {savedScripts.length > 0 && `(${savedScripts.length})`}
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Topic Input */}
                    <div>
                        <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginBottom: '8px', fontWeight: '500' }}>
                            What's your video about?
                        </label>
                        <input
                            type="text"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g., Benefits of morning exercise, My travel experience..."
                            className="input"
                        />
                    </div>

                    {/* Tone Selection */}
                    <div>
                        <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginBottom: '10px', fontWeight: '500' }}>
                            Choose your tone
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                            {tones.map((t) => (
                                <button
                                    key={t.value}
                                    onClick={() => setTone(t.value)}
                                    style={{
                                        padding: '14px 12px',
                                        borderRadius: '14px',
                                        textAlign: 'left',
                                        transition: 'all 0.2s ease',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: tone === t.value
                                            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                            : 'rgba(255,255,255,0.05)',
                                        color: tone === t.value ? 'white' : 'rgba(255,255,255,0.7)',
                                        boxShadow: tone === t.value ? '0 4px 15px rgba(99,102,241,0.3)' : 'none'
                                    }}
                                >
                                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{t.label}</div>
                                    <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>{t.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Difficulty Selection */}
                    <div>
                        <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginBottom: '10px', fontWeight: '500' }}>
                            Difficulty Level
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                            {difficulties.map((d) => (
                                <button
                                    key={d.value}
                                    onClick={() => setDifficulty(d.value)}
                                    style={{
                                        padding: '14px 12px',
                                        borderRadius: '14px',
                                        textAlign: 'center',
                                        transition: 'all 0.2s ease',
                                        border: difficulty === d.value ? `2px solid ${d.color}` : '2px solid transparent',
                                        cursor: 'pointer',
                                        background: difficulty === d.value
                                            ? `${d.color}22`
                                            : 'rgba(255,255,255,0.05)',
                                        color: difficulty === d.value ? d.color : 'rgba(255,255,255,0.7)',
                                    }}
                                >
                                    <div style={{ fontSize: '16px', fontWeight: '600' }}>{d.label}</div>
                                    <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>{d.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Duration */}
                    <div>
                        <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginBottom: '10px', fontWeight: '500' }}>
                            Target duration: <span style={{ color: 'white', fontWeight: '600' }}>{duration} minute{duration > 1 ? 's' : ''}</span>
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            value={duration}
                            onChange={(e) => setDuration(Number(e.target.value))}
                            style={{
                                width: '100%',
                                height: '8px',
                                borderRadius: '4px',
                                appearance: 'none',
                                background: 'rgba(255,255,255,0.1)',
                                cursor: 'pointer',
                                accentColor: '#6366f1'
                            }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.4)', fontSize: '12px', marginTop: '6px' }}>
                            <span>1 min</span>
                            <span>5 min</span>
                            <span>10 min</span>
                        </div>
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={!topic.trim() || isLoading}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '16px', fontSize: '16px' }}
                    >
                        {isLoading ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
                                Generating fluency-friendly script...
                            </span>
                        ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                ✨ Generate Script
                            </span>
                        )}
                    </button>

                    {error && (
                        <div style={{
                            padding: '14px 16px',
                            background: 'rgba(239,68,68,0.15)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '12px',
                            color: '#fca5a5',
                            fontSize: '14px'
                        }}>
                            ⚠️ {error}
                        </div>
                    )}
                </div>
            </div>

            {/* Toast Notification */}
            {toast && (
                <div
                    style={{
                        position: 'fixed',
                        top: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1100,
                        padding: '14px 24px',
                        borderRadius: '12px',
                        background: toast.type === 'success'
                            ? 'linear-gradient(135deg, #10b981, #059669)'
                            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '500',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        animation: 'slideUp 0.3s ease-out'
                    }}
                >
                    <span style={{ fontSize: '18px' }}>✅</span>
                    {toast.message}
                </div>
            )}

            {/* Script Editor */}
            <div ref={scriptEditorRef} className="glass-strong" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '28px' }}>📝</span>
                        Your Script
                    </h2>

                    {script && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
                            <span>{wordCount} words</span>
                            <span>~{Math.ceil(estimatedTime / 60)} min read</span>
                        </div>
                    )}
                </div>

                <div style={{ flex: 1, position: 'relative', minHeight: '200px' }}>
                    <textarea
                        value={script}
                        onChange={(e) => onScriptChange(e.target.value)}
                        placeholder={`Start typing your script here or use the AI generator above...

Tips for fluency practice:
• Keep sentences short and simple
• Use [PAUSE] markers for breathing breaks
• Practice one paragraph at a time
• Start slow, speed comes naturally`}
                        className="textarea"
                        style={{ height: '100%', minHeight: '200px' }}
                    />
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                    <button
                        onClick={handleClear}
                        disabled={!script}
                        className="btn btn-secondary"
                    >
                        Clear
                    </button>
                    <button
                        onClick={handleSaveScript}
                        disabled={!script}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        💾 Save Script
                    </button>
                    <button
                        onClick={onStartPractice}
                        disabled={!script}
                        className="btn btn-success"
                        style={{ flex: 1 }}
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🎬 Start Practice Session
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ScriptEditor;
