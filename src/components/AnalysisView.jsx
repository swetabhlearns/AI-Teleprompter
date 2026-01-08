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
        <div className="h-full overflow-auto p-6">
            {/* Header Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {/* Overall Score */}
                <div className="stat-card col-span-2 md:col-span-1">
                    <div
                        className="stat-value"
                        style={{
                            background: `linear-gradient(135deg, ${overallScoreData?.color || '#6366f1'}, #22d3ee)`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}
                    >
                        {analysis.summary.overallScore}
                    </div>
                    <div className="stat-label">Overall Score</div>
                    {overallScoreData && (
                        <div
                            className="text-xs font-medium mt-1"
                            style={{ color: overallScoreData.color }}
                        >
                            {overallScoreData.label}
                        </div>
                    )}
                </div>

                {/* WPM */}
                <div className="stat-card">
                    <div
                        className="stat-value"
                        style={{
                            background: `linear-gradient(135deg, ${wpmData?.color || '#6366f1'}, #22d3ee)`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}
                    >
                        {analysis.summary.wpm}
                    </div>
                    <div className="stat-label">Words/Min</div>
                    {wpmData && (
                        <div
                            className="text-xs font-medium mt-1"
                            style={{ color: wpmData.color }}
                        >
                            {wpmData.label}
                        </div>
                    )}
                </div>

                {/* Duration */}
                <div className="stat-card">
                    <div className="stat-value">
                        {formatDuration(analysis.summary.duration)}
                    </div>
                    <div className="stat-label">Duration</div>
                </div>

                {/* Word Count */}
                <div className="stat-card">
                    <div className="stat-value">
                        {analysis.summary.wordCount}
                    </div>
                    <div className="stat-label">Total Words</div>
                </div>
            </div>

            {/* Detailed Analysis */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Filler Words */}
                <div className="glass-strong p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        🗣️ Filler Words
                    </h3>

                    {analysis.speech.fillerWords.count > 0 ? (
                        <>
                            <div className="text-4xl font-bold text-yellow-400 mb-4">
                                {analysis.speech.fillerWords.count}
                                <span className="text-lg text-white/50 font-normal ml-2">found</span>
                            </div>

                            <div className="space-y-2">
                                {analysis.speech.fillerWords.occurrences.slice(0, 5).map((item) => (
                                    <div
                                        key={item.word}
                                        className="flex items-center justify-between p-2 bg-white/5 rounded-lg"
                                    >
                                        <span className="text-white/80 font-mono">"{item.word}"</span>
                                        <span className="text-white/50 text-sm">{item.count}×</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-4">
                            <div className="text-4xl mb-2">🎉</div>
                            <p className="text-green-400 font-medium">No filler words detected!</p>
                            <p className="text-white/50 text-sm mt-1">Excellent clarity</p>
                        </div>
                    )}
                </div>

                {/* NEW: Fluency Patterns (Stuttering Analysis) */}
                {analysis.fluency && (
                    <div className="glass-strong p-6">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            🌊 Fluency Patterns
                        </h3>

                        {/* Fluency Score */}
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-white/70">Fluency Score</span>
                            <div className="flex items-center gap-2">
                                <span
                                    className="text-2xl font-bold"
                                    style={{
                                        color: analysis.fluency.score >= 85 ? '#10b981' :
                                            analysis.fluency.score >= 70 ? '#22d3ee' :
                                                analysis.fluency.score >= 50 ? '#f59e0b' : '#ef4444'
                                    }}
                                >
                                    {analysis.fluency.score}
                                </span>
                                <span
                                    className="text-xs px-2 py-1 rounded-full"
                                    style={{
                                        background: analysis.fluency.severity === 'minimal' ? 'rgba(16,185,129,0.2)' :
                                            analysis.fluency.severity === 'mild' ? 'rgba(34,211,238,0.2)' :
                                                analysis.fluency.severity === 'moderate' ? 'rgba(245,158,11,0.2)' :
                                                    'rgba(239,68,68,0.2)',
                                        color: analysis.fluency.severity === 'minimal' ? '#10b981' :
                                            analysis.fluency.severity === 'mild' ? '#22d3ee' :
                                                analysis.fluency.severity === 'moderate' ? '#f59e0b' : '#ef4444'
                                    }}
                                >
                                    {analysis.fluency.severity}
                                </span>
                            </div>
                        </div>

                        {/* Blocks */}
                        <div className="mb-4 p-3 bg-white/5 rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-white/60 text-sm">⏸️ Blocks (Pauses)</span>
                                <span className="text-white font-medium">
                                    {analysis.fluency.blocks.count}
                                </span>
                            </div>
                            {analysis.fluency.blocks.count > 0 && (
                                <div className="text-xs text-white/40 mt-1">
                                    {analysis.fluency.blocks.blocks.slice(0, 2).map((block, i) => (
                                        <span key={i}>
                                            {i > 0 && ' • '}
                                            {block.duration}s before "{block.afterWord}"
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Repetitions */}
                        <div className="mb-4 p-3 bg-white/5 rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-white/60 text-sm">🔄 Repetitions</span>
                                <span className="text-white font-medium">
                                    {analysis.fluency.repetitions.count}
                                </span>
                            </div>
                            {analysis.fluency.repetitions.count > 0 && (
                                <div className="text-xs text-white/40 mt-1">
                                    {analysis.fluency.repetitions.repetitions.slice(0, 2).map((rep, i) => (
                                        <span key={i}>
                                            {i > 0 && ' • '}
                                            "{rep.word}" ×{rep.count}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Pace Variation */}
                        <div className="p-3 bg-white/5 rounded-xl">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-white/60 text-sm">📊 Pace</span>
                                <span className="text-white/80 text-sm">
                                    {analysis.fluency.paceVariation.consistency}
                                </span>
                            </div>
                            {analysis.fluency.paceVariation.segments.length > 1 && (
                                <div className="flex items-end gap-1 h-8 mt-2">
                                    {analysis.fluency.paceVariation.segments.map((seg, i) => (
                                        <div
                                            key={i}
                                            className="flex-1 rounded-t"
                                            style={{
                                                height: `${Math.min(100, (seg.wpm / 180) * 100)}%`,
                                                minHeight: '4px',
                                                background: seg.wpm > 150 ? '#ef4444' :
                                                    seg.wpm > 120 ? '#22d3ee' :
                                                        seg.wpm > 80 ? '#10b981' : '#f59e0b'
                                            }}
                                            title={`${seg.wpm} WPM at ${seg.startTime}s`}
                                        />
                                    ))}
                                </div>
                            )}
                            <div className="text-xs text-white/40 mt-2 text-center">
                                Avg: {analysis.fluency.paceVariation.averageWpm} WPM
                            </div>
                        </div>
                    </div>
                )}

                {/* Presence Metrics */}
                <div className="glass-strong p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        👤 Presence
                    </h3>

                    <div className="space-y-4">
                        {/* Eye Contact */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-white/70">Eye Contact</span>
                                <span className="text-white font-medium">
                                    {analysis.presence.eyeContactPercentage}%
                                </span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${analysis.presence.eyeContactPercentage}%`,
                                        background: analysis.presence.eyeContactPercentage >= 70
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
                                    {analysis.presence.postureScore}%
                                </span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${analysis.presence.postureScore}%`,
                                        background: analysis.presence.postureScore >= 70
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
                                    {analysis.speech.clarityScore}%
                                </span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${analysis.speech.clarityScore}%`,
                                        background: 'linear-gradient(90deg, #6366f1, #22d3ee)'
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recommendations */}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
                <div className="glass-strong p-6 mt-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        💡 Recommendations
                    </h3>

                    <ul className="space-y-3">
                        {analysis.recommendations.map((rec, index) => {
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
