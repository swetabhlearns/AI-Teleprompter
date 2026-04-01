import InterviewArchiveBrowser from './InterviewArchiveBrowser';

/**
 * Interview Setup Component
 * Configure mock interview settings before starting
 */
export function InterviewSetup({
    config,
    setConfig,
    onStartInterview,
    onModeChange,
    isLoading,
    ttsStatus,
    liveStatus,
    archiveSessions = [],
    archiveLoading = false,
    archiveError = null,
    onReuseArchive,
    onExportArchive,
    onDeleteArchive
}) {
    const colleges = [
        { id: 'iim-a', name: 'IIM Ahmedabad', short: 'IIM-A' },
        { id: 'iim-b', name: 'IIM Bangalore', short: 'IIM-B' },
        { id: 'iim-c', name: 'IIM Calcutta', short: 'IIM-C' },
        { id: 'iim-l', name: 'IIM Lucknow', short: 'IIM-L' },
        { id: 'iim-k', name: 'IIM Kozhikode', short: 'IIM-K' },
        { id: 'iim-i', name: 'IIM Indore', short: 'IIM-I' },
        { id: 'isb', name: 'ISB Hyderabad', short: 'ISB' },
        { id: 'xlri', name: 'XLRI Jamshedpur', short: 'XLRI' },
        { id: 'fms', name: 'FMS Delhi', short: 'FMS' },
        { id: 'sp-jain', name: 'SP Jain Mumbai', short: 'SPJIMR' },
        { id: 'imt', name: 'IMT Ghaziabad', short: 'IMT' },
        { id: 'other', name: 'Other B-School', short: 'Other' }
    ];

    const interviewTypes = [
        { id: 'general', name: 'General PI', desc: 'Standard personal interview', icon: '💼' },
        { id: 'hr', name: 'HR Interview', desc: 'Focus on personality & fit', icon: '🤝' },
        { id: 'stress', name: 'Stress Interview', desc: 'Pressure testing & curveballs', icon: '🔥' },
        { id: 'case', name: 'Case Discussion', desc: 'Problem-solving focus', icon: '📊' },
        { id: 'wat-pi', name: 'WAT + PI', desc: 'Writing + Personal Interview', icon: '✍️' }
    ];

    const durations = [
        { value: 5, label: '5 min', desc: 'Quick practice' },
        { value: 10, label: '10 min', desc: 'Standard' },
        { value: 15, label: '15 min', desc: 'Extended' },
        { value: 20, label: '20 min', desc: 'Full simulation' }
    ];

    const modes = [
        {
            id: 'live',
            name: 'Gemini 3.1 Flash Live',
            desc: 'Real-time interviewer with the strict Gemini 3.1 Flash Live flow',
            badge: 'Recommended'
        },
        {
            id: 'groq',
            name: 'Classic Groq',
            desc: 'Current interview flow with fallback transcription'
        }
    ];

    const updateProfile = (field, value) => {
        setConfig(prev => ({
            ...prev,
            profile: { ...prev.profile, [field]: value }
        }));
    };

    const isProfileComplete = config.college && config.profile.name;

    return (
        <div className="flex h-full flex-col gap-6 overflow-auto text-text">
            {/* Header */}
            <div className="glass-strong p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h2 className="mb-2 flex items-center gap-3 text-2xl font-semibold tracking-[-0.03em] text-text">
                            <span style={{ fontSize: '32px' }}>🎤</span>
                            Mock Interview Setup
                        </h2>
                        <p className="text-sm text-on-surface-variant">
                            Configure your practice session for MBA admission interviews
                        </p>
                    </div>

                    {config.interviewMode === 'live' ? (
                        <div className="flex items-center gap-2 rounded-sm border border-outline-variant bg-surface-container-low px-3 py-2 text-xs text-text">
                            {liveStatus?.modelStatus === 'checking' ? (
                                <>
                                    <div className="spinner h-3 w-3 border-2" />
                                    Resolving Gemini 3.1 Flash Live...
                                </>
                            ) : liveStatus?.isConnecting ? (
                                <>
                                    <div className="spinner h-3 w-3 border-2" />
                                    Connecting Gemini 3.1 Flash Live...
                                </>
                            ) : liveStatus?.isConnected ? (
                                <>
                                    <div className="size-2 rounded-full bg-success" />
                                    Gemini 3.1 Flash Live connected
                                </>
                            ) : liveStatus?.error ? (
                                <>
                                    <div className="size-2 rounded-full bg-danger" />
                                    Gemini 3.1 Flash Live unavailable
                                </>
                            ) : (
                                <>
                                    <div className="size-2 rounded-full bg-warning" />
                                    Gemini 3.1 Flash Live ready
                                </>
                            )}
                        </div>
                    ) : ttsStatus && (
                        <div className="flex items-center gap-2 rounded-sm border border-outline-variant bg-surface-container-low px-3 py-2 text-xs text-text">
                            {ttsStatus.isLoading ? (
                                <>
                                    <div className="spinner h-3 w-3 border-2" />
                                    Loading AI Voice...
                                </>
                            ) : ttsStatus.isReady ? (
                                <>
                                    <div className="size-2 rounded-full bg-success" />
                                    {ttsStatus.usesFallback ? 'Voice Ready (Basic)' : 'AI Voice Ready ✨'}
                                </>
                            ) : (
                                <>
                                    <div className="size-2 rounded-full bg-warning" />
                                    Voice Limited
                                </>
                            )}
                        </div>
                    )}
                </div>
                {config.interviewMode === 'live' && liveStatus?.error && (
                    <div className="mt-3 rounded-sm border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                        {liveStatus.error}
                    </div>
                )}
                <div className="mt-4 rounded-sm border border-outline-variant bg-surface-container-low p-3">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant">
                        Interview Mode
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {modes.map((mode) => (
                                <button
                                    key={mode.id}
                                    type="button"
                                    onClick={() => {
                                        setConfig(prev => ({ ...prev, interviewMode: mode.id }));
                                        onModeChange?.(mode.id);
                                    }}
                                    className={`rounded-sm border px-3 py-3 text-left transition ${config.interviewMode === mode.id
                                        ? 'border-primary-container bg-primary-container/10'
                                        : 'border-outline-variant bg-surface hover:bg-surface-container-low'
                                    }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-semibold text-text">{mode.name}</div>
                                    {mode.badge && (
                                        <span className="rounded-full border border-outline-variant bg-surface px-2 py-0.5 text-[10px] uppercase tracking-[0.05em] text-on-surface-variant">
                                            {mode.badge}
                                        </span>
                                    )}
                                </div>
                                <div className="mt-1 text-xs text-on-surface-variant">{mode.desc}</div>
                            </button>
                        ))}
                    </div>
                </div>

            </div>

            {/* Main Content */}
            <div className="grid flex-1 grid-cols-1 gap-6 overflow-auto lg:grid-cols-2">
                {/* Left Panel - College & Type */}
                <div className="glass-strong flex flex-col gap-6 p-6">
                    {/* College Selection */}
                    <div>
                        <label className="mb-3 block text-sm font-semibold uppercase tracking-[0.05em] text-on-surface-variant">
                            🏛️ Select College
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {colleges.map(college => (
                                <button
                                    key={college.id}
                                    onClick={() => setConfig(prev => ({ ...prev, college: college.name }))}
                                    className={`rounded-sm border px-3 py-3 text-xs font-semibold transition ${config.college === college.name
                                        ? 'border-primary-container bg-primary-container text-on-primary-container'
                                        : 'border-outline-variant bg-surface text-text hover:bg-surface-container-low'
                                        }`}
                                >
                                    {college.short}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Interview Type */}
                    <div>
                        <label className="mb-3 block text-sm font-semibold uppercase tracking-[0.05em] text-on-surface-variant">
                            📋 Interview Type
                        </label>
                        <div className="flex flex-col gap-2">
                            {interviewTypes.map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => setConfig(prev => ({ ...prev, interviewType: type.id }))}
                                    className={`flex items-center gap-3 rounded-sm border px-4 py-4 text-left transition ${config.interviewType === type.id
                                        ? 'border-primary-container bg-surface-container-low'
                                        : 'border-outline-variant bg-surface hover:bg-surface-container-low'
                                        }`}
                                >
                                    <span style={{ fontSize: '20px' }}>{type.icon}</span>
                                    <div>
                                        <div className="text-sm font-semibold text-text">{type.name}</div>
                                        <div className="text-xs text-on-surface-variant">{type.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="mb-3 block text-sm font-semibold uppercase tracking-[0.05em] text-on-surface-variant">
                            ⏱️ Duration
                        </label>
                        <div className="flex gap-2">
                            {durations.map(d => (
                                <button
                                    key={d.value}
                                    onClick={() => setConfig(prev => ({ ...prev, duration: d.value }))}
                                    className={`flex-1 rounded-sm border px-3 py-3 text-center transition ${config.duration === d.value
                                        ? 'border-primary-container bg-surface-container-low text-text'
                                        : 'border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low'
                                        }`}
                                >
                                    <div className="text-sm font-semibold text-text">{d.label}</div>
                                    <div className="text-[10px] text-on-surface-variant">{d.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Panel - Profile */}
                <div className="glass-strong flex flex-col gap-4 p-6">
                    <div>
                        <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.05em] text-on-surface-variant">
                            👤 Your Profile
                        </label>
                        <p className="mb-4 text-xs text-on-surface-variant">
                            This helps generate personalized questions
                        </p>
                    </div>

                    <div>
                        <label className="mb-2 block text-xs uppercase tracking-[0.05em] text-on-surface-variant">
                            Name *
                        </label>
                        <input
                            type="text"
                            value={config.profile.name}
                            onChange={(e) => updateProfile('name', e.target.value)}
                            placeholder="Your name"
                            className="input"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-xs uppercase tracking-[0.05em] text-on-surface-variant">
                            Work Experience
                        </label>
                        <input
                            type="text"
                            value={config.profile.workExperience}
                            onChange={(e) => updateProfile('workExperience', e.target.value)}
                            placeholder="e.g., 3 years at TCS as Software Engineer"
                            className="input"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-xs uppercase tracking-[0.05em] text-on-surface-variant">
                            Education Background
                        </label>
                        <input
                            type="text"
                            value={config.profile.education}
                            onChange={(e) => updateProfile('education', e.target.value)}
                            placeholder="e.g., B.Tech in Computer Science from IIT Delhi"
                            className="input"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-xs uppercase tracking-[0.05em] text-on-surface-variant">
                            Hobbies / Interests
                        </label>
                        <input
                            type="text"
                            value={config.profile.hobbies}
                            onChange={(e) => updateProfile('hobbies', e.target.value)}
                            placeholder="e.g., Cricket, Reading, Trekking"
                            className="input"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-xs uppercase tracking-[0.05em] text-on-surface-variant">
                            Why MBA?
                        </label>
                        <textarea
                            value={config.profile.whyMba}
                            onChange={(e) => updateProfile('whyMba', e.target.value)}
                            placeholder="Brief reason for pursuing MBA..."
                            className="textarea"
                        />
                    </div>
                </div>
            </div>

            {/* Start Button */}
            <div className="glass-strong px-6 py-5">
                <div className="flex items-center justify-between gap-4">
                        <div className="text-sm text-on-surface-variant">
                            {config.college ? (
                            <span>
                                🏛️ {config.college} • ⏱️ {config.duration} min •
                                📋 {interviewTypes.find(t => t.id === config.interviewType)?.name} •
                                ⚡ {config.interviewMode === 'live' ? 'Gemini 3.1 Flash Live' : 'Groq'}
                            </span>
                        ) : (
                            <span>Select a college to begin</span>
                        )}
                    </div>

                    <button
                        onClick={onStartInterview}
                        disabled={!isProfileComplete || isLoading || (config.interviewMode === 'live' && (!liveStatus?.isReady || Boolean(liveStatus?.error)))}
                        className="btn btn-success px-8 py-3 text-base"
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <div className="spinner h-[18px] w-[18px] border-2" />
                                Preparing Questions...
                            </span>
                        ) : config.interviewMode === 'live' && (!liveStatus?.isReady || Boolean(liveStatus?.error)) ? (
                            <span className="flex items-center gap-2">
                                <div className="size-2 rounded-full bg-danger" />
                                Gemini 3.1 Flash Live unavailable
                            </span>
                        ) : (
                            <span>🎬 Start Interview</span>
                        )}
                    </button>
                </div>
            </div>

            <InterviewArchiveBrowser
                sessions={archiveSessions}
                isLoading={archiveLoading}
                error={archiveError}
                onReuse={onReuseArchive}
                onExport={onExportArchive}
                onDelete={onDeleteArchive}
            />
        </div>
    );
}

export default InterviewSetup;
