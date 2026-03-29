import { useState, useEffect } from 'react';
import { usePostHog } from 'posthog-js/react';
import Teleprompter from './components/Teleprompter';
import ScriptEditor from './components/ScriptEditor';
import AnalysisView from './components/AnalysisView';
import InterviewSetup from './components/InterviewSetup';
import InterviewSession from './components/InterviewSession';
import InterviewResults from './components/InterviewResults';
import ExtemporePractice from './components/ExtemporePractice';
import WarmUpGuide from './components/WarmUpGuide';
import { useSession } from './contexts/SessionContext';
import { useRecorder } from './hooks/useRecorder';
import { useGroq } from './hooks/useGroq';
import { useInterview, INTERVIEW_STATES } from './hooks/useInterview';
import { useKokoroTTS } from './hooks/useKokoroTTS';
import { generatePerformanceReport } from './utils/analysisEngine';
import { generateStutteringReport } from './utils/stutteringAnalyzer';
import { formatDuration } from './utils/formatters';

const SCRIPT_PREFERENCES_KEY = 'teleprompter_script_preferences_v1';
const DEFAULT_SCRIPT_PREFERENCES = {
  showSections: true,
  showPauses: true,
  showSlow: true,
  showFast: true,
  showEmphasis: true,
  showEnunciation: true,
  distractionFree: false
};

function normalizeScriptPreferences(preferences = {}) {
  const resolved = {
    ...DEFAULT_SCRIPT_PREFERENCES,
    ...preferences
  };

  if (typeof preferences.showTempo === 'boolean') {
    resolved.showSlow = preferences.showTempo;
    resolved.showFast = preferences.showTempo;
  }

  return resolved;
}

function loadScriptPreferences() {
  try {
    const raw = localStorage.getItem(SCRIPT_PREFERENCES_KEY);
    if (!raw) return DEFAULT_SCRIPT_PREFERENCES;
    return normalizeScriptPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_SCRIPT_PREFERENCES;
  }
}

function App() {
  const posthog = usePostHog();

  // Session context for recording state
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
  const [scriptPreferences, setScriptPreferences] = useState(loadScriptPreferences);

  useEffect(() => {
    try {
      localStorage.setItem(SCRIPT_PREFERENCES_KEY, JSON.stringify(scriptPreferences));
    } catch (error) {
      console.warn('Failed to persist script preferences:', error);
    }
  }, [scriptPreferences]);

  // Practice state
  const [isPracticing, setIsPracticing] = useState(false);
  const [practiceSpeed, setPracticeSpeed] = useState(20);
  const [practiceSessionKey, setPracticeSessionKey] = useState(0);

  // Analysis state
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  // Open practice session without starting recording
  const handleEnterPractice = () => {
    setActiveTab('practice');

    if (posthog) posthog.capture('practice_started');

    setAnalysis(null);
    session.resetSession();
    setIsPracticing(false);
    setPracticeSpeed(20);
    setPracticeSessionKey((prev) => prev + 1);
  };

  // Cancel practice without saving
  const handleCancelPractice = async () => {
    setIsPracticing(false);
    await stopRecording();
    session.resetSession();
    setPracticeSpeed(20);
    setActiveTab('script');
  };

  const handleStartPracticeRecording = async () => {
    setIsPracticing(true);
    try {
      await startRecording();
    } catch (err) {
      console.error('Practice recording failed to start:', err);
      setIsPracticing(false);
    }
  };

  const handleResetPracticeScroll = () => {
    setPracticeSpeed(20);
    setPracticeSessionKey((prev) => prev + 1);
  };

  const handleDiscardPractice = () => {
    setIsPracticing(false);
    session.resetSession();
    setAnalysis(null);
    setPracticeSpeed(20);
    setPracticeSessionKey((prev) => prev + 1);
  };

  // Stop practice - save recording for later analysis
  const handleStopPractice = async () => {
    setIsPracticing(false);

    try {
      // Use the returned object from stopRecording (now contains duration)
      const result = await stopRecording();

      const recordedBlob = result.blob || result;
      const finalDuration = result.duration || duration;

      // Save recording and volume history to session context
      session.saveRecording(recordedBlob, finalDuration, result.volumeHistory);

      if (posthog) {
        posthog.capture('practice_stopped', {
          duration: finalDuration,
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

    setIsPracticing(true);
    startRecording().catch((err) => {
      console.error('Extempore recording failed to start:', err);
      setIsPracticing(false);
    });
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
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
            <span>Audio only</span>
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
              onStartPractice={handleEnterPractice}
              notationPreferences={scriptPreferences}
              onNotationPreferencesChange={setScriptPreferences}
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
                  isRecording={isRecording}
                  onStartRecording={startRecording}
                  onStopRecording={stopRecording}
                  onTranscribe={transcribeAudio}
                  onEvaluate={evaluateAnswer}
                  isProcessing={isTranscribing}
                  isGeneratingAudio={kokoroTTS.isGenerating}
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
              isRecording={isRecording}
              onStartRecording={handleStartExtempore}
              onStopRecording={handleStopPractice}
              onAnalyze={handleStartAnalysis}
              generateTopics={generateExtemporeTopics}
            />
          </div>
        )}

        {/* Practice Tab */}
        {activeTab === 'practice' && (
          <div className="practice-fullscreen">
            <div className="practice-fullscreen-header">
              <div>
                <span className="eyebrow">Audio Practice</span>
                <h3>Focus on speech, timing, and clarity</h3>
              </div>

              <button onClick={handleCancelPractice} className="btn btn-secondary practice-exit-button">
                Exit Practice
              </button>
            </div>

            <div className="practice-fullscreen-stage">
              <Teleprompter
                key={practiceSessionKey}
                script={script}
                isActive={isRecording}
                isSpeaking={isSpeaking}
                audioLevel={audioLevel}
                notationPreferences={scriptPreferences}
                speed={practiceSpeed}
                onSpeedChange={setPracticeSpeed}
                variant="overlay"
                showControls={false}
                showHints={false}
                showLiveIndicator={false}
              />
            </div>

            <div className="practice-bottom-dock glass-strong">
              <div className="practice-dock-group">
                <span className="practice-dock-label">Speed</span>
                <button
                  type="button"
                  className="teleprompter-control-button"
                  onClick={() => setPracticeSpeed((prev) => Math.max(10, prev - 10))}
                >
                  −
                </button>
                <div className="practice-dock-speed">
                  <div className="teleprompter-speed-track">
                    <div
                      className="teleprompter-speed-fill"
                      style={{ width: `${practiceSpeed}%` }}
                    />
                  </div>
                  <span>{practiceSpeed}%</span>
                </div>
                <button
                  type="button"
                  className="teleprompter-control-button"
                  onClick={() => setPracticeSpeed((prev) => Math.min(100, prev + 10))}
                >
                  +
                </button>
              </div>

              <div className="practice-dock-group practice-dock-center">
                {isPracticing ? (
                  <button
                    onClick={handleStopPractice}
                    className="btn btn-danger practice-record-button"
                  >
                    ⏹ Stop
                  </button>
                ) : session.hasRecording ? (
                  <>
                    <button
                      onClick={handleStartPracticeRecording}
                      disabled={!script}
                      className="btn btn-success practice-record-button"
                    >
                      ▶ Record
                    </button>
                    <button
                      onClick={handleDiscardPractice}
                      className="btn btn-secondary practice-record-button"
                    >
                      ✕ Discard
                    </button>
                    <button
                      onClick={handleStartAnalysis}
                      className="btn btn-primary practice-record-button"
                    >
                      📊 Analyze
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleStartPracticeRecording}
                    disabled={!script}
                    className="btn btn-success practice-record-button"
                  >
                    ▶ Record
                  </button>
                )}
              </div>

              <div className="practice-dock-group practice-dock-right">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleResetPracticeScroll}
                >
                  ↺ Reset
                </button>
                {isPracticing && (
                  <div className="practice-live-pill">
                    <span className={isSpeaking ? 'text-emerald-400' : 'text-white/60'}>
                      {isSpeaking ? 'Speaking' : 'Listening'}
                    </span>
                    <div className="practice-level-meter">
                      <div
                        className="practice-level-meter-fill"
                        style={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
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

      {activeTab !== 'practice' && (
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
      )}
    </div>
  );
}

export default App;
