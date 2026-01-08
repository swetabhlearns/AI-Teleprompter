/**
 * Interview Results Component
 * Shows post-interview analysis and feedback
 */
export function InterviewResults({ results, onRestart, onGoHome }) {
    const {
        totalQuestions,
        answered,
        skipped,
        averageScore,
        questions,
        answers,
        evaluations
    } = results;

    const getScoreColor = (score) => {
        if (score >= 8) return '#10b981';
        if (score >= 6) return '#6366f1';
        if (score >= 4) return '#f59e0b';
        return '#ef4444';
    };

    const getScoreLabel = (score) => {
        if (score >= 8) return 'Excellent';
        if (score >= 6) return 'Good';
        if (score >= 4) return 'Needs Work';
        return 'Keep Practicing';
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '24px', overflow: 'auto' }}>
            {/* Header */}
            <div className="glass-strong" style={{ padding: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h2 style={{
                            fontSize: '26px',
                            fontWeight: '700',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            marginBottom: '8px'
                        }}>
                            <span style={{ fontSize: '32px' }}>📊</span>
                            Interview Complete!
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
                            Here's how you did in this practice session
                        </p>
                    </div>

                    {/* Overall Score */}
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '100px',
                            height: '100px',
                            borderRadius: '50%',
                            background: `conic-gradient(${getScoreColor(averageScore)} ${averageScore * 10}%, rgba(255,255,255,0.1) 0%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '8px'
                        }}>
                            <div style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: '50%',
                                background: '#0c1214',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <span style={{
                                    fontSize: '28px',
                                    fontWeight: '800',
                                    color: getScoreColor(averageScore)
                                }}>
                                    {averageScore}
                                </span>
                                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>/10</span>
                            </div>
                        </div>
                        <div style={{
                            marginTop: '8px',
                            color: getScoreColor(averageScore),
                            fontSize: '14px',
                            fontWeight: '600'
                        }}>
                            {getScoreLabel(averageScore)}
                        </div>
                    </div>
                </div>

                {/* Stats Row */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '16px',
                    marginTop: '24px'
                }}>
                    <div style={{
                        background: 'rgba(16,185,129,0.1)',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981' }}>{answered}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Answered</div>
                    </div>
                    <div style={{
                        background: 'rgba(245,158,11,0.1)',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b' }}>{skipped}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Skipped</div>
                    </div>
                    <div style={{
                        background: 'rgba(99,102,241,0.1)',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '28px', fontWeight: '700', color: '#6366f1' }}>{totalQuestions}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Total Questions</div>
                    </div>
                </div>
            </div>

            {/* Question-by-Question Breakdown */}
            <div className="glass-strong" style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
                <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: 'white',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    📝 Question-by-Question Review
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {questions.map((question, idx) => {
                        const answer = answers[idx] || {};
                        const evaluation = evaluations[idx] || {};
                        const isSkipped = evaluation.skipped;

                        return (
                            <div
                                key={idx}
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: '16px',
                                    padding: '20px',
                                    border: '1px solid rgba(255,255,255,0.08)'
                                }}
                            >
                                {/* Question Header */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '12px'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <span style={{
                                            display: 'inline-block',
                                            padding: '2px 10px',
                                            background: 'rgba(99,102,241,0.2)',
                                            borderRadius: '20px',
                                            fontSize: '11px',
                                            color: '#a5b4fc',
                                            marginBottom: '8px'
                                        }}>
                                            Q{idx + 1} • {question.category}
                                        </span>
                                        <h4 style={{
                                            color: 'white',
                                            fontSize: '15px',
                                            fontWeight: '600',
                                            lineHeight: '1.5'
                                        }}>
                                            {question.text}
                                        </h4>
                                    </div>

                                    {/* Score Badge */}
                                    {!isSkipped && (
                                        <div style={{
                                            minWidth: '50px',
                                            textAlign: 'center',
                                            padding: '8px 12px',
                                            borderRadius: '10px',
                                            background: `${getScoreColor(evaluation.score)}22`,
                                            color: getScoreColor(evaluation.score),
                                            fontWeight: '700',
                                            fontSize: '18px'
                                        }}>
                                            {evaluation.score}
                                        </div>
                                    )}
                                    {isSkipped && (
                                        <span style={{
                                            padding: '6px 12px',
                                            borderRadius: '8px',
                                            background: 'rgba(255,255,255,0.05)',
                                            color: 'rgba(255,255,255,0.4)',
                                            fontSize: '12px'
                                        }}>
                                            Skipped
                                        </span>
                                    )}
                                </div>

                                {/* Your Answer */}
                                {!isSkipped && answer.transcript && (
                                    <div style={{ marginBottom: '16px' }}>
                                        <div style={{
                                            fontSize: '12px',
                                            color: 'rgba(255,255,255,0.5)',
                                            marginBottom: '6px'
                                        }}>
                                            Your Answer ({answer.duration}s):
                                        </div>
                                        <div style={{
                                            padding: '12px 16px',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: '10px',
                                            color: 'rgba(255,255,255,0.8)',
                                            fontSize: '14px',
                                            lineHeight: '1.6',
                                            fontStyle: 'italic'
                                        }}>
                                            "{answer.transcript}"
                                        </div>
                                    </div>
                                )}

                                {/* Feedback */}
                                {!isSkipped && evaluation.strengths && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        {/* Strengths */}
                                        <div style={{
                                            padding: '12px',
                                            background: 'rgba(16,185,129,0.1)',
                                            borderRadius: '10px'
                                        }}>
                                            <div style={{
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                color: '#10b981',
                                                marginBottom: '6px'
                                            }}>
                                                ✓ Strengths
                                            </div>
                                            <ul style={{
                                                margin: 0,
                                                paddingLeft: '16px',
                                                color: 'rgba(255,255,255,0.7)',
                                                fontSize: '13px'
                                            }}>
                                                {evaluation.strengths.map((s, i) => (
                                                    <li key={i} style={{ marginBottom: '4px' }}>{s}</li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Improvements */}
                                        <div style={{
                                            padding: '12px',
                                            background: 'rgba(245,158,11,0.1)',
                                            borderRadius: '10px'
                                        }}>
                                            <div style={{
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                color: '#f59e0b',
                                                marginBottom: '6px'
                                            }}>
                                                → Improve
                                            </div>
                                            <ul style={{
                                                margin: 0,
                                                paddingLeft: '16px',
                                                color: 'rgba(255,255,255,0.7)',
                                                fontSize: '13px'
                                            }}>
                                                {evaluation.improvements?.map((s, i) => (
                                                    <li key={i} style={{ marginBottom: '4px' }}>{s}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}

                                {/* Model Answer */}
                                {!isSkipped && evaluation.sampleAnswer && (
                                    <div style={{ marginTop: '12px' }}>
                                        <details style={{ cursor: 'pointer' }}>
                                            <summary style={{
                                                fontSize: '12px',
                                                color: '#6366f1',
                                                fontWeight: '500'
                                            }}>
                                                💡 View Sample Answer
                                            </summary>
                                            <div style={{
                                                marginTop: '8px',
                                                padding: '12px',
                                                background: 'rgba(99,102,241,0.1)',
                                                borderRadius: '10px',
                                                color: 'rgba(255,255,255,0.8)',
                                                fontSize: '13px',
                                                lineHeight: '1.6'
                                            }}>
                                                {evaluation.sampleAnswer}
                                            </div>
                                        </details>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="glass-strong" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <button
                        onClick={onGoHome}
                        className="btn btn-secondary"
                    >
                        ← Back to Home
                    </button>
                    <button
                        onClick={onRestart}
                        className="btn btn-primary"
                        style={{ padding: '12px 32px' }}
                    >
                        🔄 Practice Again
                    </button>
                </div>
            </div>
        </div>
    );
}

export default InterviewResults;
