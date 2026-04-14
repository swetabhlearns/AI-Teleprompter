import { useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useRecorder } from '../../hooks/useRecorder';
import { useSession } from '../../contexts/SessionContext';
import { usePracticeStore } from '../../stores/practiceStore';
import { useScriptStore } from '../../stores/scriptStore';
import Teleprompter from '../../components/Teleprompter';
import { OatButton } from '../../components/ui/OatComponents';

export function PracticeRoute() {
  const navigate = useNavigate();
  const session = useSession();
  const script = useScriptStore((state) => state.script);
  const scriptPreferences = useScriptStore((state) => state.scriptPreferences);
  const { isRecording, isSpeaking, audioLevel, startRecording, stopRecording } = useRecorder();
  const isPracticing = usePracticeStore((state) => state.isPracticing);
  const practicePaused = usePracticeStore((state) => state.practicePaused);
  const practiceSpeed = usePracticeStore((state) => state.practiceSpeed);
  const practiceSessionKey = usePracticeStore((state) => state.practiceSessionKey);
  const setIsPracticing = usePracticeStore((state) => state.setIsPracticing);
  const setPracticePaused = usePracticeStore((state) => state.setPracticePaused);
  const setPracticeSpeed = usePracticeStore((state) => state.setPracticeSpeed);
  const bumpPracticeSessionKey = usePracticeStore((state) => state.bumpPracticeSessionKey);

  const handleStartPracticeRecording = useCallback(async () => {
    setIsPracticing(true);
    setPracticePaused(false);
    try {
      await startRecording();
    } catch (err) {
      console.error('Practice recording failed to start:', err);
      setIsPracticing(false);
    }
  }, [setIsPracticing, setPracticePaused, startRecording]);

  const handleStopPractice = useCallback(async () => {
    setIsPracticing(false);
    setPracticePaused(false);
    try {
      const result = await stopRecording();
      const recordedBlob = result.blob || result;
      const finalDuration = result.duration || 0;
      session.saveRecording(recordedBlob, finalDuration, result.volumeHistory);
      if (window.posthog) {
        window.posthog.capture('practice_stopped', {
          duration: finalDuration,
          volume_samples: result.volumeHistory?.length || 0
        });
      }
      return { blob: recordedBlob, duration: finalDuration };
    } catch (err) {
      console.error('Stop recording failed:', err);
      return null;
    }
  }, [session, setIsPracticing, setPracticePaused, stopRecording]);

  const handleResetPracticeScroll = useCallback(() => {
    setPracticeSpeed(20);
    setPracticePaused(false);
    bumpPracticeSessionKey();
  }, [bumpPracticeSessionKey, setPracticePaused, setPracticeSpeed]);

  const handleDiscardPractice = useCallback(() => {
    setIsPracticing(false);
    setPracticePaused(false);
    session.resetSession();
    setPracticeSpeed(20);
    bumpPracticeSessionKey();
  }, [bumpPracticeSessionKey, session, setIsPracticing, setPracticePaused, setPracticeSpeed]);

  const handleCancelPractice = useCallback(async () => {
    setIsPracticing(false);
    setPracticePaused(false);
    await stopRecording();
    session.resetSession();
    setPracticeSpeed(20);
    void navigate({ to: '/script' });
  }, [navigate, session, setIsPracticing, setPracticePaused, setPracticeSpeed, stopRecording]);

  return (
    <div className="practice-fullscreen">
      <div className="practice-fullscreen-header">
        <div>
          <span className="eyebrow">Audio Practice</span>
          <h3>Focus on speech, timing, and clarity</h3>
        </div>

        <OatButton onClick={handleCancelPractice} variant="secondary" outline className="practice-exit-button">
          Exit Practice
        </OatButton>
      </div>

      <div className="practice-fullscreen-stage">
        <Teleprompter
          key={practiceSessionKey}
          script={script}
          isActive={isRecording}
          isSpeaking={isSpeaking}
          audioLevel={audioLevel}
          notationPreferences={scriptPreferences}
          isPaused={practicePaused}
          onPauseChange={setPracticePaused}
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
          <OatButton
            type="button"
            className="teleprompter-control-button"
            onClick={() => setPracticeSpeed((prev) => Math.max(5, prev - 10))}
          >
            −
          </OatButton>
          <div className="practice-dock-speed">
            <div className="teleprompter-speed-track">
              <div
                className="teleprompter-speed-fill"
                style={{ width: `${practiceSpeed}%` }}
              />
            </div>
            <span>{practiceSpeed}%</span>
          </div>
          <OatButton
            type="button"
            className="teleprompter-control-button"
            onClick={() => setPracticeSpeed((prev) => Math.min(100, prev + 10))}
          >
            +
          </OatButton>
          <OatButton
            type="button"
            className={`teleprompter-pause-button ${practicePaused ? 'paused' : 'running'}`}
            onClick={() => setPracticePaused(!practicePaused)}
            disabled={!isPracticing}
          >
            {practicePaused ? '▶' : '⏸'}
          </OatButton>
        </div>

        <div className="practice-dock-group practice-dock-center">
          {isPracticing ? (
            <OatButton
              onClick={handleStopPractice}
              variant="danger"
              className="practice-record-button"
            >
              ⏹ Stop
            </OatButton>
          ) : session.hasRecording ? (
            <>
              <OatButton
                onClick={handleStartPracticeRecording}
                disabled={!script}
                className="practice-record-button"
              >
                ▶ Record
              </OatButton>
              <OatButton
                onClick={handleDiscardPractice}
                variant="secondary"
                outline
                className="practice-record-button"
              >
                ✕ Discard
              </OatButton>
            </>
          ) : (
            <OatButton
              onClick={handleStartPracticeRecording}
              disabled={!script}
              className="practice-record-button"
            >
              ▶ Record
            </OatButton>
          )}
        </div>

        <div className="practice-dock-group practice-dock-right">
          <OatButton
            type="button"
            variant="secondary"
            outline
            onClick={handleResetPracticeScroll}
          >
            ↺ Reset
          </OatButton>
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
  );
}

export default PracticeRoute;
