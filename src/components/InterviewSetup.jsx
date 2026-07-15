import InterviewArchiveBrowser from './InterviewArchiveBrowser';
import {
    MagicBadge,
    MagicButton,
    MagicCard,
    MagicField,
    MagicInput,
    MagicSectionHeader,
    MagicTextarea
} from './ui/MagicUI';

/**
 * Interview Setup Component
 * Configure mock interview settings before starting
 */
export function InterviewSetup({
    config,
    setConfig,
    onStartInterview,
    isLoading,
    liveStatus,
    archiveSessions = [],
    archiveLoading = false,
    archiveError = null,
    onReuseArchive,
    onExportArchive,
    onDeleteArchive
}) {
    const demoConfig = {
        college: 'IIM Bangalore',
        interviewType: 'general',
        duration: 10,
        profile: {
            name: 'Shiv',
            background: 'Aspiring MBA candidate with a strong interest in product strategy and technology-led growth.',
            workExperience: '3 years as a software engineer at a mid-sized SaaS company',
            education: 'B.Tech in Computer Science',
            hobbies: 'Coding, cycling, cricket, reading non-fiction',
            whyMba: 'To transition into product management and build leadership skills for scaling impactful products.'
        }
    };

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

    const applyDemoData = () => {
        setConfig((prev) => ({
            ...prev,
            ...demoConfig,
            profile: {
                ...prev.profile,
                ...demoConfig.profile
            }
        }));
    };

    const isProfileComplete = config.college && config.profile.name;

    return (
        <div className="flex h-full flex-col gap-6 overflow-auto text-slate-950">
            <MagicCard className="p-5 md:p-6">
                <MagicSectionHeader
                    eyebrow="Admissions Simulation"
                    title="Interview setup"
                    description="Configure a realistic MBA admissions interview with Gemini. The candidate profile remains context, not the full agenda."
                    right={(
                        <MagicBadge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                            {liveStatus?.modelStatus === 'checking'
                                ? 'Resolving Gemini Live...'
                                : liveStatus?.isConnecting
                                    ? 'Connecting...'
                                    : liveStatus?.isConnected
                                        ? 'Gemini Live ready'
                                        : liveStatus?.error
                                            ? 'Gemini Live unavailable'
                                            : 'Gemini Live idle'}
                        </MagicBadge>
                    )}
                />
                {liveStatus?.error && (
                    <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {liveStatus.error}
                    </div>
                )}
            </MagicCard>

            <div className="grid flex-1 grid-cols-1 gap-6 overflow-auto lg:grid-cols-2">
                <MagicCard className="flex flex-col gap-6 p-5 md:p-6">
                    <MagicSectionHeader
                        eyebrow="Interview Context"
                        title="Select school and format"
                        description="Choose the target school, interview style, and duration for the session."
                    />

                    <div>
                        <MagicBadge className="mb-3">Target School</MagicBadge>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {colleges.map((college) => {
                                const active = config.college === college.name;
                                return (
                                    <MagicButton
                                        key={college.id}
                                        type="button"
                                        variant={active ? 'primary' : 'secondary'}
                                        onClick={() => setConfig((prev) => ({ ...prev, college: college.name }))}
                                        className="!min-h-11 !rounded-[18px] !px-3 !py-3 text-xs"
                                    >
                                        {college.short}
                                    </MagicButton>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <MagicBadge className="mb-3">Interview Type</MagicBadge>
                        <div className="flex flex-col gap-2">
                            {interviewTypes.map((type) => {
                                const active = config.interviewType === type.id;
                                return (
                                    <MagicButton
                                        key={type.id}
                                        type="button"
                                        variant={active ? 'primary' : 'secondary'}
                                        onClick={() => setConfig((prev) => ({ ...prev, interviewType: type.id }))}
                                        className="!h-auto !min-h-0 !items-start !justify-start !rounded-[22px] !px-4 !py-4 text-left"
                                    >
                                        <span className="flex flex-col items-start gap-1">
                                            <span className="text-sm font-semibold">{type.name}</span>
                                            <span className="text-xs font-normal opacity-80">{type.desc}</span>
                                        </span>
                                    </MagicButton>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <MagicBadge className="mb-3">Duration</MagicBadge>
                        <div className="flex flex-wrap gap-2">
                            {durations.map((durationOption) => {
                                const active = config.duration === durationOption.value;
                                return (
                                    <MagicButton
                                        key={durationOption.value}
                                        type="button"
                                        variant={active ? 'primary' : 'secondary'}
                                        onClick={() => setConfig((prev) => ({ ...prev, duration: durationOption.value }))}
                                        className="!min-h-11 !flex-1 !flex-col !rounded-[18px] !px-4 !py-3"
                                    >
                                        <span className="text-sm font-semibold">{durationOption.label}</span>
                                        <span className="text-[10px] font-normal opacity-80">{durationOption.desc}</span>
                                    </MagicButton>
                                );
                            })}
                        </div>
                    </div>
                </MagicCard>

                <MagicCard className="flex flex-col gap-4 p-5 md:p-6">
                <MagicSectionHeader
                    eyebrow="Candidate Context"
                    title="Background summary"
                    description="This is supporting context for Gemini and should guide personalization without dominating the interview."
                    right={(
                        <MagicButton
                            type="button"
                            variant="secondary"
                            onClick={applyDemoData}
                            className="!rounded-[16px] !px-4 !py-2 text-xs"
                        >
                            Load demo data
                        </MagicButton>
                    )}
                />

                    <MagicField label="Name *" hint="Used to personalize the interview">
                        <MagicInput
                            type="text"
                            value={config.profile.name}
                            onChange={(e) => updateProfile('name', e.target.value)}
                            placeholder="Your name"
                        />
                    </MagicField>

                    <MagicField label="Work Experience" hint="A short summary of your current or recent role">
                        <MagicInput
                            type="text"
                            value={config.profile.workExperience}
                            onChange={(e) => updateProfile('workExperience', e.target.value)}
                            placeholder="e.g., 3 years at TCS as Software Engineer"
                        />
                    </MagicField>

                    <MagicField label="Education Background" hint="Degree, school, or other relevant education">
                        <MagicInput
                            type="text"
                            value={config.profile.education}
                            onChange={(e) => updateProfile('education', e.target.value)}
                            placeholder="e.g., B.Tech in Computer Science from IIT Delhi"
                        />
                    </MagicField>

                    <MagicField label="Hobbies / Interests" hint="Optional context for natural conversation">
                        <MagicInput
                            type="text"
                            value={config.profile.hobbies}
                            onChange={(e) => updateProfile('hobbies', e.target.value)}
                            placeholder="e.g., Cricket, Reading, Trekking"
                        />
                    </MagicField>

                    <MagicField label="Why MBA?" hint="Use this to probe motivation and goals">
                        <MagicTextarea
                            value={config.profile.whyMba}
                            onChange={(e) => updateProfile('whyMba', e.target.value)}
                            placeholder="Brief reason for pursuing MBA..."
                            className="min-h-[160px]"
                        />
                    </MagicField>
                </MagicCard>
            </div>

            <MagicCard className="p-5 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-sm text-slate-600">
                        {config.college ? (
                            <span>
                                {config.college} • {config.duration} min • {interviewTypes.find((t) => t.id === config.interviewType)?.name} • Gemini Live
                            </span>
                        ) : (
                            <span>Select a college to begin</span>
                        )}
                    </div>

                    <MagicButton
                        onClick={onStartInterview}
                        disabled={!isProfileComplete || isLoading || (!liveStatus?.isReady || Boolean(liveStatus?.error))}
                        variant="primary"
                        className="!min-w-[180px] !px-8 !py-3 text-base"
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <div className="spinner h-[18px] w-[18px] border-2" />
                                Preparing interview...
                            </span>
                        ) : (
                            <span>Begin Interview</span>
                        )}
                    </MagicButton>
                </div>
            </MagicCard>

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
