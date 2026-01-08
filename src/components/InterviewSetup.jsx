import { useState } from 'react';

/**
 * Interview Setup Component
 * Configure mock interview settings before starting
 */
export function InterviewSetup({ config, setConfig, onStartInterview, isLoading, ttsStatus }) {
    const [activeSection, setActiveSection] = useState('college');

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

    const updateProfile = (field, value) => {
        setConfig(prev => ({
            ...prev,
            profile: { ...prev.profile, [field]: value }
        }));
    };

    const isProfileComplete = config.college && config.profile.name;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div className="glass-strong" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h2 style={{
                            fontSize: '24px',
                            fontWeight: '700',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '8px'
                        }}>
                            <span style={{ fontSize: '32px' }}>🎤</span>
                            Mock Interview Setup
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
                            Configure your practice session for MBA admission interviews
                        </p>
                    </div>

                    {/* TTS Status */}
                    {ttsStatus && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 14px',
                            borderRadius: '20px',
                            background: ttsStatus.isReady
                                ? 'rgba(16,185,129,0.15)'
                                : ttsStatus.isLoading
                                    ? 'rgba(99,102,241,0.15)'
                                    : 'rgba(245,158,11,0.15)',
                            fontSize: '12px',
                            color: ttsStatus.isReady
                                ? '#10b981'
                                : ttsStatus.isLoading
                                    ? '#a5b4fc'
                                    : '#fbbf24'
                        }}>
                            {ttsStatus.isLoading ? (
                                <>
                                    <div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
                                    Loading AI Voice...
                                </>
                            ) : ttsStatus.isReady ? (
                                <>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                                    {ttsStatus.usesFallback ? 'Voice Ready (Basic)' : 'AI Voice Ready ✨'}
                                </>
                            ) : (
                                <>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24' }} />
                                    Voice Limited
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', overflow: 'auto' }}>
                {/* Left Panel - College & Type */}
                <div className="glass-strong" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* College Selection */}
                    <div>
                        <label style={{
                            display: 'block',
                            color: 'rgba(255,255,255,0.8)',
                            fontSize: '14px',
                            marginBottom: '12px',
                            fontWeight: '600'
                        }}>
                            🏛️ Select College
                        </label>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '8px'
                        }}>
                            {colleges.map(college => (
                                <button
                                    key={college.id}
                                    onClick={() => setConfig(prev => ({ ...prev, college: college.name }))}
                                    style={{
                                        padding: '12px 8px',
                                        borderRadius: '10px',
                                        border: config.college === college.name
                                            ? '2px solid #10b981'
                                            : '2px solid transparent',
                                        background: config.college === college.name
                                            ? 'rgba(16,185,129,0.15)'
                                            : 'rgba(255,255,255,0.05)',
                                        color: config.college === college.name ? '#10b981' : 'rgba(255,255,255,0.7)',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {college.short}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Interview Type */}
                    <div>
                        <label style={{
                            display: 'block',
                            color: 'rgba(255,255,255,0.8)',
                            fontSize: '14px',
                            marginBottom: '12px',
                            fontWeight: '600'
                        }}>
                            📋 Interview Type
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {interviewTypes.map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => setConfig(prev => ({ ...prev, interviewType: type.id }))}
                                    style={{
                                        padding: '14px 16px',
                                        borderRadius: '12px',
                                        border: config.interviewType === type.id
                                            ? '2px solid #6366f1'
                                            : '2px solid transparent',
                                        background: config.interviewType === type.id
                                            ? 'rgba(99,102,241,0.15)'
                                            : 'rgba(255,255,255,0.05)',
                                        color: 'white',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <span style={{ fontSize: '20px' }}>{type.icon}</span>
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '14px' }}>{type.name}</div>
                                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{type.desc}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Duration */}
                    <div>
                        <label style={{
                            display: 'block',
                            color: 'rgba(255,255,255,0.8)',
                            fontSize: '14px',
                            marginBottom: '12px',
                            fontWeight: '600'
                        }}>
                            ⏱️ Duration
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            {durations.map(d => (
                                <button
                                    key={d.value}
                                    onClick={() => setConfig(prev => ({ ...prev, duration: d.value }))}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        borderRadius: '10px',
                                        border: config.duration === d.value
                                            ? '2px solid #f59e0b'
                                            : '2px solid transparent',
                                        background: config.duration === d.value
                                            ? 'rgba(245,158,11,0.15)'
                                            : 'rgba(255,255,255,0.05)',
                                        color: config.duration === d.value ? '#f59e0b' : 'rgba(255,255,255,0.7)',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ fontWeight: '700', fontSize: '16px' }}>{d.label}</div>
                                    <div style={{ fontSize: '10px', opacity: 0.7 }}>{d.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Panel - Profile */}
                <div className="glass-strong" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{
                            display: 'block',
                            color: 'rgba(255,255,255,0.8)',
                            fontSize: '14px',
                            marginBottom: '8px',
                            fontWeight: '600'
                        }}>
                            👤 Your Profile
                        </label>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>
                            This helps generate personalized questions
                        </p>
                    </div>

                    <div>
                        <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginBottom: '6px' }}>
                            Name *
                        </label>
                        <input
                            type="text"
                            value={config.profile.name}
                            onChange={(e) => updateProfile('name', e.target.value)}
                            placeholder="Your name"
                            className="input"
                            style={{ padding: '12px' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginBottom: '6px' }}>
                            Work Experience
                        </label>
                        <input
                            type="text"
                            value={config.profile.workExperience}
                            onChange={(e) => updateProfile('workExperience', e.target.value)}
                            placeholder="e.g., 3 years at TCS as Software Engineer"
                            className="input"
                            style={{ padding: '12px' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginBottom: '6px' }}>
                            Education Background
                        </label>
                        <input
                            type="text"
                            value={config.profile.education}
                            onChange={(e) => updateProfile('education', e.target.value)}
                            placeholder="e.g., B.Tech in Computer Science from IIT Delhi"
                            className="input"
                            style={{ padding: '12px' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginBottom: '6px' }}>
                            Hobbies / Interests
                        </label>
                        <input
                            type="text"
                            value={config.profile.hobbies}
                            onChange={(e) => updateProfile('hobbies', e.target.value)}
                            placeholder="e.g., Cricket, Reading, Trekking"
                            className="input"
                            style={{ padding: '12px' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginBottom: '6px' }}>
                            Why MBA?
                        </label>
                        <textarea
                            value={config.profile.whyMba}
                            onChange={(e) => updateProfile('whyMba', e.target.value)}
                            placeholder="Brief reason for pursuing MBA..."
                            className="textarea"
                            style={{ padding: '12px', minHeight: '80px', resize: 'none' }}
                        />
                    </div>
                </div>
            </div>

            {/* Start Button */}
            <div className="glass-strong" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
                        {config.college ? (
                            <span>
                                🏛️ {config.college} • ⏱️ {config.duration} min •
                                📋 {interviewTypes.find(t => t.id === config.interviewType)?.name}
                            </span>
                        ) : (
                            <span>Select a college to begin</span>
                        )}
                    </div>

                    <button
                        onClick={onStartInterview}
                        disabled={!isProfileComplete || isLoading}
                        className="btn btn-success"
                        style={{
                            padding: '14px 32px',
                            fontSize: '16px',
                            opacity: isProfileComplete ? 1 : 0.5
                        }}
                    >
                        {isLoading ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                                Preparing Questions...
                            </span>
                        ) : (
                            <span>🎬 Start Interview</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default InterviewSetup;
