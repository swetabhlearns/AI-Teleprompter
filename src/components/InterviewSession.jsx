import { useEffect, useRef } from 'react';
import CameraView from './CameraView';
import FeedbackOverlay from './FeedbackOverlay';
import { INTERVIEW_STATES } from '../hooks/useInterview';

/**
 * Interview Session Component
 * Live interview with camera, question display, and recording
 */
export function InterviewSession({
    interview,
    stream,
    onStreamReady,
    mediaPipeReady,
    mediaPipeLoading,
    currentEyeContact,
    currentPosture,
    isRecording,
    onStartRecording,
    onStopRecording,
    onTranscribe,
    onEvaluate,
    isProcessing,
    isGeneratingAudio,
    onPregenerate
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
        if (state === INTERVIEW_STATES.READY && stream) {
            // Small delay to let UI render first
            const timer = setTimeout(() => {
                askCurrentQuestion();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [state, stream, askCurrentQuestion]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartAnswer = () => {
        if (stream) {
            onStartRecording(stream);
        }
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
            {/* Camera View with Overlays */}
            <div style={{
                flex: 1,
                position: 'relative',
                borderRadius: '20px',
                overflow: 'hidden',
                minHeight: '400px'
            }}>
                <CameraView
                    onStreamReady={onStreamReady}
                    isRecording={isRecording}
                />

                {/* Processing Overlay - Shows when generating audio */}
                {isGeneratingAudio && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 50
                    }}>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            border: '4px solid rgba(99,102,241,0.3)',
                            borderTopColor: '#6366f1',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }} />
                        <div style={{
                            marginTop: '20px',
                            color: 'white',
                            fontSize: '18px',
                            fontWeight: '600'
                        }}>
                            Preparing question...
                        </div>
                        <div style={{
                            marginTop: '8px',
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: '14px'
                        }}>
                            Generating human-like voice
                        </div>
                    </div>
                )}

                {/* Question Overlay */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 100%)',
                    padding: '24px',
                    zIndex: 10
                }}>
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

                    {/* Question Display */}
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
                                lineHeight: '1.5',
                                textShadow: '0 2px 10px rgba(0,0,0,0.5)'
                            }}>
                                {isSpeaking && <span style={{ marginRight: '10px' }}>🔊</span>}
                                {currentQuestion.text}
                            </h2>
                        </div>
                    )}

                    {/* State Indicators */}
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
                </div>

                {/* MediaPipe Feedback */}
                <FeedbackOverlay
                    eyeContact={currentEyeContact}
                    posture={currentPosture}
                    isActive={state === INTERVIEW_STATES.LISTENING && isRecording}
                    mediaPipeReady={mediaPipeReady}
                    mediaPipeLoading={mediaPipeLoading}
                />

                {/* Answer Timer (bottom left) */}
                {state === INTERVIEW_STATES.LISTENING && (
                    <div style={{
                        position: 'absolute',
                        bottom: '20px',
                        left: '20px',
                        padding: '12px 20px',
                        background: isRecording ? 'rgba(239,68,68,0.9)' : 'rgba(0,0,0,0.8)',
                        borderRadius: '50px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        zIndex: 10
                    }}>
                        {isRecording && (
                            <div style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                background: 'white',
                                animation: 'blink 1s infinite'
                            }} />
                        )}
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
