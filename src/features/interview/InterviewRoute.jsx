import { useEffect, useRef, useCallback, useState, startTransition } from 'react';
import { useNavigate } from '@tanstack/react-router';
import InterviewSetup from '../../components/InterviewSetup';
import InterviewSession from '../../components/InterviewSession';
import { useGroq } from '../../hooks/useGroq';
import { useInterview, INTERVIEW_STATES } from '../../hooks/useInterview';
import { useInterviewArchive } from '../../hooks/useInterviewArchive';
import { useGeminiLive } from '../../hooks/useGeminiLive';
import { GEMINI_LIVE_TURN_STATES } from '../../utils/geminiLive';
import { workerApi } from '../../api/workerClient';
import { MagicBackground, MagicButton, MagicCard } from '../../components/ui/MagicUI';

export function InterviewRoute() {
  const navigate = useNavigate();
  const interviewMode = 'live';

  const liveCaptureRef = useRef(null);
  const liveCaptureActiveRef = useRef(false);
  const liveTurnContextRef = useRef(null);
  const currentArchiveSessionIdRef = useRef(null);
  const currentArchiveTurnIndexRef = useRef(0);
  const lastArchiveTurnIndexRef = useRef(0);
  const geminiTransitionHandledRef = useRef('');
  const archivedSessionFinalizedRef = useRef(null);
  const archivedSessionFailedRef = useRef(null);
  const analysisRequestSentRef = useRef(false);
  const [analysisState, setAnalysisState] = useState('idle');

  const { transcribeAudio, isLoading: isTranscribing } = useGroq();
  const geminiLive = useGeminiLive();

  const interview = useInterview({
    speak: geminiLive.sendPrompt,
    stop: geminiLive.reset,
    isSpeaking: geminiLive.isSpeaking
  });

  const { state: interviewState, failInterview, beginListening: beginInterviewListening } = interview;
  const geminiLiveTurnState = geminiLive.turnState;
  const geminiLiveDiagnostics = geminiLive.diagnostics;
  const geminiLiveLastEvent = geminiLiveDiagnostics?.lastEvent || '';
  const geminiLiveMessageCount = geminiLiveDiagnostics?.messagesReceived || 0;
  const acknowledgeGeminiRecovery = geminiLive.acknowledgeRecovery;
  const geminiLiveError = geminiLive.error;
  const archiveQueryEnabled = [INTERVIEW_STATES.IDLE, INTERVIEW_STATES.SETUP, INTERVIEW_STATES.COMPLETE, INTERVIEW_STATES.ERROR].includes(interviewState);
  const interviewArchive = useInterviewArchive({ enabled: archiveQueryEnabled });

  const waitForAnalysisCompletion = useCallback(async (sessionId) => {
    if (!sessionId) return false;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        const liveSession = await workerApi.getInterviewLiveSession(sessionId);
        const analysisStatus = liveSession?.session?.analysisStatus || liveSession?.analysisStatus || '';
        if (analysisStatus === 'completed' || liveSession?.session?.status === 'completed') {
          await interviewArchive.refreshSessions();
          return true;
        }
      } catch (err) {
        console.warn('Waiting for background analysis failed:', err);
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    return false;
  }, [interviewArchive]);

  useEffect(() => {
    if (geminiLiveError && ![INTERVIEW_STATES.IDLE, INTERVIEW_STATES.SETUP, INTERVIEW_STATES.COMPLETE, INTERVIEW_STATES.ERROR].includes(interviewState)) {
      failInterview(geminiLiveError);
    }
  }, [geminiLiveError, interviewState, failInterview]);

  useEffect(() => {
    const sessionId = currentArchiveSessionIdRef.current;
    if (!sessionId || interviewState !== INTERVIEW_STATES.COMPLETE || analysisState !== 'running' || analysisRequestSentRef.current) {
      return;
    }

    void (async () => {
      analysisRequestSentRef.current = true;
      try {
        await workerApi.completeInterviewLiveSession(sessionId, {});
      } catch (err) {
        console.warn('Failed to start backend analysis:', err);
        setAnalysisState('failed');
      }
    })();
  }, [analysisState, geminiLive, interview.config, interviewState]);

  useEffect(() => {
    if (analysisState !== 'running') {
      return;
    }

    if (geminiLiveLastEvent === 'analysis-complete') {
      void interviewArchive.refreshSessions();
      startTransition(() => {
        setAnalysisState('completed');
      });
    }
  }, [analysisState, geminiLiveLastEvent, interviewArchive]);

  useEffect(() => {
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
  }, [acknowledgeGeminiRecovery, beginInterviewListening, geminiLiveLastEvent, geminiLiveMessageCount, geminiLiveTurnState, interviewState]);

  useEffect(() => {
    const sessionId = currentArchiveSessionIdRef.current;
    if (!sessionId) return;

    if (interview.state === INTERVIEW_STATES.COMPLETE) {
      liveTurnContextRef.current = null;
      if (analysisState === 'idle') {
        startTransition(() => {
          setAnalysisState('running');
        });
      }
      return;
    }

    if (interview.state === INTERVIEW_STATES.ERROR && archivedSessionFailedRef.current !== sessionId) {
      archivedSessionFailedRef.current = sessionId;
      startTransition(() => {
        setAnalysisState('failed');
      });
    }
  }, [analysisState, geminiLive, interview, interview.error, interview.state]);

  const handleInterviewQuestionAsked = useCallback((question, questionIndex) => {
    const sessionId = currentArchiveSessionIdRef.current;
    if (!sessionId || !question) return;
    const turnIndex = currentArchiveTurnIndexRef.current;
    currentArchiveTurnIndexRef.current += 1;
    lastArchiveTurnIndexRef.current = turnIndex;
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
  }, [geminiLive]);

  const handleInterviewTurnTranscriptReady = useCallback(({ question, questionIndex, transcript, duration, skipped, assistantText }) => {
    const sessionId = currentArchiveSessionIdRef.current;
    if (!sessionId) return;
    const turnIndex = lastArchiveTurnIndexRef.current;

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

  }, [geminiLive]);

  const handleInterviewAnswerComplete = useCallback(() => {
    if (!currentArchiveSessionIdRef.current) return;
  }, []);

  const handleInterviewEnd = useCallback(async () => {
    const sessionId = currentArchiveSessionIdRef.current;

    if (!sessionId) {
      interview.resetInterview();
      geminiLive.reset();
      setAnalysisState('idle');
      return;
    }

    analysisRequestSentRef.current = true;

    if (liveCaptureActiveRef.current || geminiLive.isCapturing) {
      try {
        await geminiLive.stopAnswerCapture();
      } catch (err) {
        console.warn('Failed to stop live capture while ending interview:', err);
      }
      liveCaptureActiveRef.current = false;
      liveCaptureRef.current = null;
    }

    void (async () => {
      try {
        await workerApi.completeInterviewLiveSession(sessionId, {});
        void waitForAnalysisCompletion(sessionId);
      } catch (err) {
        console.warn('Failed to start backend analysis:', err);
        analysisRequestSentRef.current = false;
      }
    })();

    liveTurnContextRef.current = null;
    currentArchiveTurnIndexRef.current = 0;
    lastArchiveTurnIndexRef.current = 0;
    interview.resetInterview();
    geminiLive.reset();
    currentArchiveSessionIdRef.current = sessionId;
    setAnalysisState('idle');
  }, [geminiLive, interview, setAnalysisState, waitForAnalysisCompletion]);

  const handleReuseArchive = useCallback(async (sessionId) => {
    try {
      const session = await interviewArchive.getSession(sessionId);
      if (!session) return;

      currentArchiveSessionIdRef.current = null;
      archivedSessionFinalizedRef.current = null;
      archivedSessionFailedRef.current = null;
      analysisRequestSentRef.current = false;
      interview.resetInterview();
      geminiLive.reset();
      liveCaptureActiveRef.current = false;
      liveCaptureRef.current = null;
      interview.setConfig((prev) => ({
        ...prev,
        ...session.config,
        interviewMode: 'live'
      }));
      interview.setState(INTERVIEW_STATES.SETUP);
    } catch (err) {
      console.warn('Failed to reuse archived interview:', err);
    }
  }, [geminiLive, interview, interviewArchive]);

  const handleExportArchive = useCallback(async (sessionId) => {
    try {
      await interviewArchive.downloadSession(sessionId);
    } catch (err) {
      console.warn('Failed to export archived interview:', err);
    }
  }, [interviewArchive]);

  const handleInterviewStartRecording = useCallback(async () => {
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
  }, [beginInterviewListening, interview, geminiLive]);

  const handleInterviewStopRecording = useCallback(async () => {
    liveCaptureRef.current = await geminiLive.stopAnswerCapture();
    liveCaptureActiveRef.current = false;
    if (!liveCaptureRef.current) {
      interview.failInterview('Gemini 3.1 Flash Live answer capture stopped unexpectedly');
      return null;
    }
    return liveCaptureRef.current;
  }, [geminiLive, interview]);

  const handleInterviewTranscribe = useCallback(async (audioBlob) => {
    if (audioBlob) {
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

    return transcribeAudio(audioBlob);
  }, [geminiLive, transcribeAudio]);

  const handleStartInterview = useCallback(async () => {
    try {
      geminiTransitionHandledRef.current = '';
      archivedSessionFinalizedRef.current = null;
      archivedSessionFailedRef.current = null;
      analysisRequestSentRef.current = false;
      currentArchiveTurnIndexRef.current = 0;
      lastArchiveTurnIndexRef.current = 0;
      liveTurnContextRef.current = null;

      const archiveSessionId = globalThis.crypto?.randomUUID?.()
        || `interview-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      currentArchiveSessionIdRef.current = archiveSessionId;
      setAnalysisState('idle');

      console.info('[Interview] start requested', {
        mode: interviewMode,
        workerApiReady: workerApi.hasWorkerApi()
      });
      if (!geminiLive.isReady || geminiLive.error) {
        interview.failInterview(geminiLive.error || 'Gemini 3.1 Flash Live is unavailable.');
        return;
      }

      const liveConnection = await geminiLive.connect({
        ...interview.config,
        archiveSessionId
      });
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

      interview.startInterview([openingCue]);
      handleInterviewQuestionAsked(openingCue, 0);
      beginInterviewListening({ preserveTimer: false, startTimer: false });
    } catch (err) {
      console.error('Failed to start interview:', err);
      interview.failInterview(err?.message || 'Failed to start interview');
    }
  }, [beginInterviewListening, handleInterviewQuestionAsked, interview, interviewMode, geminiLive]);

  const handleInterviewRestart = useCallback(() => {
    geminiTransitionHandledRef.current = '';
    currentArchiveSessionIdRef.current = null;
    archivedSessionFinalizedRef.current = null;
    archivedSessionFailedRef.current = null;
    analysisRequestSentRef.current = false;
    currentArchiveTurnIndexRef.current = 0;
    lastArchiveTurnIndexRef.current = 0;
    liveTurnContextRef.current = null;
    setAnalysisState('idle');
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
    analysisRequestSentRef.current = false;
    currentArchiveTurnIndexRef.current = 0;
    lastArchiveTurnIndexRef.current = 0;
    liveTurnContextRef.current = null;
    setAnalysisState('idle');
    interview.resetInterview();
    geminiLive.reset();
    liveCaptureActiveRef.current = false;
    liveCaptureRef.current = null;
    void navigate({ to: '/script' });
  }, [geminiLive, interview, navigate]);

  const liveStatus = {
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
  };

  return (
    <MagicBackground className="flex min-h-screen flex-col">
    <div className="flex flex-1 flex-col px-4 py-4 md:px-6 md:py-6">
      {(interview.state === INTERVIEW_STATES.IDLE || interview.state === INTERVIEW_STATES.SETUP) && (
        <InterviewSetup
          config={interview.config}
          setConfig={interview.setConfig}
          onStartInterview={handleStartInterview}
          isLoading={isTranscribing}
          liveStatus={{
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
          }}
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
            isRecording={geminiLive.isCapturing}
            onStartRecording={handleInterviewStartRecording}
            onStopRecording={handleInterviewStopRecording}
            onTranscribe={handleInterviewTranscribe}
            isProcessing={isTranscribing}
            isGeneratingAudio={geminiLive.isSpeaking}
            liveStatus={liveStatus}
            onTurnTranscriptReady={handleInterviewTurnTranscriptReady}
            onAnswerComplete={handleInterviewAnswerComplete}
            onEndInterview={handleInterviewEnd}
          />
      )}

      {interview.state === INTERVIEW_STATES.ERROR && (
        <div className="flex flex-1 items-center justify-center">
          <MagicCard className="max-w-2xl p-8 text-center">
            <div className="mb-3 text-5xl">⚠️</div>
            <h3 className="mb-2 text-2xl font-semibold text-slate-950">Interview stopped</h3>
            <p className="mb-6 text-sm text-slate-600">
              {interview.error || geminiLive.error || 'Gemini 3.1 Flash Live disconnected. Please retry the live interview.'}
            </p>
            <div className="flex justify-center gap-3">
              <MagicButton onClick={handleInterviewRestart} variant="secondary">
                Retry Setup
              </MagicButton>
              <MagicButton onClick={handleInterviewGoHome} variant="secondary">
                Back to Home
              </MagicButton>
            </div>
          </MagicCard>
        </div>
      )}
    </div>
    </MagicBackground>
  );
}

export default InterviewRoute;
