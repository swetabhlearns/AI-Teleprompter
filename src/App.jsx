import { useState, useRef, useCallback, useEffect } from 'react';
import CameraView from './components/CameraView';
import Teleprompter from './components/Teleprompter';
import ScriptEditor from './components/ScriptEditor';
import FeedbackOverlay from './components/FeedbackOverlay';
import AnalysisView from './components/AnalysisView';
import InterviewSetup from './components/InterviewSetup';
import InterviewSession from './components/InterviewSession';
import InterviewResults from './components/InterviewResults';
import { useMediaPipe } from './hooks/useMediaPipe';
import { useRecorder } from './hooks/useRecorder';
import { useGroq } from './hooks/useGroq';
import { useInterview, INTERVIEW_STATES } from './hooks/useInterview';
import { useKokoroTTS } from './hooks/useKokoroTTS';
import { generatePerformanceReport } from './utils/analysisEngine';
import { generateStutteringReport } from './utils/stutteringAnalyzer';
import { formatDuration } from './utils/formatters';

function App() {
  // Tab navigation
  const [activeTab, setActiveTab] = useState('script');

  // Script state
  const [script, setScript] = useState('');

  // Practice state
  const [isPracticing, setIsPracticing] = useState(false);
  const [stream, setStream] = useState(null);

  // Recording result state (after stopping, before analysis)
  const [recordingResult, setRecordingResult] = useState(null);
  const [hasRecording, setHasRecording] = useState(false); // Separate flag for UI
  const [sessionDuration, setSessionDuration] = useState(0);

  // Analysis state
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Real-time tracking state (updated from MediaPipe)
  const [currentEyeContact, setCurrentEyeContact] = useState(null);
  const [currentPosture, setCurrentPosture] = useState(null);

  // Tracking metrics for analysis (accumulated over session)
  const metricsRef = useRef({
    eyeContactFrames: 0,
    totalFrames: 0,
    postureScores: []
  });

  // Saved metrics after stopping (for analysis)
  const [savedMetrics, setSavedMetrics] = useState(null);

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

  const { transcribeAudio, generateInterviewQuestions, evaluateAnswer, isLoading: isTranscribing } = useGroq();

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
    setStream(newStream);
  }, []);

  // Set video ref when practice or interview tab is active
  useEffect(() => {
    if (activeTab === 'practice' || (activeTab === 'interview' && interview.state !== INTERVIEW_STATES.IDLE && interview.state !== INTERVIEW_STATES.SETUP)) {
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
  const lastStateUpdateRef = useRef(0);

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
          metricsRef.current.totalFrames++;
          if (result.eyeContact?.isLookingAtCamera) {
            metricsRef.current.eyeContactFrames++;
          }
          if (result.posture?.score !== undefined) {
            metricsRef.current.postureScores.push(result.posture.score);
          }

          const now = Date.now();
          if (now - lastStateUpdateRef.current > 100) {
            lastStateUpdateRef.current = now;
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
    setRecordingResult(null);
    setHasRecording(false);
    setAnalysis(null);
    setSavedMetrics(null);

    metricsRef.current = {
      eyeContactFrames: 0,
      totalFrames: 0,
      postureScores: []
    };

    setCurrentEyeContact(null);
    setCurrentPosture(null);

    setTimeout(() => {
      setIsPracticing(true);
      if (stream) {
        startRecording(stream);
      }
    }, 500);
  };

  // Cancel practice without saving
  const handleCancelPractice = async () => {
    setIsPracticing(false);
    await stopRecording();
    setRecordingResult(null);
    setHasRecording(false);
    setActiveTab('script');
  };

  // Stop practice - save recording for later analysis
  const handleStopPractice = async () => {
    setIsPracticing(false);

    try {
      const recordedBlob = await stopRecording();

      // Save the current duration
      setSessionDuration(duration);

      // Calculate and save metrics
      const eyeContactPercentage = metricsRef.current.totalFrames > 0
        ? Math.round((metricsRef.current.eyeContactFrames / metricsRef.current.totalFrames) * 100)
        : 0;

      const avgPosture = metricsRef.current.postureScores.length > 0
        ? Math.round(metricsRef.current.postureScores.reduce((a, b) => a + b, 0) / metricsRef.current.postureScores.length)
        : 0;

      console.log('Recording stopped. Metrics:', {
        totalFrames: metricsRef.current.totalFrames,
        eyeContactFrames: metricsRef.current.eyeContactFrames,
        eyeContactPercentage,
        avgPosture,
        blobSize: recordedBlob?.size || 0
      });

      // Save for later analysis
      setSavedMetrics({ eyeContactPercentage, avgPosture });
      setRecordingResult(recordedBlob);
      setHasRecording(true); // Always set to true after stopping

    } catch (err) {
      console.error('Stop recording failed:', err);
    }
  };

  // Start analysis (user-triggered)
  const handleStartAnalysis = async () => {
    if (!recordingResult && !audioBlob) {
      console.error('No recording to analyze');
      return;
    }

    setIsAnalyzing(true);
    setActiveTab('analysis');

    try {
      let transcriptData = { text: '', words: [], segments: [] };

      // Use audioBlob (smaller, audio-only) for transcription instead of video
      const blobToTranscribe = audioBlob || recordingResult;

      if (blobToTranscribe && blobToTranscribe.size > 0) {
        console.log('Starting transcription...');
        console.log('Blob size:', blobToTranscribe.size, 'bytes');
        console.log('Blob type:', blobToTranscribe.type);

        try {
          transcriptData = await transcribeAudio(blobToTranscribe);
          console.log('Transcription successful:', transcriptData.text);
          console.log('Word timestamps received:', transcriptData.words?.length || 0);
        } catch (err) {
          console.error('Transcription failed:', err);
          // Continue with empty data
        }
      } else {
        console.warn('No audio data to transcribe');
      }

      // Generate stuttering analysis from word-level data
      const stutteringReport = transcriptData.words?.length > 0
        ? generateStutteringReport(transcriptData.words)
        : null;

      console.log('Stuttering Analysis:', stutteringReport);

      // Generate comprehensive performance report
      const report = generatePerformanceReport({
        transcript: transcriptData.text || '',
        words: transcriptData.words || [],
        stutteringReport,
        durationMs: sessionDuration,
        eyeContactPercentage: savedMetrics?.eyeContactPercentage || 0,
        postureScore: savedMetrics?.avgPosture || 0
      });

      console.log('Performance Report:', report);
      setAnalysis(report);

    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSkipAnalysis = () => {
    setRecordingResult(null);
    setHasRecording(false);
    setActiveTab('script');
  };

  // Interview handlers
  const handleStartInterview = async () => {
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
    { id: 'script', label: '📝 Script' },
    { id: 'interview', label: '🎤 Interview' },
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
              <h1 className="font-display" style={{ fontSize: '22px', fontWeight: '800', color: 'white', letterSpacing: '-0.02em' }}>
                AI Teleprompter
              </h1>
              <p style={{ fontSize: '12px', color: 'rgba(226,232,240,0.5)', letterSpacing: '0.02em' }}>
                Fluency Practice Assistant
              </p>
            </div>
          </div>

          <nav className="tab-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                disabled={isPracticing && tab.id !== 'practice'}
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
      <main className="flex-1 w-full" style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
        {/* Script Tab */}
        {activeTab === 'script' && (
          <div style={{ height: 'calc(100vh - 140px)' }}>
            <ScriptEditor
              script={script}
              onScriptChange={setScript}
              onStartPractice={handleStartPractice}
            />
          </div>
        )}

        {/* Interview Tab */}
        {activeTab === 'interview' && (
          <div style={{ height: 'calc(100vh - 140px)' }}>
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

        {/* Practice Tab */}
        {activeTab === 'practice' && (
          <div style={{ height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                  {!isPracticing && hasRecording && (
                    <div style={{ fontSize: '14px', color: '#10b981' }}>
                      ✓ Recording saved ({formatDuration(sessionDuration)})
                    </div>
                  )}

                  {mediaPipeError && (
                    <div style={{ fontSize: '12px', color: '#f59e0b' }}>
                      ⚠️ Tracking unavailable
                    </div>
                  )}
                </div>

                <div className="flex" style={{ gap: '12px' }}>
                  {!isPracticing && !hasRecording ? (
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
                  ) : hasRecording ? (
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
          <div style={{ height: 'calc(100vh - 140px)' }}>
            <AnalysisView
              analysis={analysis}
              isLoading={isAnalyzing || isTranscribing}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
