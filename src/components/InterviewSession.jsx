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
    isGeneratingAudio,
    liveStatus,
    onQuestionAsked,
    onTurnTranscriptReady,
    onAnswerComplete
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
        recordLiveAnswer,
        addEvaluation,
        skipQuestion,
        endInterview
    } = interview;

    // Non-live interviews auto-ask the next question when ready.
    useEffect(() => {
        if (state === INTERVIEW_STATES.READY && liveStatus?.mode !== 'live') {
            onQuestionAsked?.(currentQuestion, currentQuestionIndex);
            askCurrentQuestion();
        }
    }, [state, askCurrentQuestion, currentQuestion, currentQuestionIndex, onQuestionAsked, liveStatus?.mode]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartAnswer = () => {
        onStartRecording();
    };

    const handleStopAnswer = async () => {
        let audioBlob;
        let transcriptText = '';
        try {
            const liveResult = await onStopRecording();
            audioBlob = liveResult?.blob || liveResult || null;
            transcriptText = typeof liveResult?.transcript === 'string' ? liveResult.transcript : '';
        } catch (err) {
            console.error('Failed to stop recording:', err);
            return;
        }

        if (liveStatus?.mode === 'live' && !audioBlob) {
            return;
        }

        let liveAnswerTranscript = transcriptText;

        if (liveStatus?.mode === 'live') {
            try {
                if (audioBlob) {
                    const liveTranscription = await onTranscribe?.(audioBlob);
                    const normalizedLiveTranscript = typeof liveTranscription?.text === 'string'
                        ? liveTranscription.text.trim()
                        : '';

                    if (normalizedLiveTranscript) {
                        liveAnswerTranscript = normalizedLiveTranscript;
                    }
                }
            } catch (err) {
                console.warn('Live answer transcription failed, falling back to Gemini transcript snapshot:', err);
            }

            if (!liveAnswerTranscript) {
                liveAnswerTranscript = liveStatus?.lastTranscript || currentQuestion?.text || '[Live answer saved]';
            }
        }

        const answer = liveStatus?.mode === 'live'
            ? recordLiveAnswer(liveAnswerTranscript, {
                duration: 0,
                keepListening: true
            })
            : submitAnswer('Processing...');

        if (window.posthog) {
            window.posthog.capture('interview_answer_submitted', {
                category: currentQuestion?.category,
                duration: answer.duration
            });
        }

        if (liveStatus?.mode === 'live') {
            void onTurnTranscriptReady?.({
                question: currentQuestion,
                questionIndex: currentQuestionIndex,
                transcript: liveAnswerTranscript,
                duration: answer.duration,
                skipped: false,
                assistantText: liveStatus?.lastAssistantText || currentQuestion?.text || '',
                audioBlob
            });

            void onAnswerComplete?.({
                question: currentQuestion,
                questionIndex: currentQuestionIndex,
                transcript: liveAnswerTranscript,
                duration: answer.duration,
                evaluation: null,
                skipped: false,
                assistantText: liveStatus?.lastAssistantText || currentQuestion?.text || '',
                audioBlob
            });
            return;
        }

        try {
            const transcription = await onTranscribe(audioBlob);
            const transcriptText = transcription.text || '[No speech detected]';
            answer.transcript = transcriptText;
            void onTurnTranscriptReady?.({
                question: currentQuestion,
                questionIndex: currentQuestionIndex,
                transcript: transcriptText,
                duration: answer.duration,
                skipped: false,
                assistantText: liveStatus?.lastAssistantText || currentQuestion?.text || '',
                audioBlob
            });

            // Evaluate the answer
            const evaluation = await onEvaluate(currentQuestion, transcriptText, { duration: answer.duration });
            void onAnswerComplete?.({
                question: currentQuestion,
                questionIndex: currentQuestionIndex,
                transcript: transcriptText,
                duration: answer.duration,
                evaluation,
                skipped: false,
                assistantText: liveStatus?.lastAssistantText || currentQuestion?.text || '',
                audioBlob
            });
            addEvaluation(evaluation);
        } catch (err) {
            console.error('Answer processing error:', err);
            const fallbackEvaluation = {
                score: 5,
                strengths: ['Attempted the question'],
                improvements: ['Try again with clearer audio'],
                sampleAnswer: ''
            };
            void onTurnTranscriptReady?.({
                question: currentQuestion,
                questionIndex: currentQuestionIndex,
                transcript: '[No speech detected]',
                duration: answer.duration,
                skipped: false,
                assistantText: liveStatus?.lastAssistantText || currentQuestion?.text || '',
                audioBlob
            });
            void onAnswerComplete?.({
                question: currentQuestion,
                questionIndex: currentQuestionIndex,
                transcript: '[No speech detected]',
                duration: answer.duration,
                evaluation: fallbackEvaluation,
                skipped: false,
                assistantText: liveStatus?.lastAssistantText || currentQuestion?.text || '',
                audioBlob
            });
            addEvaluation(fallbackEvaluation);
        }
    };

    const progress = questions.length > 0
        ? ((currentQuestionIndex + 1) / questions.length) * 100
        : 0;

    return (
        <div className="flex h-full flex-col gap-5 overflow-auto text-text">
            <div className="refined-card flex flex-1 flex-col gap-5 overflow-auto p-6">
                    {/* Progress Bar */}
                    <div className="mb-4 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container-high">
                            <div className="h-full rounded-full bg-primary-container transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-sm font-semibold text-on-surface-variant">
                            {currentQuestionIndex + 1} / {questions.length}
                        </span>
                    </div>

                    {liveStatus?.mode === 'live' && (
                        <div className="flex items-center justify-between gap-3 rounded-[18px] border border-outline-variant bg-surface-container-low px-4 py-3 text-sm">
                            <div className="flex items-center gap-2 text-text">
                                <div className={`size-2.5 rounded-full ${liveStatus.isConnected ? 'bg-success' : liveStatus.isConnecting ? 'bg-warning animate-pulse' : 'bg-danger'}`} />
                                <span>
                                    {liveStatus.isConnected
                                        ? 'Gemini 3.1 Flash Live connected'
                                        : liveStatus.isConnecting
                                            ? 'Connecting Gemini 3.1 Flash Live...'
                                            : 'Gemini 3.1 Flash Live disconnected'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                                {liveStatus.turnStatus ? <span>{liveStatus.turnStatus}</span> : null}
                                {liveStatus.lastInterrupted && <span className="text-warning">Interrupted and resumed</span>}
                            </div>
                        </div>
                    )}

                    {liveStatus?.mode === 'live' && liveStatus?.diagnostics && (
                        <div className="rounded-[18px] border border-outline-variant bg-surface-container-low px-4 py-3 text-xs text-on-surface-variant">
                            <div className="mb-1 font-medium uppercase tracking-[0.05em] text-text">Gemini diagnostics</div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                                <span>Event: {liveStatus.diagnostics.lastEvent || 'idle'}</span>
                                <span>Turn state: {liveStatus.turnState || 'idle'}</span>
                                <span>Messages: {liveStatus.diagnostics.messagesReceived}</span>
                                <span>Audio chunks: {liveStatus.diagnostics.audioChunksPlayed}</span>
                                <span>Audio received: {liveStatus.diagnostics.lastResponseHadAudio ? 'yes' : 'no'}</span>
                                {liveStatus.diagnostics.lastCloseCode ? (
                                    <span>Close code: {liveStatus.diagnostics.lastCloseCode}</span>
                                ) : null}
                                {liveStatus.diagnostics.lastCloseReason ? (
                                    <span>Reason: {liveStatus.diagnostics.lastCloseReason}</span>
                                ) : null}
                                {liveStatus.error ? <span className="text-danger">Error: {liveStatus.error}</span> : null}
                            </div>
                        </div>
                    )}

                    <div className="rounded-[18px] border border-outline-variant bg-surface-container-low p-5">
                        {isGeneratingAudio && (
                            <div className="mb-4 flex items-center gap-3 text-secondary">
                                <div className="spinner h-4 w-4 border-2" />
                                <span>Preparing question...</span>
                            </div>
                        )}

                        {currentQuestion && !(liveStatus?.mode === 'live' && currentQuestion?.isIntroPrompt) && (
                            <div>
                                <div className="mb-2 inline-flex rounded-full border border-outline-variant bg-surface px-3 py-1 text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                                    {currentQuestion.category}
                                </div>
                                <h2 className="text-[22px] font-semibold leading-[1.5] text-text">
                                    {isSpeaking && <span style={{ marginRight: '10px' }}>🔊</span>}
                                    {currentQuestion.text}
                                </h2>
                                {liveStatus?.mode === 'live' && liveStatus.lastAssistantText && (
                                    <div className="mt-3 rounded-[18px] border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface-variant">
                                        <div className="mb-1 text-[11px] uppercase tracking-[0.05em]">Live response</div>
                                        {liveStatus.lastAssistantText}
                                    </div>
                                )}
                            </div>
                        )}

                        {liveStatus?.mode === 'live' && currentQuestion?.isIntroPrompt && (
                            <div className="rounded-[18px] border border-dashed border-outline-variant bg-surface px-4 py-4 text-sm text-on-surface-variant">
                                <div className="mb-1 text-[11px] uppercase tracking-[0.05em] text-text">Ready when you are</div>
                                <p>Press Start Interview, then say hello or introduce yourself. The interviewer will begin after your opening words.</p>
                            </div>
                        )}

                        {state === INTERVIEW_STATES.ASKING && (
                            <div className="mt-4 flex items-center gap-2 text-warning text-sm">
                                <div className="size-2 rounded-full bg-warning animate-pulse" />
                                Interviewer is speaking...
                            </div>
                        )}

                        {state === INTERVIEW_STATES.PROCESSING && liveStatus?.mode !== 'live' && (
                            <div className="mt-4 flex items-center gap-2 text-primary-container text-sm">
                                <div className="spinner h-3.5 w-3.5 border-2" />
                                Processing your response...
                            </div>
                        )}

                        {state === INTERVIEW_STATES.EVALUATING && (
                            <div className="mt-4 flex items-center gap-2 text-primary-container text-sm">
                                <div className="spinner h-3.5 w-3.5 border-2" />
                                Analyzing your answer...
                            </div>
                        )}

                        {state === INTERVIEW_STATES.LISTENING && (
                            <div className="mt-4 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-on-surface-variant">
                                    <div className={`size-2.5 rounded-full ${isRecording ? 'bg-danger' : 'bg-primary-container'}`} />
                                    <span>
                                        {liveStatus?.mode === 'live'
                                            ? (isRecording ? 'Live answer time' : 'Ready for next answer')
                                            : 'Answer time'}
                                    </span>
                                </div>
                                {(!liveStatus?.mode || liveStatus?.mode !== 'live' || isRecording) && (
                                    <span className="font-mono text-lg font-semibold text-text">
                                        {formatTime(answerTime)}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            {/* Controls */}
            <div className="refined-card px-6 py-5">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        {/* Tips */}
                        {state === INTERVIEW_STATES.LISTENING && currentQuestion?.keyPoints && (
                            <div className="text-sm text-on-surface-variant">
                                💡 Key points: {currentQuestion.keyPoints.slice(0, 2).join(' • ')}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3">
                        {/* Skip Button */}
                        <button
                            onClick={() => {
                                if (window.posthog) window.posthog.capture('interview_question_skipped');
                                void onTurnTranscriptReady?.({
                                    question: currentQuestion,
                                    questionIndex: currentQuestionIndex,
                                    transcript: '[Skipped]',
                                    duration: 0,
                                    skipped: true,
                                    assistantText: liveStatus?.lastAssistantText || currentQuestion?.text || '',
                                    audioBlob: null
                                });
                                void onAnswerComplete?.({
                                    question: currentQuestion,
                                    questionIndex: currentQuestionIndex,
                                    transcript: '[Skipped]',
                                    duration: 0,
                                    evaluation: {
                                        score: 0,
                                        strengths: [],
                                        improvements: ['Question was skipped'],
                                        sampleAnswer: '',
                                        skipped: true
                                    },
                                    skipped: true,
                                    assistantText: liveStatus?.lastAssistantText || currentQuestion?.text || '',
                                    audioBlob: null
                                });
                                skipQuestion();
                            }}
                            disabled={state === INTERVIEW_STATES.EVALUATING || isProcessing || isGeneratingAudio}
                            className="refined-button-secondary"
                        >
                            {isGeneratingAudio ? '⏳ Wait...' : '⏭️ Skip'}
                        </button>

                        {/* Main Action Button */}
                        {state === INTERVIEW_STATES.LISTENING && !isRecording ? (
                            <button
                                onClick={handleStartAnswer}
                                className="refined-button-primary px-8 py-3"
                            >
                                {liveStatus?.mode === 'live' ? '🎬 Start Interview' : '🎤 Start Speaking'}
                            </button>
                        ) : state === INTERVIEW_STATES.LISTENING && isRecording ? (
                        <button
                            onClick={handleStopAnswer}
                                className="refined-button-danger px-8 py-3"
                            >
                                ✓ Done Answering
                            </button>
                        ) : null}

                        {/* End Interview */}
                        <button
                            onClick={endInterview}
                            disabled={isGeneratingAudio}
                            className="refined-button-secondary"
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
