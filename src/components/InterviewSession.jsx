import { INTERVIEW_STATES } from '../hooks/useInterview';
import {
    MagicBadge,
    MagicButton,
    MagicCard,
    MagicDock,
    MagicSectionHeader
} from './ui/MagicUI';

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
    isProcessing,
    isGeneratingAudio,
    liveStatus,
    onTurnTranscriptReady,
    onAnswerComplete,
    onEndInterview
}) {
    const {
        state,
        currentQuestion,
        currentQuestionIndex,
        questions,
        answerTime,
        isSpeaking,
        skipQuestion,
        recordLiveAnswer,
    } = interview;

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

        if (!audioBlob) {
            return;
        }

        let liveAnswerTranscript = transcriptText;

        try {
            const liveTranscription = await onTranscribe?.(audioBlob);
            const normalizedLiveTranscript = typeof liveTranscription?.text === 'string'
                ? liveTranscription.text.trim()
                : '';

            if (normalizedLiveTranscript) {
                liveAnswerTranscript = normalizedLiveTranscript;
            }
        } catch (err) {
            console.warn('Live answer transcription failed, falling back to Gemini transcript snapshot:', err);
        }

        if (!liveAnswerTranscript) {
            liveAnswerTranscript = liveStatus?.lastTranscript || currentQuestion?.text || '[Live answer saved]';
        }

        const answer = recordLiveAnswer(liveAnswerTranscript, {
            duration: 0,
            keepListening: true
        });

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
    };

    const progress = questions.length > 0
        ? ((currentQuestionIndex + 1) / questions.length) * 100
        : 0;

    return (
        <div className="flex h-full flex-col gap-5 overflow-auto text-slate-950">
            <MagicCard className="flex flex-1 flex-col gap-5 p-5 md:p-6" hover={false}>
                <MagicSectionHeader
                    eyebrow="Admissions Simulation"
                    title="Interview in progress"
                    description="Gemini is running a realistic MBA admissions conversation using the selected school, interview type, duration, and candidate context."
                    right={(
                        <MagicBadge className="border-slate-200 bg-slate-50 text-slate-600">
                            {state === INTERVIEW_STATES.LISTENING
                                ? 'Listening'
                                : state === INTERVIEW_STATES.ASKING
                                    ? 'Asking'
                                    : state === INTERVIEW_STATES.PROCESSING
                                        ? 'Processing'
                                        : state === INTERVIEW_STATES.EVALUATING
                                            ? 'Evaluating'
                                            : 'Ready'}
                        </MagicBadge>
                    )}
                />

                <div className="flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-slate-900 transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-sm font-semibold text-slate-600">
                        {currentQuestionIndex + 1} / {questions.length}
                    </span>
                </div>

                {liveStatus?.mode === 'live' && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-white/75 px-4 py-3 text-sm shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
                            <div className="flex items-center gap-2 text-slate-700">
                            <div className={`size-2.5 rounded-full ${liveStatus.isConnected ? 'bg-slate-900' : liveStatus.isConnecting ? 'bg-slate-500 animate-pulse' : 'bg-slate-400'}`} />
                            <span>
                                {liveStatus.isConnected
                                    ? 'Gemini Live connected'
                                    : liveStatus.isConnecting
                                        ? 'Connecting Gemini Live...'
                                        : 'Gemini Live disconnected'}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            {liveStatus.turnStatus ? <span>{liveStatus.turnStatus}</span> : null}
                            {liveStatus.lastInterrupted && <span className="text-amber-600">Interrupted and resumed</span>}
                        </div>
                    </div>
                )}

                {liveStatus?.mode === 'live' && liveStatus?.diagnostics && (
                    <div className="rounded-[18px] border border-slate-200 bg-white/75 px-4 py-3 text-xs text-slate-500 shadow-[0_14px_32px_rgba(15,23,42,0.05)]">
                        <div className="mb-1 font-medium uppercase tracking-[0.05em] text-slate-900">Session diagnostics</div>
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
                            {liveStatus.error ? <span className="text-rose-600">Error: {liveStatus.error}</span> : null}
                        </div>
                    </div>
                )}

                <div className="rounded-[22px] border border-slate-200 bg-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
                    {isGeneratingAudio && (
                        <div className="mb-4 flex items-center gap-3 text-emerald-700">
                            <div className="spinner h-4 w-4 border-2" />
                            <span>Preparing question...</span>
                        </div>
                    )}

                            {currentQuestion && !(liveStatus?.mode === 'live' && currentQuestion?.isIntroPrompt) && (
                        <div>
                            <MagicBadge className="mb-3">{currentQuestion.category}</MagicBadge>
                            <h2 className="text-[22px] font-semibold leading-[1.5] text-slate-950">
                                {isSpeaking && <span style={{ marginRight: '10px' }}>🔊</span>}
                                {currentQuestion.text}
                            </h2>
                            {liveStatus?.mode === 'live' && liveStatus.lastAssistantText && (
                                <div className="mt-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                    <div className="mb-1 text-[11px] uppercase tracking-[0.05em]">Live response</div>
                                    {liveStatus.lastAssistantText}
                                </div>
                            )}
                        </div>
                    )}

                    {liveStatus?.mode === 'live' && currentQuestion?.isIntroPrompt && (
                        <div className="rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                            <div className="mb-1 text-[11px] uppercase tracking-[0.05em] text-slate-900">Ready when you are</div>
                            <p>Press Start Interview, then say hello or introduce yourself. The interviewer will begin after your opening words.</p>
                        </div>
                    )}

                    {state === INTERVIEW_STATES.ASKING && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-amber-600">
                            <div className="size-2 rounded-full bg-amber-500 animate-pulse" />
                            Interviewer is speaking...
                        </div>
                    )}

                    {state === INTERVIEW_STATES.PROCESSING && liveStatus?.mode !== 'live' && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
                            <div className="spinner h-3.5 w-3.5 border-2" />
                            Processing your response...
                        </div>
                    )}

                    {state === INTERVIEW_STATES.EVALUATING && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
                            <div className="spinner h-3.5 w-3.5 border-2" />
                            Analyzing your answer...
                        </div>
                    )}

                    {state === INTERVIEW_STATES.LISTENING && (
                        <div className="mt-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-slate-500">
                                <div className={`size-2.5 rounded-full ${isRecording ? 'bg-slate-900' : 'bg-slate-400'}`} />
                                <span>
                                    {liveStatus?.mode === 'live'
                                        ? (isRecording ? 'Live answer time' : 'Ready for next answer')
                                        : 'Answer time'}
                                </span>
                            </div>
                            {(!liveStatus?.mode || liveStatus?.mode !== 'live' || isRecording) && (
                                <span className="font-mono text-lg font-semibold text-slate-950">
                                    {formatTime(answerTime)}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <MagicDock className="rounded-[24px] px-4 py-3">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-3">
                            {state === INTERVIEW_STATES.LISTENING && currentQuestion?.keyPoints && (
                                <div className="text-sm text-slate-600">
                                    💡 Key points: {currentQuestion.keyPoints.slice(0, 2).join(' • ')}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <MagicButton
                                onClick={() => {
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
                                variant="secondary"
                                className="!min-h-11 !px-5 !py-2.5 text-sm"
                            >
                                {isGeneratingAudio ? 'Wait...' : 'Skip'}
                            </MagicButton>

                            {state === INTERVIEW_STATES.LISTENING && !isRecording ? (
                                <MagicButton
                                    onClick={handleStartAnswer}
                                    variant="primary"
                                    className="!min-h-11 !px-6 !py-2.5 text-sm"
                                >
                                    {liveStatus?.mode === 'live' ? 'Begin Response' : 'Start Speaking'}
                                </MagicButton>
                            ) : state === INTERVIEW_STATES.LISTENING && isRecording ? (
                                <MagicButton
                                    onClick={handleStopAnswer}
                                    className="!min-h-11 !px-6 !py-2.5 text-sm !bg-slate-900 text-white hover:!bg-slate-800"
                                >
                                    Submit Response
                                </MagicButton>
                            ) : null}

                            <MagicButton
                                onClick={onEndInterview}
                                disabled={isGeneratingAudio}
                                variant="secondary"
                                className="!min-h-11 !px-5 !py-2.5 text-sm"
                            >
                                End Interview
                            </MagicButton>
                        </div>
                    </div>
                </MagicDock>
            </MagicCard>
        </div>
    );
}

export default InterviewSession;
