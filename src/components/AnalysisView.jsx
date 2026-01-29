import { useMemo } from 'react';
import { formatDuration, formatWPM, formatScore } from '../utils/formatters';

/**
 * AnalysisView Component
 * Post-recording performance analysis display
 */
export function AnalysisView({ analysis, isLoading = false }) {
    const wpmData = useMemo(() => {
        return analysis?.summary?.wpm ? formatWPM(analysis.summary.wpm) : null;
    }, [analysis]);

    const overallScoreData = useMemo(() => {
        return analysis?.summary?.overallScore ? formatScore(analysis.summary.overallScore) : null;
    }, [analysis]);

    // Safe Data Extraction & Mapping (The "Anti-Crash" Layer)
    const summary = analysis?.summary || {};
    const habits = analysis?.habits || {};

    const delivery = habits.delivery || {};
    const vocal = habits.vocal || {};
    const cognitive = habits.cognitive || {};

    const presence = analysis?.presence || { eyeContactPercentage: 0, postureScore: 0 };
    const speech = analysis?.speech || { clarityScore: 0, fillerWords: { count: 0, occurrences: [] } };
    const recommendations = analysis?.recommendations || [];

    // Map Specific Metrics with Defaults
    const pauses = delivery.pauses || { pauseScore: 0, strategicPauses: 0, feedback: 'No data' };
    const rate = delivery.rate || { variabilityScore: 0, minWpm: 0, maxWpm: 0, feedback: 'No data' };
    const declarative = delivery.declarative || { declarativeScore: 0, hedgingCount: 0, feedback: 'No data' };

    const volume = vocal.volume || { volumeScore: 0, hasTrailingOff: false, history: [], feedback: 'No data' };

    const thoughtCompletion = cognitive.thoughtCompletion || { completionScore: 0, veryLongSentences: 0, feedback: 'No data' };
    const frameworks = cognitive.frameworks || { frameworkScore: 0, hasContext: false, feedback: 'No data' };
    const analogies = cognitive.analogies || { analogyScore: 0, analogyCount: 0, feedback: 'No data' };

    const habitsScore = summary.habitsScore || 0;

    // Map stuttering report to 'fluency' if available
    const fluency = analysis?.stuttering || null;

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <div className="spinner mx-auto mb-4" />
                    <p className="text-white/70">Analyzing your performance...</p>
                </div>
            </div>
        );
    }

    if (!analysis) {
        return (
            <div className="h-full flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <div className="text-6xl mb-4">📊</div>
                    <h2 className="text-2xl font-bold text-white mb-2">No Analysis Yet</h2>
                    <p className="text-white/60">
                        Complete a practice session to see your performance breakdown with
                        WPM, filler words, and AI-powered feedback.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-auto p-6 flex flex-col gap-8">
            {/* Header Stats - Staggered Reveal */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {/* Overall Score */}
                <div className="stat-card reveal reveal-delay-1">
                    <div className="stat-value">
                        {summary.overallScore || 0}
                    </div>
                    <div className="stat-label">Performance Index</div>
                </div>

                {/* WPM */}
                <div className="stat-card reveal reveal-delay-2">
                    <div className="stat-value">
                        {summary.wpm || 0}
                    </div>
                    <div className="stat-label">Precision Rate (WPM)</div>
                </div>

                {/* Duration */}
                <div className="stat-card reveal reveal-delay-3">
                    <div className="stat-value" style={{ fontSize: '2.5rem' }}>
                        {formatDuration(summary.duration || 0)}
                    </div>
                    <div className="stat-label">Session Duration</div>
                </div>

                {/* Word Count */}
                <div className="stat-card reveal reveal-delay-4">
                    <div className="stat-value" style={{ fontSize: '2.5rem' }}>
                        {summary.wordCount || 0}
                    </div>
                    <div className="stat-label">Lexical Count</div>
                </div>
            </div>

            {/* Detailed Analysis */}
            <div className="grid md:grid-cols-2 gap-8 reveal reveal-delay-5">
                {/* Filler Words */}
                <div className="glass-strong p-8">
                    <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <span>🗣️</span> FILLER DETECTION
                    </h3>

                    {speech.fillerWords.count > 0 ? (
                        <>
                            <div className="flex items-end gap-3 mb-8">
                                <div className="text-6xl font-extrabold text-white leading-none">
                                    {speech.fillerWords.count}
                                </div>
                                <div className="text-xs font-bold text-amber-500 uppercase tracking-tight mb-1">
                                    Non-declarative markers
                                </div>
                            </div>

                            <div className="space-y-3">
                                {speech.fillerWords.occurrences.slice(0, 5).map((item) => (
                                    <div
                                        key={item.word}
                                        className="flex items-center justify-between p-3 bg-white/2 rounded border border-white/5"
                                    >
                                        <span className="text-white/80 font-mono text-sm">"{item.word}"</span>
                                        <span className="text-white/30 text-xs font-bold">{item.count}X</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8">
                            <div className="text-5xl mb-4">💎</div>
                            <p className="text-emerald-400 font-bold uppercase tracking-wider">Perfect Clarity</p>
                            <p className="text-white/30 text-xs mt-2">Zero filler words detected</p>
                        </div>
                    )}
                </div>

                {/* NEW: 9 Habits for Clearer Speaking */}
                {analysis.habits && (
                    <div className="col-span-2 space-y-6">
                        {/* Section Header */}
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                🎯 Speaking Habits
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="text-white/60 text-sm font-medium">Habits Score</span>
                                <span
                                    className="text-lg font-bold px-3 py-1 rounded-full"
                                    style={{
                                        background: habitsScore >= 80 ? 'rgba(16,185,129,0.1)' :
                                            habitsScore >= 60 ? 'rgba(34,211,238,0.1)' :
                                                'rgba(245,158,11,0.1)',
                                        color: habitsScore >= 80 ? '#10b981' :
                                            habitsScore >= 60 ? '#22d3ee' : '#f59e0b',
                                        border: `1px solid ${habitsScore >= 80 ? 'rgba(16,185,129,0.2)' :
                                            habitsScore >= 60 ? 'rgba(34,211,238,0.2)' :
                                                'rgba(245,158,11,0.2)'}`
                                    }}
                                >
                                    {habitsScore}%
                                </span>
                            </div>
                        </div>

                        {/* 1. DELIVERY HABITS */}
                        <div className="glass-strong p-6">
                            <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
                                GROUP 1: DELIVERY (HOW YOU SAY IT)
                            </h4>
                            <div className="grid md:grid-cols-3 gap-4">
                                {/* Habit 1: Pause More */}
                                <HabitCard
                                    icon="⏸️"
                                    title="Pausing"
                                    score={pauses.pauseScore}
                                    metric={`${pauses.strategicPauses} strategic`}
                                    feedback={pauses.feedback}
                                />
                                {/* Habit 2: Rate/Tempo */}
                                <HabitCard
                                    icon="🎚️"
                                    title="Pace Variety"
                                    score={rate.variabilityScore}
                                    metric={`${rate.minWpm}-${rate.maxWpm} WPM`}
                                    feedback={rate.feedback}
                                />
                                {/* Habit 3: Declarative (Hedging) */}
                                <HabitCard
                                    icon="💬"
                                    title="Clarity"
                                    score={declarative.declarativeScore}
                                    metric={declarative.hedgingCount === 0 ? "Direct speech" : `${declarative.hedgingCount} hedges`}
                                    feedback={declarative.feedback}
                                />
                            </div>
                        </div>

                        {/* 2. VOCAL HABITS */}
                        <div className="glass-strong p-6">
                            <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
                                GROUP 2: VOCAL (YOUR VOICE MECHANICS)
                            </h4>
                            <div className="grid md:grid-cols-2 gap-4 mb-4">
                                {/* Habit 6: Volume */}
                                <HabitCard
                                    icon="🔊"
                                    title="Volume & Energy"
                                    score={volume.volumeScore}
                                    metric={volume.hasTrailingOff ? "Trails off at ends" : "Consistent projection"}
                                    feedback={volume.feedback}
                                />
                                {/* Habit 4 & 5 Guidance */}
                                <div className="p-4 bg-white/5 rounded-xl flex flex-col justify-center">
                                    <div className="flex items-center gap-2 mb-2 text-white/80">
                                        <span>🧘</span>
                                        <span className="font-medium">Voice Health</span>
                                    </div>
                                    <div className="text-xs text-white/50 space-y-1">
                                        <p>• Warm up before speaking (Habit 4)</p>
                                        <p>• Nose breathing default (Habit 5)</p>
                                    </div>
                                </div>
                            </div>

                            {/* Volume Chart */}
                            {volume.history && volume.history.length > 0 && (
                                <div className="p-4 bg-white/5 rounded-xl">
                                    <div className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Volume Projection Analysis</div>
                                    <VolumeChart data={volume.history} />
                                </div>
                            )}
                        </div>

                        {/* 3. COGNITIVE HABITS */}
                        <div className="glass-strong p-6">
                            <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
                                GROUP 3: COGNITIVE (HOW YOU THINK)
                            </h4>
                            <div className="grid md:grid-cols-3 gap-4">
                                {/* Habit 7: Thought Completion */}
                                <HabitCard
                                    icon="🧠"
                                    title="Thought Loops"
                                    score={thoughtCompletion.completionScore}
                                    metric={thoughtCompletion.veryLongSentences > 0 ? "Run-on sentences" : "Clear thoughts"}
                                    feedback={thoughtCompletion.feedback}
                                />
                                {/* Habit 8: Frameworks */}
                                <HabitCard
                                    icon="📐"
                                    title="Structure (CCC)"
                                    score={frameworks.frameworkScore}
                                    metric={frameworks.hasContext ? "Has Context" : "Needs Context"}
                                    feedback={frameworks.feedback}
                                />
                                {/* Habit 9: Analogies */}
                                <HabitCard
                                    icon="💡"
                                    title="Analogies"
                                    score={analogies.analogyScore}
                                    metric={`${analogies.analogyCount} used`}
                                    feedback={analogies.feedback}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid md:grid-cols-2 gap-8 reveal reveal-delay-5">
                {/* NEW: Fluency Patterns (Stuttering Analysis) */}
                {fluency && (
                    <div className="glass-strong p-8">
                        <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest mb-6 flex items-center gap-2">
                            <span>🌊</span> FLUENCY PROFILE
                        </h3>

                        {/* Fluency Score */}
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-white/70">Fluency Score</span>
                            <div className="flex items-center gap-2">
                                <span
                                    className="text-2xl font-bold"
                                    style={{
                                        color: fluency.score >= 85 ? '#10b981' :
                                            fluency.score >= 70 ? '#22d3ee' :
                                                fluency.score >= 50 ? '#f59e0b' : '#ef4444'
                                    }}
                                >
                                    {fluency.score}
                                </span>
                                <span
                                    className="text-xs px-2 py-1 rounded-full text-white"
                                    style={{
                                        background: fluency.severity === 'minimal' ? 'rgba(16,185,129,0.2)' :
                                            fluency.severity === 'mild' ? 'rgba(34,211,238,0.2)' :
                                                fluency.severity === 'moderate' ? 'rgba(245,158,11,0.2)' :
                                                    'rgba(239,68,68,0.2)',
                                        color: fluency.severity === 'minimal' ? '#10b981' :
                                            fluency.severity === 'mild' ? '#22d3ee' :
                                                fluency.severity === 'moderate' ? '#f59e0b' : '#ef4444'
                                    }}
                                >
                                    {fluency.severity}
                                </span>
                            </div>
                        </div>

                        {/* Blocks And Repetitions Container */}
                        <div className="space-y-4">
                            {/* Blocks */}
                            <div className="p-3 bg-white/5 rounded-xl">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-white/60 text-sm">⏸️ Blocks (Pauses)</span>
                                    <span className="text-white font-medium">
                                        {fluency.blocks?.count || 0}
                                    </span>
                                </div>
                                {(fluency.blocks?.count || 0) > 0 && (
                                    <div className="text-xs text-white/40 mt-1">
                                        {fluency.blocks.blocks.slice(0, 2).map((block, i) => (
                                            <span key={i}>
                                                {i > 0 && ' • '}
                                                {block.duration}s before "{block.afterWord}"
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Repetitions */}
                            <div className="p-3 bg-white/5 rounded-xl">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-white/60 text-sm">🔄 Repetitions</span>
                                    <span className="text-white font-medium">
                                        {fluency.repetitions?.count || 0}
                                    </span>
                                </div>
                                {(fluency.repetitions?.count || 0) > 0 && (
                                    <div className="text-xs text-white/40 mt-1">
                                        {fluency.repetitions.repetitions.slice(0, 2).map((rep, i) => (
                                            <span key={i}>
                                                {i > 0 && ' • '}
                                                "{rep.word}" ×{rep.count}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Presence Metrics */}
                <div className="glass-strong p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span>👤</span> Presence
                    </h3>

                    <div className="space-y-4">
                        {/* Eye Contact */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-white/70">Eye Contact</span>
                                <span className="text-white font-medium">
                                    {presence.eyeContactPercentage}%
                                </span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${presence.eyeContactPercentage}%`,
                                        background: presence.eyeContactPercentage >= 70
                                            ? 'linear-gradient(90deg, #10b981, #22d3ee)'
                                            : 'linear-gradient(90deg, #f59e0b, #ef4444)'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Posture */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-white/70">Posture</span>
                                <span className="text-white font-medium">
                                    {presence.postureScore}%
                                </span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${presence.postureScore}%`,
                                        background: presence.postureScore >= 70
                                            ? 'linear-gradient(90deg, #10b981, #22d3ee)'
                                            : 'linear-gradient(90deg, #f59e0b, #ef4444)'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Clarity Score */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-white/70">Speech Clarity</span>
                                <span className="text-white font-medium">
                                    {speech.clarityScore}%
                                </span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${speech.clarityScore}%`,
                                        background: 'linear-gradient(90deg, #6366f1, #22d3ee)'
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recommendations */}
            {recommendations && recommendations.length > 0 && (
                <div className="glass-strong p-6 mt-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        💡 Recommendations
                    </h3>

                    <ul className="space-y-3">
                        {recommendations.map((rec, index) => {
                            // Handle both string and object recommendations
                            const icon = typeof rec === 'object' ? rec.icon : '→';
                            const text = typeof rec === 'object' ? rec.text : rec;
                            const priority = typeof rec === 'object' ? rec.priority : 'medium';

                            return (
                                <li
                                    key={index}
                                    className="flex items-start gap-3 p-3 rounded-xl"
                                    style={{
                                        background: priority === 'high' ? 'rgba(239,68,68,0.1)' :
                                            priority === 'low' ? 'rgba(16,185,129,0.1)' :
                                                'rgba(255,255,255,0.05)'
                                    }}
                                >
                                    <span className="text-lg mt-0.5">{icon}</span>
                                    <span className="text-white/80">{text}</span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default AnalysisView;

function HabitCard({ icon, title, score, metric, feedback }) {
    return (
        <div className="p-4 bg-white/5 rounded-xl transition-all hover:bg-white/10">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{icon}</span>
                <span className="text-white/80 font-medium">{title}</span>
            </div>
            <div className="text-2xl font-bold text-white mb-1">
                {score}%
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                        width: `${score}%`,
                        background: score >= 70
                            ? 'linear-gradient(90deg, #10b981, #22d3ee)'
                            : 'linear-gradient(90deg, #f59e0b, #ef4444)'
                    }}
                />
            </div>
            <div className="text-xs text-white/50">
                {metric}
            </div>
            <div className="text-xs text-white/40 mt-1 line-clamp-2" title={feedback}>
                {feedback}
            </div>
        </div>
    );
}

function VolumeChart({ data }) {
    if (!data || data.length === 0) return null;

    // Downsample for performance if needed
    const points = data.length > 200
        ? data.filter((_, i) => i % Math.ceil(data.length / 200) === 0)
        : data;

    const maxVal = Math.max(...points, 100);
    const height = 100;
    const width = 100;

    // Generate SVG path for the line
    const pathD = points.map((val, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - ((val / maxVal) * height);
        return `${x},${y}`;
    }).join(' ');

    // Generate area path for fill
    const areaD = `0,${height} ${pathD} ${width},${height}`;

    return (
        <div className="w-full h-32 relative mt-2">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                {/* Ideal Range Band (approx 25-60 out of 100 max) */}
                <rect x="0" y={height - (60 / maxVal * height)} width={width} height={(35 / maxVal * height)} fill="rgba(34, 211, 238, 0.1)" />
                <line x1="0" y1={height - (25 / maxVal * height)} x2={width} y2={height - (25 / maxVal * height)} stroke="rgba(34, 211, 238, 0.2)" strokeDasharray="2,2" vectorEffect="non-scaling-stroke" />

                {/* Gradient Definition */}
                <defs>
                    <linearGradient id="volGradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* The Filled Area */}
                <polyline points={areaD} fill="url(#volGradient)" />

                {/* The Line */}
                <polyline
                    points={pathD}
                    fill="none"
                    stroke="var(--accent-cyan)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>

            {/* Labels */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between text-[10px] text-white/30 font-mono">
                <span>100%</span>
                <span>0%</span>
            </div>
            <div className="text-[10px] text-cyan-400/50 text-right w-full mt-1">Ideal Range: 25-60%</div>
        </div>
    );
}
