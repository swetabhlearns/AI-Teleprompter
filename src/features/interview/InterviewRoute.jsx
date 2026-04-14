import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { usePostHog } from 'posthog-js/react';
import InterviewSetup from '../../components/InterviewSetup';
import InterviewSession from '../../components/InterviewSession';
import { OatButton, OatCard } from '../../components/ui/OatComponents';
import { useRecorder } from '../../hooks/useRecorder';
import { useGroq } from '../../hooks/useGroq';
import { useInterview, INTERVIEW_STATES } from '../../hooks/useInterview';
import { useInterviewArchive } from '../../hooks/useInterviewArchive';
import { useKokoroTTS } from '../../hooks/useKokoroTTS';
import { useGeminiLive } from '../../hooks/useGeminiLive';
import { useInterviewUiStore } from '../../stores/interviewUiStore';
import { GEMINI_LIVE_TURN_STATES } from '../../utils/geminiLive';

export function InterviewRoute() {
  const navigate = useNavigate();
  const posthog = usePostHog();
  const interviewMode = useInterviewUiStore((state) => state.interviewMode);
  const setInterviewMode = useInterviewUiStore((state) => state.setInterviewMode);

  const liveCaptureRef = useRef(null);
  const liveCaptureActiveRef = useRef(false);
  const liveTurnContextRef = useRef(null);
  const currentArchiveSessionIdRef = useRef(null);
  const currentArchiveTurnIndexRef = useRef(0);
  const lastArchiveTurnIndexRef = useRef(0);
  const geminiTransitionHandledRef = useRef('');
  const archivedSessionFinalizedRef = useRef(null);
  const archivedSessionFailedRef = useRef(null);

  const { transcribeAudio, generateInterviewQuestions, evaluateAnswer, isLoading: isTranscribing } = useGroq();
  const interviewArchive = useInterviewArchive();
  const kokoroTTS = useKokoroTTS({ enabled: interviewMode !== 'live' });
  const geminiLive = useGeminiLive();
  const useLiveInterview = interviewMode === 'live';
  const { startRecording, stopRecording } = useRecorder();

  const interview = useInterview({
    speak: useLiveInterview ? geminiLive.sendPrompt : kokoroTTS.speak,
    stop: useLiveInterview ? geminiLive.reset : kokoroTTS.stop,
    isSpeaking: useLiveInterview ? geminiLive.isSpeaking : kokoroTTS.isSpeaking
  });

  const { state: interviewState, failInterview, beginListening: beginInterviewListening } = interview;
  const geminiLiveTurnState = geminiLive.turnState;
  const geminiLiveDiagnostics = geminiLive.diagnostics;
  const geminiLiveLastEvent = geminiLiveDiagnostics?.lastEvent || '';
  const geminiLiveMessageCount = geminiLiveDiagnostics?.messagesReceived || 0;
  const acknowledgeGeminiRecovery = geminiLive.acknowledgeRecovery;
  const geminiLiveError = geminiLive.error;
  useEffect(() => {
    if (interviewMode !== 'live') {
      liveCaptureActiveRef.current = false;
      liveCaptureRef.current = null;
      liveTurnContextRef.current = null;
      geminiLive.reset();
      return;
    }

    if (geminiLiveError && ![INTERVIEW_STATES.IDLE, INTERVIEW_STATES.SETUP, INTERVIEW_STATES.COMPLETE, INTERVIEW_STATES.ERROR].includes(interviewState)) {
      failInterview(geminiLiveError);
    }
  }, [interviewMode, geminiLiveError, interviewState, failInterview, geminiLive]);

  useEffect(() => {
    if (interviewMode !== 'live') return;
    if ([INTERVIEW_STATES.IDLE, INTERVIEW_STATES.SETUP, INTERVIEW_STATES.COMPLETE, INTERVIEW_STATES.ERROR].includes(interviewState)) {
      return;
    }

    if (geminiLiveTurnState === GEMINI_LIVE_TURN_STATES.RECOVERED) {
      const transitionKey = `recovered:${geminiLiveMessageCount}`;
      if (geminiTransitionHandledRef.current !== transitionKey) {
        geminiTransitionHandledRef.current = transitionKey;
        beginInterviewListening({ preserveTimer: true, startTimer: true });
        acknowledgeGeminiRecovery();
      }
      return;
    }

    if (geminiLiveLastEvent !== 'turn-complete') return;
    const transitionKey = `turn-complete:${geminiLiveMessageCount}`;
    if (geminiTransitionHandledRef.current === transitionKey) return;
    geminiTransitionHandledRef.current = transitionKey;
    beginInterviewListening({ preserveTimer: true, startTimer: false });
  }, [acknowledgeGeminiRecovery, beginInterviewListening, geminiLiveLastEvent, geminiLiveMessageCount, geminiLiveTurnState, interviewState, interviewMode]);

  useEffect(() => {
    const sessionId = currentArchiveSessionIdRef.current;
    if (!sessionId) return;

    if (interview.state === INTERVIEW_STATES.COMPLETE && archivedSessionFinalizedRef.current !== sessionId) {
      archivedSessionFinalizedRef.current = sessionId;
      liveTurnContextRef.current = null;
      void interviewArchive.finalizeSession(sessionId, {
        ...interview.getResults(),
        conversationSnapshot: geminiLive.getConversationSnapshot?.() || null
      });
      return;
    }

    if (interview.state === INTERVIEW_STATES.ERROR && archivedSessionFailedRef.current !== sessionId) {
      archivedSessionFailedRef.current = sessionId;
      void interviewArchive.failSession(
        sessionId,
        interview.error || geminiLive.error || 'Interview failed',
        {
          ...interview.getResults(),
          conversationSnapshot: geminiLive.getConversationSnapshot?.() || null
        }
      );
    }
  }, [geminiLive.error, interview, interview.error, interview.state, interviewArchive]);

  const handleInterviewQuestionAsked = useCallback((question, questionIndex) => {
    const sessionId = currentArchiveSessionIdRef.current;
    if (!sessionId || !question) return;
    const turnIndex = currentArchiveTurnIndexRef.current;
    currentArchiveTurnIndexRef.current += 1;
    lastArchiveTurnIndexRef.current = turnIndex;
    if (interviewMode === 'live') {
      liveTurnContextRef.current = geminiLive.beginTurnContext({
        turnId: `${sessionId}:${turnIndex}`,
        turnIndex,
        questionIndex,
        question,
        questionText: question.text,
        assistantText: question.text,
        source: 'gemini-live',
        captureMode: 'realtime',
        turnLabel: question.isIntroPrompt ? 'intro-cue' : 'live-question',
        liveDiagnostics: geminiLive.diagnostics
      });
    }

    void interviewArchive.recordQuestion(sessionId, {
      questionIndex,
      turnIndex,
      text: question.text,
      category: question.category,
      keyPoints: question.keyPoints,
      askedAt: new Date().toISOString(),
      assistantText: question.text,
      source: interviewMode === 'live' ? 'gemini-live' : 'groq',
      captureMode: interviewMode === 'live' ? 'realtime' : 'recorded',
      turnLabel: question.isIntroPrompt ? 'intro-cue' : 'question',
      turnContext: liveTurnContextRef.current,
      liveDiagnostics: interviewMode === 'live' ? geminiLive.diagnostics : null
    });
  }, [geminiLive, interviewArchive, interviewMode]);

  const handleInterviewTurnTranscriptReady = useCallback(({ question, questionIndex, transcript, duration, skipped, assistantText }) => {
    const sessionId = currentArchiveSessionIdRef.current;
    if (!sessionId || interviewMode !== 'live') return;
    const turnIndex = lastArchiveTurnIndexRef.current;
    const liveSnapshot = geminiLive.getConversationSnapshot?.() || null;

    liveTurnContextRef.current = geminiLive.completeTurnContext({
      turnId: `${sessionId}:${turnIndex}`,
      turnIndex,
      questionIndex,
      question,
      questionText: question?.text,
      assistantText,
      transcriptText: transcript,
      duration,
      skipped,
      interrupted: false,
      source: 'gemini-live',
      captureMode: 'realtime',
      turnLabel: question?.isIntroPrompt ? 'intro-cue' : 'live-answer',
      liveDiagnostics: geminiLive.diagnostics
    });

    void (async () => {
      await interviewArchive.syncConversationSnapshot(sessionId, {
        ...liveSnapshot,
        liveDiagnostics: geminiLive.diagnostics,
        currentTurn: liveTurnContextRef.current
      });
    })();
  }, [geminiLive, interviewMode]);

  const handleInterviewAnswerComplete = useCallback(({ question, questionIndex, transcript, duration, evaluation, skipped, assistantText, audioBlob }) => {
    const sessionId = currentArchiveSessionIdRef.current;
    if (!sessionId) return;
    const liveSnapshot = geminiLive.getConversationSnapshot?.() || null;

    void interviewArchive.recordAnswer(sessionId, {
      questionIndex,
      turnIndex: lastArchiveTurnIndexRef.current,
      transcript: liveSnapshot?.currentTurnTranscript || transcript,
      duration,
      question,
      category: question?.category,
      evaluation,
      skipped,
      assistantText,
      audioBlob,
      source: interviewMode === 'live' ? 'gemini-live' : 'groq',
      captureMode: interviewMode === 'live' ? 'realtime' : 'recorded',
      turnLabel: question?.isIntroPrompt ? 'intro-cue' : 'answer',
      turnContext: liveTurnContextRef.current,
      liveDiagnostics: interviewMode === 'live' ? geminiLive.diagnostics : null,
      conversationSnapshot: interviewMode === 'live'
        ? {
            ...liveSnapshot,
            liveDiagnostics: geminiLive.diagnostics,
            currentTurn: liveTurnContextRef.current,
            transcriptText: liveSnapshot?.currentTurnTranscript || transcript,
            latestTranscript: liveSnapshot?.currentTurnTranscript || transcript,
            sessionTranscriptText: liveSnapshot?.sessionTranscriptText || liveSnapshot?.transcriptText || transcript
          }
        : null
    });

    if (interviewMode === 'live') {
      void (async () => {
        await interviewArchive.syncConversationSnapshot(sessionId, {
          ...liveSnapshot,
          liveDiagnostics: geminiLive.diagnostics,
          currentTurn: liveTurnContextRef.current,
          transcriptText: liveSnapshot?.currentTurnTranscript || transcript,
          latestTranscript: liveSnapshot?.currentTurnTranscript || transcript,
          sessionTranscriptText: liveSnapshot?.sessionTranscriptText || liveSnapshot?.transcriptText || transcript
        });
      })();
    }
  }, [geminiLive, interviewArchive, interviewMode]);

  const handleReuseArchive = useCallback(async (sessionId) => {
    try {
      const session = await interviewArchive.getSession(sessionId);
      if (!session) return;

      currentArchiveSessionIdRef.current = null;
      archivedSessionFinalizedRef.current = null;
      archivedSessionFailedRef.current = null;
      interview.resetInterview();
      geminiLive.reset();
      liveCaptureActiveRef.current = false;
      liveCaptureRef.current = null;
      setInterviewMode(session.mode || 'groq');
      interview.setConfig((prev) => ({
        ...prev,
        ...session.config,
        interviewMode: session.mode || prev.interviewMode
      }));
      interview.setState(INTERVIEW_STATES.SETUP);
    } catch (err) {
      console.warn('Failed to reuse archived interview:', err);
    }
  }, [geminiLive, interview, interviewArchive, setInterviewMode]);

  const handleExportArchive = useCallback(async (sessionId) => {
    try {
      await interviewArchive.downloadSession(sessionId);
    } catch (err) {
      console.warn('Failed to export archived interview:', err);
    }
  }, [interviewArchive]);

  const handleInterviewStartRecording = useCallback(async () => {
    if (useLiveInterview) {
      liveCaptureRef.current = null;
      const result = await geminiLive.startAnswerCapture();
      liveCaptureActiveRef.current = Boolean(result.ok);
      if (result.ok) {
        beginInterviewListening({ preserveTimer: false, startTimer: true });
        return result;
      }
      liveCaptureActiveRef.current = false;
      interview.failInterview(result.reason || 'Gemini 3.1 Flash Live answer capture failed');
      return null;
    }

    liveCaptureActiveRef.current = false;
    return startRecording();
  }, [beginInterviewListening, interview, geminiLive, startRecording, useLiveInterview]);

  const handleInterviewStopRecording = useCallback(async () => {
    if (useLiveInterview) {
      liveCaptureRef.current = await geminiLive.stopAnswerCapture();
      liveCaptureActiveRef.current = false;
      if (!liveCaptureRef.current) {
        interview.failInterview('Gemini 3.1 Flash Live answer capture stopped unexpectedly');
        return null;
      }
      if (currentArchiveSessionIdRef.current && liveCaptureRef.current.conversationSnapshot) {
        const sessionId = currentArchiveSessionIdRef.current;
        await interviewArchive.syncConversationSnapshot(sessionId, liveCaptureRef.current.conversationSnapshot);
      }
      return liveCaptureRef.current;
    }

    liveCaptureActiveRef.current = false;
    const result = await stopRecording();
    const blob = result?.blob || result || null;
    return blob;
  }, [geminiLive, interview, stopRecording, useLiveInterview]);

  const handleInterviewTranscribe = useCallback(async (audioBlob) => {
    if (useLiveInterview && audioBlob) {
      try {
        const liveTranscription = await transcribeAudio(audioBlob);
        const liveText = typeof liveTranscription?.text === 'string' ? liveTranscription.text.trim() : '';
        if (liveText) {
          return liveTranscription;
        }
      } catch (err) {
        console.warn('Live turn transcription failed, using Gemini snapshot fallback:', err);
      }
    }

    if (useLiveInterview) {
      const liveTranscript = liveCaptureRef.current?.conversationSnapshot?.currentTurnTranscript
        || liveCaptureRef.current?.transcript
        || geminiLive.consumeLatestTranscript();
      if (liveTranscript) {
        return {
          text: liveTranscript,
          words: [],
          segments: [],
          duration: 0
        };
      }
    }

    return transcribeAudio(audioBlob);
  }, [geminiLive, transcribeAudio, useLiveInterview]);

  const handleStartInterview = useCallback(async () => {
    if (posthog) posthog.capture('interview_started', { config: interview.config });

    try {
      geminiTransitionHandledRef.current = '';
      archivedSessionFinalizedRef.current = null;
      archivedSessionFailedRef.current = null;
      currentArchiveTurnIndexRef.current = 0;
      lastArchiveTurnIndexRef.current = 0;
      liveTurnContextRef.current = null;

      const archiveSessionId = interviewArchive.beginSession({
        mode: interviewMode,
        config: interview.config,
        questions: [],
        source: 'interview'
      });
      currentArchiveSessionIdRef.current = archiveSessionId;

      console.info('[Interview] start requested', {
        mode: interviewMode,
        apiKeyPresent: Boolean(import.meta.env.VITE_GEMINI_API_KEY)
      });
      if (interviewMode === 'live') {
        if (!geminiLive.isReady || geminiLive.error) {
          interview.failInterview(geminiLive.error || 'Gemini 3.1 Flash Live is unavailable.');
          return;
        }

        const liveConnection = await geminiLive.connect(interview.config);
        console.info('[Interview] Gemini 3.1 Flash Live connect result', liveConnection);
        if (!liveConnection.ok) {
          interview.failInterview(liveConnection.reason || 'Gemini 3.1 Flash Live is unavailable.');
          return;
        }

        const openingCue = {
          category: 'Live interview',
          text: `Press Start Speaking, then say hello or introduce yourself to begin the interview.`,
          keyPoints: ['Press Start Speaking to begin', 'Say hello or introduce yourself', 'The interview starts after your opening words'],
          isIntroPrompt: true
        };

        void interviewArchive.recordQuestionBank(archiveSessionId, [openingCue]);
        interview.startInterview([openingCue]);
        handleInterviewQuestionAsked(openingCue, 0);
        beginInterviewListening({ preserveTimer: false, startTimer: false });
        return;
      }

      const questions = await generateInterviewQuestions(interview.config);
      void interviewArchive.recordQuestionBank(archiveSessionId, questions);
      interview.startInterview(questions);
    } catch (err) {
      console.error('Failed to start interview:', err);
      interview.failInterview(err?.message || 'Failed to start interview');
    }
  }, [beginInterviewListening, generateInterviewQuestions, handleInterviewQuestionAsked, interview, interviewArchive, interviewMode, posthog, geminiLive]);

  const handleInterviewRestart = useCallback(() => {
    geminiTransitionHandledRef.current = '';
    currentArchiveSessionIdRef.current = null;
    archivedSessionFinalizedRef.current = null;
    archivedSessionFailedRef.current = null;
    currentArchiveTurnIndexRef.current = 0;
    lastArchiveTurnIndexRef.current = 0;
    liveTurnContextRef.current = null;
    interview.resetInterview();
    geminiLive.reset();
    liveCaptureActiveRef.current = false;
    liveCaptureRef.current = null;
    interview.setState(INTERVIEW_STATES.SETUP);
  }, [geminiLive, interview]);

  const handleInterviewGoHome = useCallback(() => {
    geminiTransitionHandledRef.current = '';
    currentArchiveSessionIdRef.current = null;
    archivedSessionFinalizedRef.current = null;
    archivedSessionFailedRef.current = null;
    currentArchiveTurnIndexRef.current = 0;
    lastArchiveTurnIndexRef.current = 0;
    liveTurnContextRef.current = null;
    interview.resetInterview();
    geminiLive.reset();
    liveCaptureActiveRef.current = false;
    liveCaptureRef.current = null;
    void navigate({ to: '/script' });
  }, [geminiLive, interview, navigate]);

  const liveStatus = interviewMode === 'live' ? {
    mode: interviewMode,
    isConnecting: geminiLive.isConnecting,
    isConnected: geminiLive.isConnected,
    lastAssistantText: geminiLive.lastAssistantText,
    lastInterrupted: geminiLive.lastInterrupted,
    productLabel: geminiLive.productLabel,
    turnState: geminiLiveTurnState,
    turnStatus: geminiLive.turnStatus,
    diagnostics: geminiLive.diagnostics,
    error: geminiLive.error
  } : null;

  return (
    <div className="flex flex-1 flex-col">
      {(interview.state === INTERVIEW_STATES.IDLE || interview.state === INTERVIEW_STATES.SETUP) && (
        <InterviewSetup
          config={interview.config}
          setConfig={interview.setConfig}
          onStartInterview={handleStartInterview}
          onModeChange={setInterviewMode}
          isLoading={isTranscribing}
          ttsStatus={interviewMode === 'live' ? null : {
            isLoading: kokoroTTS.isLoading,
            isReady: kokoroTTS.isReady,
            usesFallback: kokoroTTS.usesFallback
          }}
          liveStatus={interviewMode === 'live' ? {
            isReady: geminiLive.isReady,
            isConnecting: geminiLive.isConnecting,
            isConnected: geminiLive.isConnected,
            error: geminiLive.error,
            errorCategory: geminiLive.diagnostics?.errorCategory,
            modelStatus: geminiLive.modelStatus,
            productLabel: geminiLive.productLabel,
            runtimeModel: geminiLive.liveModel,
            diagnostics: geminiLive.diagnostics,
            turnState: geminiLiveTurnState,
            turnStatus: geminiLive.turnStatus
          } : null}
          archiveSessions={interviewArchive.sessions}
          archiveLoading={interviewArchive.isLoading}
          archiveError={interviewArchive.error}
          onReuseArchive={handleReuseArchive}
          onExportArchive={handleExportArchive}
        />
      )}

      {interview.state !== INTERVIEW_STATES.IDLE &&
        interview.state !== INTERVIEW_STATES.SETUP &&
        interview.state !== INTERVIEW_STATES.COMPLETE &&
        interview.state !== INTERVIEW_STATES.ERROR && (
          <InterviewSession
            interview={interview}
            isRecording={useLiveInterview ? geminiLive.isCapturing : false}
            onStartRecording={handleInterviewStartRecording}
            onStopRecording={handleInterviewStopRecording}
            onTranscribe={handleInterviewTranscribe}
            onEvaluate={evaluateAnswer}
            isProcessing={isTranscribing}
            isGeneratingAudio={useLiveInterview ? geminiLive.isSpeaking : kokoroTTS.isGenerating}
            liveStatus={liveStatus}
            onQuestionAsked={handleInterviewQuestionAsked}
            onTurnTranscriptReady={handleInterviewTurnTranscriptReady}
            onAnswerComplete={handleInterviewAnswerComplete}
          />
      )}

      {interview.state === INTERVIEW_STATES.COMPLETE && (
        <div className="flex flex-1 items-center justify-center">
          <OatCard className="refined-card max-w-2xl text-center">
            <div className="mb-3 text-5xl">✅</div>
            <h3 className="mb-2 text-2xl font-semibold text-text">Interview complete</h3>
            <p className="mb-6 text-sm text-on-surface-variant">
              Your session is finished. You can start a new interview or go back home.
            </p>
            <div className="flex justify-center gap-3">
              <OatButton onClick={handleInterviewRestart}>
                Start Another
              </OatButton>
              <OatButton onClick={handleInterviewGoHome} variant="secondary" outline>
                Back to Home
              </OatButton>
            </div>
          </OatCard>
        </div>
      )}

      {interview.state === INTERVIEW_STATES.ERROR && (
        <div className="flex flex-1 items-center justify-center">
          <OatCard className="refined-card max-w-2xl text-center">
            <div className="mb-3 text-5xl">⚠️</div>
            <h3 className="mb-2 text-2xl font-semibold text-text">Interview stopped</h3>
            <p className="mb-6 text-sm text-on-surface-variant">
              {interview.error || geminiLive.error || 'Gemini 3.1 Flash Live disconnected. Please retry the live interview.'}
            </p>
            <div className="flex justify-center gap-3">
              <OatButton onClick={handleInterviewRestart} variant="secondary" outline>
                Retry Setup
              </OatButton>
              <OatButton onClick={handleInterviewGoHome} variant="secondary" outline>
                Back to Home
              </OatButton>
            </div>
          </OatCard>
        </div>
      )}
    </div>
  );
}

export default InterviewRoute;
