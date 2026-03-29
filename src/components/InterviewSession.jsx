import { useEffect } from 'react';
import { INTERVIEW_STATES } from '../hooks/useInterview';

/**
 * Interview Session Component
 * Live interview with question display and audio recording
 */
export function InterviewSession({
    interview,
    isRecording,
    onStartRecording,
    onStopRecording,
    onTranscribe,
    onEvaluate,
    isProcessing,
    isGeneratingAudio
}) {
    const {
        state,
        currentQuestion,
        currentQuestionIndex,
        questions,
        answerTime,
        isSpeaking,
        askCurrentQuestion,
        submitAnswer,
        addEvaluation,
        skipQuestion,
        endInterview
    } = interview;

    // Auto-ask question when ready (with small delay to allow UI to update)
    useEffect(() => {
        if (state === INTERVIEW_STATES.READY) {
            // Small delay to let UI render first
            const timer = setTimeout(() => {
                askCurrentQuestion();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [state, askCurrentQuestion]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartAnswer = () => {
        onStartRecording();
    };

    const handleStopAnswer = async () => {
        const audioBlob = await onStopRecording();

        // Transcribe the answer
        const answer = submitAnswer('Processing...');

        if (window.posthog) {
            window.posthog.capture('interview_answer_submitted', {
                category: currentQuestion?.category,
                duration: answer.duration
            });
        }

        try {
            const transcription = await onTranscribe(audioBlob);
            answer.transcript = transcription.text || '[No speech detected]';

            // Evaluate the answer
            const evaluation = await onEvaluate(currentQuestion, answer.transcript, { duration: answer.duration });
            addEvaluation(evaluation);
        } catch (err) {
            console.error('Answer processing error:', err);
            addEvaluation({
                score: 5,
                strengths: ['Attempted the question'],
                improvements: ['Try again with clearer audio'],
                sampleAnswer: ''
            });
        }
    };

    const progress = questions.length > 0
        ? ((currentQuestionIndex + 1) / questions.length) * 100
        : 0;

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-strong" style={{ flex: 1, padding: '24px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Progress Bar */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '16px'
                    }}>
                        <div style={{
                            flex: 1,
                            height: '4px',
                            background: 'rgba(255,255,255,0.2)',
                            borderRadius: '2px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${progress}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #10b981, #6366f1)',
                                transition: 'width 0.5s ease'
                            }} />
                        </div>
                        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: '600' }}>
                            {currentQuestionIndex + 1} / {questions.length}
                        </span>
                    </div>

                    <div style={{
                        padding: '20px',
                        borderRadius: '20px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)'
                    }}>
                        {isGeneratingAudio && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                color: '#c4b5fd',
                                marginBottom: '16px'
                            }}>
                                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                                <span>Preparing question...</span>
                            </div>
                        )}

                        {currentQuestion && (
                            <div>
                                <div style={{
                                    display: 'inline-block',
                                    padding: '4px 12px',
                                    background: 'rgba(99,102,241,0.3)',
                                    borderRadius: '20px',
                                    fontSize: '11px',
                                    color: '#a5b4fc',
                                    marginBottom: '10px',
                                    fontWeight: '500'
                                }}>
                                    {currentQuestion.category}
                                </div>
                                <h2 style={{
                                    color: 'white',
                                    fontSize: '22px',
                                    fontWeight: '600',
                                    lineHeight: '1.5'
                                }}>
                                    {isSpeaking && <span style={{ marginRight: '10px' }}>🔊</span>}
                                    {currentQuestion.text}
                                </h2>
                            </div>
                        )}

                        {state === INTERVIEW_STATES.ASKING && (
                            <div style={{
                                marginTop: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#f59e0b',
                                fontSize: '14px'
                            }}>
                                <div style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: '#f59e0b',
                                    animation: 'pulse 2s infinite'
                                }} />
                                Interviewer is speaking...
                            </div>
                        )}

                        {state === INTERVIEW_STATES.EVALUATING && (
                            <div style={{
                                marginTop: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#6366f1',
                                fontSize: '14px'
                            }}>
                                <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                                Analyzing your answer...
                            </div>
                        )}

                        {state === INTERVIEW_STATES.LISTENING && (
                            <div style={{
                                marginTop: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.7)' }}>
                                    <div style={{
                                        width: '10px',
                                        height: '10px',
                                        borderRadius: '50%',
                                        background: isRecording ? '#ef4444' : '#6366f1'
                                    }} />
                                    <span>Answer time</span>
                                </div>
                                <span style={{
                                    color: 'white',
                                    fontFamily: 'monospace',
                                    fontSize: '18px',
                                    fontWeight: '600'
                                }}>
                                    {formatTime(answerTime)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            {/* Controls */}
            <div className="glass-strong" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Tips */}
                        {state === INTERVIEW_STATES.LISTENING && currentQuestion?.keyPoints && (
                            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
                                💡 Key points: {currentQuestion.keyPoints.slice(0, 2).join(' • ')}
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        {/* Skip Button */}
                        <button
                            onClick={() => {
                                if (window.posthog) window.posthog.capture('interview_question_skipped');
                                skipQuestion();
                            }}
                            disabled={state === INTERVIEW_STATES.EVALUATING || isProcessing || isGeneratingAudio}
                            className="btn btn-secondary"
                        >
                            {isGeneratingAudio ? '⏳ Wait...' : '⏭️ Skip'}
                        </button>

                        {/* Main Action Button */}
                        {state === INTERVIEW_STATES.LISTENING && !isRecording ? (
                            <button
                                onClick={handleStartAnswer}
                                className="btn btn-success"
                                style={{ padding: '12px 32px' }}
                            >
                                🎤 Start Speaking
                            </button>
                        ) : state === INTERVIEW_STATES.LISTENING && isRecording ? (
                            <button
                                onClick={handleStopAnswer}
                                className="btn btn-danger"
                                style={{ padding: '12px 32px' }}
                            >
                                ✓ Done Answering
                            </button>
                        ) : null}

                        {/* End Interview */}
                        <button
                            onClick={endInterview}
                            disabled={isGeneratingAudio}
                            className="btn btn-secondary"
                            style={{
                                background: 'rgba(239,68,68,0.15)',
                                borderColor: 'rgba(239,68,68,0.3)',
                                color: '#fca5a5'
                            }}
                        >
                            End Interview
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default InterviewSession;
