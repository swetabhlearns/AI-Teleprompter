import { useState, useRef, useCallback, useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';
import CameraView from './components/CameraView';
import Teleprompter from './components/Teleprompter';
import ScriptEditor from './components/ScriptEditor';
import FeedbackOverlay from './components/FeedbackOverlay';
import AnalysisView from './components/AnalysisView';
import InterviewSetup from './components/InterviewSetup';
import InterviewSession from './components/InterviewSession';
import InterviewResults from './components/InterviewResults';
import ExtemporePractice from './components/ExtemporePractice';
import WarmUpGuide from './components/WarmUpGuide';
import { useSession } from './contexts/SessionContext';
import { useMediaPipe } from './hooks/useMediaPipe';
import { useRecorder } from './hooks/useRecorder';
import { useGroq } from './hooks/useGroq';
import { useInterview, INTERVIEW_STATES } from './hooks/useInterview';
import { useKokoroTTS } from './hooks/useKokoroTTS';
import { generatePerformanceReport } from './utils/analysisEngine';
import { generateStutteringReport } from './utils/stutteringAnalyzer';
import { formatDuration } from './utils/formatters';

function App() {
  const posthog = usePostHog();

  // Session context for recording, stream, and tracking state
  const session = useSession();

  // Tab navigation
  const [activeTab, setActiveTab] = useState('script');

  // Track tab changes
  useEffect(() => {
    if (posthog) {
      posthog.capture('tab_changed', { tab: activeTab });
    }
  }, [activeTab, posthog]);

  // Script state
  const [script, setScript] = useState('');

  // Practice state
  const [isPracticing, setIsPracticing] = useState(false);

  // Real-time tracking state (local to avoid context re-renders)
  const [currentEyeContact, setCurrentEyeContact] = useState(null);
  const [currentPosture, setCurrentPosture] = useState(null);
  const lastTrackingUpdateRef = useRef(0);

  // Tracking metrics for analysis (accumulated over session)
  const metricsRef = useRef({
    eyeContactFrames: 0,
    totalFrames: 0,
    postureScores: []
  });

  // Analysis state
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Hooks
  const {
    isReady: mediaPipeReady,
    isLoading: mediaPipeLoading,
    error: mediaPipeError,
    processFrame
  } = useMediaPipe();

  const {
    isRecording,
    duration,
    isSpeaking,
    audioLevel,
    audioBlob, // Audio-only for transcription
    startRecording,
    stopRecording
  } = useRecorder();

  const { transcribeAudio, generateInterviewQuestions, evaluateAnswer, generateExtemporeTopics, isLoading: isTranscribing } = useGroq();

  // Kokoro TTS for human-like interviewer voice
  const kokoroTTS = useKokoroTTS();

  // Interview hook with Kokoro TTS
  const interview = useInterview({
    speak: kokoroTTS.speak,
    stop: kokoroTTS.stop,
    isSpeaking: kokoroTTS.isSpeaking
  });

  // Video element ref for MediaPipe processing
  const videoRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Handle stream ready from camera
  const handleStreamReady = useCallback((newStream) => {
    session.setStream(newStream);
  }, [session.setStream]);

  // Set video ref when practice or interview tab is active
  useEffect(() => {
    if (activeTab === 'practice' || activeTab === 'extempore' || (activeTab === 'interview' && interview.state !== INTERVIEW_STATES.IDLE && interview.state !== INTERVIEW_STATES.SETUP)) {
      const timer = setTimeout(() => {
        const videoEl = document.querySelector('.camera-video');
        if (videoEl) {
          videoRef.current = videoEl;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab, interview.state]);

  // MediaPipe processing loop
  useEffect(() => {
    if (!isPracticing || !mediaPipeReady || !videoRef.current) {
      return;
    }

    let isRunning = true;

    const processLoop = () => {
      if (!isRunning) return;

      if (videoRef.current && videoRef.current.readyState >= 2) {
        const result = processFrame(videoRef.current);

        if (result) {
          // Update local metrics ref for later analysis (no re-render)
          metricsRef.current.totalFrames++;
          if (result.eyeContact?.isLookingAtCamera) {
            metricsRef.current.eyeContactFrames++;
          }
          if (result.posture?.score !== undefined) {
            metricsRef.current.postureScores.push(result.posture.score);
          }

          // Throttled UI updates (local state)
          const now = Date.now();
          if (now - lastTrackingUpdateRef.current > 100) {
            lastTrackingUpdateRef.current = now;
            setCurrentEyeContact(result.eyeContact);
            setCurrentPosture(result.posture);
          }
        }
      }

      if (isRunning) {
        animationFrameRef.current = requestAnimationFrame(processLoop);
      }
    };

    processLoop();

    return () => {
      isRunning = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPracticing, mediaPipeReady, processFrame]);

  // Start practice session
  const handleStartPractice = async () => {
    setActiveTab('practice');

    if (posthog) posthog.capture('practice_started');

    setAnalysis(null);
    session.resetSession();
    setCurrentEyeContact(null);
    setCurrentPosture(null);
    lastTrackingUpdateRef.current = 0;
    metricsRef.current = {
      eyeContactFrames: 0,
      totalFrames: 0,
      postureScores: []
    };

    setTimeout(() => {
      setIsPracticing(true);
      if (session.stream) {
        startRecording(session.stream);
      }
    }, 500);
  };

  // Cancel practice without saving
  const handleCancelPractice = async () => {
    setIsPracticing(false);
    await stopRecording();
    session.resetSession();
    setCurrentEyeContact(null);
    setCurrentPosture(null);
    metricsRef.current = {
      eyeContactFrames: 0,
      totalFrames: 0,
      postureScores: []
    };
    setActiveTab('script');
  };

  // Stop practice - save recording for later analysis
  const handleStopPractice = async () => {
    setIsPracticing(false);

    try {
      // Use the returned object from stopRecording (now contains duration)
      const result = await stopRecording();

      // Handle both new object structure and potential legacy/fallback blob
      const recordedBlob = result.blob || result;
      const finalDuration = result.duration || duration;

      // Calculate metrics from local metricsRef
      const eyeContactPercentage = metricsRef.current.totalFrames > 0
        ? Math.round((metricsRef.current.eyeContactFrames / metricsRef.current.totalFrames) * 100)
        : 0;

      const avgPosture = metricsRef.current.postureScores.length > 0
        ? Math.round(metricsRef.current.postureScores.reduce((a, b) => a + b, 0) / metricsRef.current.postureScores.length)
        : 0;

      const metrics = { eyeContactPercentage, avgPosture };

      // Save recording and metrics to session context
      // result now contains volumeHistory from useRecorder
      session.saveRecording(recordedBlob, finalDuration, metrics, result.volumeHistory);

      if (posthog) {
        posthog.capture('practice_stopped', {
          duration: finalDuration,
          eyeContact: eyeContactPercentage,
          posture: avgPosture,
          volume_samples: result.volumeHistory?.length || 0
        });
      }

      return { blob: recordedBlob, duration: finalDuration };

    } catch (err) {
      console.error('Stop recording failed:', err);
      return null;
    }
  };

  // Start Extempore session (similar to practice but keeps tab)
  const handleStartExtempore = () => {
    if (posthog) posthog.capture('extempore_started');

    setAnalysis(null);
    session.resetSession();
    setCurrentEyeContact(null);
    setCurrentPosture(null);
    lastTrackingUpdateRef.current = 0;
    metricsRef.current = {
      eyeContactFrames: 0,
      totalFrames: 0,
      postureScores: []
    };

    setIsPracticing(true);
    if (session.stream) {
      startRecording(session.stream);
    }
  };

  // Start analysis (user-triggered)
  const handleStartAnalysis = async (directBlob = null, directDuration = 0) => {
    // FIX: When called as onClick handler, first arg is the click event, not a blob!
    // Check if directBlob is actually a Blob before using it
    const isValidBlob = directBlob instanceof Blob;
    const actualDirectBlob = isValidBlob ? directBlob : null;

    console.log('=== handleStartAnalysis CALLED ===');
    console.log('directBlob raw:', directBlob);
    console.log('Is valid Blob?:', isValidBlob);
    console.log('actualDirectBlob:', actualDirectBlob);
    console.log('directDuration:', directDuration);
    console.log('recordingResult:', session.recordingResult?.size, 'bytes');
    console.log('audioBlob from hook:', audioBlob?.size, 'bytes');

    // Prioritize: direct blob (if valid) → stored recordingResult → hook audioBlob
    const sourceBlob = actualDirectBlob || session.recordingResult || audioBlob;
    console.log('Final sourceBlob size:', sourceBlob?.size, 'bytes');

    if (!sourceBlob) {
      console.error('No recording to analyze - all sources are null/undefined');
      return;
    }

    setIsAnalyzing(true);
    setActiveTab('analysis');

    try {
      let transcriptData = { text: '', words: [], segments: [] };

      // Use sourceBlob (or fallback) for transcription
      const blobToTranscribe = sourceBlob;

      if (blobToTranscribe && blobToTranscribe.size > 0) {
        console.log('Starting transcription...');
        console.log('Blob size:', blobToTranscribe.size, 'bytes');
        console.log('Blob type:', blobToTranscribe.type);

        try {
          setIsAnalyzing(true); // Ensure loading state is set
          transcriptData = await transcribeAudio(blobToTranscribe);
          console.log('Transcription successful:', transcriptData.text);
        } catch (err) {
          console.error('Transcription failed:', err);
          // Don't swallow error, let the UI know
          setAnalysis(null);
          setIsAnalyzing(false);
          // Could show a toast here if we had one
          return;
        }
      } else {
        console.error('CRITICAL: Recording blob is empty or missing. Skipping transcription.');
        console.log('Blob object:', blobToTranscribe);
        // Prevent generating an empty report if we have no data
        return;
      }

      // Generate stuttering analysis from word-level data
      const stutteringReport = transcriptData.words?.length > 0
        ? generateStutteringReport(transcriptData.words)
        : null;

      // Use direct duration if provided, otherwise fallback to state or 0
      // This fixes the race condition where state hasn't updated yet
      const finalDuration = directDuration || session.sessionDuration || 0;

      // Generate comprehensive performance report
      const report = generatePerformanceReport({
        transcript: transcriptData.text || '',
        words: transcriptData.words || [],
        stutteringReport,
        durationMs: finalDuration,
        eyeContactPercentage: session.savedMetrics?.eyeContactPercentage || 0,
        stutteringReport,
        durationMs: finalDuration,
        eyeContactPercentage: session.savedMetrics?.eyeContactPercentage || 0,
        postureScore: session.savedMetrics?.avgPosture || 0,
        volumeHistory: session.volumeHistory || [] // Pass volume history for analysis
      });

      console.log('Performance Report:', report);
      setAnalysis(report);

      if (posthog) {
        posthog.capture('analysis_completed', {
          wpm: report.summary.wpm,
          overall_score: report.summary.overallScore,
          filler_count: report.speech.fillerWords.count,
          fluency_score: report.fluency ? report.fluency.score : null,
          duration: report.summary.duration,
          word_count: report.summary.wordCount
        });
      }

    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSkipAnalysis = () => {
    session.resetSession();
    setActiveTab('script');
  };

  // Interview handlers
  const handleStartInterview = async () => {
    if (posthog) posthog.capture('interview_started', { config: interview.config });

    try {
      const questions = await generateInterviewQuestions(interview.config);
      interview.startInterview(questions);
    } catch (err) {
      console.error('Failed to start interview:', err);
    }
  };

  const handleInterviewRestart = () => {
    interview.resetInterview();
    interview.setState(INTERVIEW_STATES.SETUP);
  };

  const handleInterviewGoHome = () => {
    interview.resetInterview();
    setActiveTab('script');
  };

  const tabs = [
    { id: 'warmup', label: '🎤 Warm-Up' },
    { id: 'script', label: '📝 Script' },
    { id: 'extempore', label: '💬 Extempore' },
    { id: 'interview', label: '🗣️ Interview' },
    { id: 'practice', label: '🎬 Practice' },
    { id: 'analysis', label: '📊 Analysis' }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Header */}
      <header className="glass-strong border-b border-white/5" style={{ padding: '16px 24px' }}>
        <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
          <div className="flex items-center" style={{ gap: '12px' }}>
            <div style={{ fontSize: '32px' }}>🎙️</div>
            <div>
              <h1 className="font-display" style={{ fontSize: '28px', fontWeight: '800', color: 'white', letterSpacing: '-0.04em', lineHeight: '1' }}>
                AI TRACKER
              </h1>
              <p style={{ fontSize: '10px', color: 'var(--accent-cyan)', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: '700', marginTop: '4px' }}>
                Clearer Speech Engine
              </p>
            </div>
          </div>

          <nav className="tab-nav reveal">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                disabled={isPracticing && tab.id !== activeTab}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center" style={{ gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
            {mediaPipeLoading ? (
              <>
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                <span>Loading AI...</span>
              </>
            ) : mediaPipeReady ? (
              <>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                <span>Tracking Ready</span>
              </>
            ) : (
              <>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                <span>Tracking Limited</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full reveal reveal-delay-1 flex flex-col" style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px', width: '100%' }}>
        {/* Warm-Up Tab */}
        {activeTab === 'warmup' && (
          <div className="reveal reveal-delay-2 flex-1">
            <WarmUpGuide
              onComplete={() => setActiveTab('script')}
              onSkip={() => setActiveTab('script')}
            />
          </div>
        )}

        {/* Script Tab */}
        {activeTab === 'script' && (
          <div className="flex-1 flex flex-col">
            <ScriptEditor
              script={script}
              onScriptChange={setScript}
              onStartPractice={handleStartPractice}
            />
          </div>
        )}

        {/* Interview Tab */}
        {activeTab === 'interview' && (
          <div className="flex-1 flex flex-col">
            {/* Setup Phase */}
            {(interview.state === INTERVIEW_STATES.IDLE || interview.state === INTERVIEW_STATES.SETUP) && (
              <InterviewSetup
                config={interview.config}
                setConfig={interview.setConfig}
                onStartInterview={handleStartInterview}
                isLoading={isTranscribing}
                ttsStatus={{
                  isLoading: kokoroTTS.isLoading,
                  isReady: kokoroTTS.isReady,
                  usesFallback: kokoroTTS.usesFallback
                }}
              />
            )}

            {/* Active Interview */}
            {(interview.state !== INTERVIEW_STATES.IDLE &&
              interview.state !== INTERVIEW_STATES.SETUP &&
              interview.state !== INTERVIEW_STATES.COMPLETE) && (
                <InterviewSession
                  interview={interview}
                  stream={stream}
                  onStreamReady={handleStreamReady}
                  mediaPipeReady={mediaPipeReady}
                  mediaPipeLoading={mediaPipeLoading}
                  currentEyeContact={currentEyeContact}
                  currentPosture={currentPosture}
                  isRecording={isRecording}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  onTranscribe={transcribeAudio}
                  onEvaluate={evaluateAnswer}
                  isProcessing={isTranscribing}
                  isGeneratingAudio={kokoroTTS.isGenerating}
                  onPregenerate={kokoroTTS.pregenerate}
                />
              )}

            {/* Results */}
            {interview.state === INTERVIEW_STATES.COMPLETE && (
              <InterviewResults
                results={interview.getResults()}
                onRestart={handleInterviewRestart}
                onGoHome={handleInterviewGoHome}
              />
            )}
          </div>
        )}

        {/* Extempore Tab */}
        {activeTab === 'extempore' && (
          <div className="flex-1 flex flex-col">
            <ExtemporePractice
              stream={session.stream}
              onStreamReady={handleStreamReady}
              mediaPipeReady={mediaPipeReady}
              mediaPipeLoading={mediaPipeLoading}
              currentEyeContact={currentEyeContact}
              currentPosture={currentPosture}
              isRecording={isRecording}
              onStartRecording={handleStartExtempore}
              onStopRecording={handleStopPractice}
              onTranscribe={transcribeAudio}
              onAnalyze={handleStartAnalysis}
              generateTopics={generateExtemporeTopics}
              isLoading={isTranscribing}
            />
          </div>
        )}

        {/* Practice Tab */}
        {activeTab === 'practice' && (
          <div className="flex-1 flex flex-col gap-5">
            {/* Camera with overlays */}
            <div style={{ flex: 1, position: 'relative', borderRadius: '20px', overflow: 'hidden', minHeight: '400px' }}>
              <CameraView
                onStreamReady={handleStreamReady}
                isRecording={isRecording}
              />

              <Teleprompter
                script={script}
                isActive={isPracticing}
                isSpeaking={isSpeaking}
                audioLevel={audioLevel}
              />

              <FeedbackOverlay
                eyeContact={currentEyeContact}
                posture={currentPosture}
                isActive={isPracticing}
                mediaPipeReady={mediaPipeReady}
                mediaPipeLoading={mediaPipeLoading}
              />
            </div>

            {/* Controls */}
            <div className="glass-strong" style={{ padding: '20px 24px' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center" style={{ gap: '16px' }}>
                  {isRecording && (
                    <div className="flex items-center" style={{ gap: '8px', color: 'white' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }} />
                      <span style={{ fontFamily: 'monospace', fontSize: '18px', fontWeight: '600' }}>
                        {formatDuration(duration)}
                      </span>
                    </div>
                  )}

                  {/* Show saved recording info */}
                  {!isPracticing && session.hasRecording && (
                    <div style={{ fontSize: '14px', color: '#10b981' }}>
                      ✓ Recording saved ({formatDuration(session.sessionDuration)})
                    </div>
                  )}

                  {mediaPipeError && (
                    <div style={{ fontSize: '12px', color: '#f59e0b' }}>
                      ⚠️ Tracking unavailable
                    </div>
                  )}
                </div>

                <div className="flex" style={{ gap: '12px' }}>
                  {!isPracticing && !session.hasRecording ? (
                    <button
                      onClick={handleStartPractice}
                      disabled={!script}
                      className="btn btn-success"
                      style={{ paddingLeft: '32px', paddingRight: '32px' }}
                    >
                      ▶ Start Recording
                    </button>
                  ) : isPracticing ? (
                    <>
                      <button
                        onClick={handleCancelPractice}
                        className="btn btn-secondary"
                        style={{ paddingLeft: '24px', paddingRight: '24px' }}
                      >
                        ✕ Discard
                      </button>
                      <button
                        onClick={handleStopPractice}
                        className="btn btn-danger"
                        style={{ paddingLeft: '32px', paddingRight: '32px' }}
                      >
                        ⏹ Stop Recording
                      </button>
                    </>
                  ) : session.hasRecording ? (
                    <>
                      <button
                        onClick={handleSkipAnalysis}
                        className="btn btn-secondary"
                        style={{ paddingLeft: '24px', paddingRight: '24px' }}
                      >
                        ✕ Discard
                      </button>
                      <button
                        onClick={handleStartPractice}
                        className="btn btn-secondary"
                        style={{ paddingLeft: '24px', paddingRight: '24px' }}
                      >
                        🔄 Record Again
                      </button>
                      <button
                        onClick={handleStartAnalysis}
                        className="btn btn-primary"
                        style={{ paddingLeft: '32px', paddingRight: '32px' }}
                      >
                        📊 Start Analysis
                      </button>
                    </>
                  ) : null}
                </div>

                <div className="flex items-center" style={{ gap: '16px', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
                  {isPracticing && (
                    <div className="flex items-center" style={{ gap: '8px' }}>
                      <span>🎤</span>
                      <div style={{ width: '80px', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            background: isSpeaking ? '#10b981' : '#6366f1',
                            width: `${Math.min(audioLevel * 2, 100)}%`,
                            transition: 'all 0.1s ease'
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '12px', minWidth: '60px' }}>
                        {isSpeaking ? 'Speaking' : 'Silent'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analysis Tab */}
        {activeTab === 'analysis' && (
          <div className="flex-1 flex flex-col">
            <AnalysisView
              analysis={analysis}
              isLoading={isAnalyzing || isTranscribing}
            />
          </div>
        )}
      </main>

      {/* Footer / Trust Section */}
      <footer className="glass-strong border-t border-white/5" style={{ padding: '32px 24px', marginTop: 'auto' }}>
        <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div style={{ fontSize: '24px' }}>🎙️</div>
            <div>
              <div style={{ fontWeight: '800', color: 'white', fontSize: '14px', letterSpacing: '-0.02em' }}>AI TRACKER</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '600' }}>BUILT FOR MODERN CREATORS</div>
            </div>
          </div>

          <div className="flex gap-8 text-[12px] font-medium text-white/40">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">How it Works</a>
          </div>

          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>
            © 2026 AI Tracker Engine. Empowering clearer voices worldwide.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
