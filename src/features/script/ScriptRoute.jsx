import { useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import ScriptEditor from '../../components/ScriptEditor';
import { useSession } from '../../contexts/SessionContext';
import { usePracticeStore } from '../../stores/practiceStore';
import { useScriptStore } from '../../stores/scriptStore';

export function ScriptRoute() {
  const navigate = useNavigate();
  const { resetSession } = useSession();
  const script = useScriptStore((state) => state.script);
  const setScript = useScriptStore((state) => state.setScript);
  const scriptPreferences = useScriptStore((state) => state.scriptPreferences);
  const setScriptPreferences = useScriptStore((state) => state.setScriptPreferences);
  const setIsPracticing = usePracticeStore((state) => state.setIsPracticing);
  const setPracticeSpeed = usePracticeStore((state) => state.setPracticeSpeed);
  const bumpPracticeSessionKey = usePracticeStore((state) => state.bumpPracticeSessionKey);

  const handleEnterPractice = useCallback(() => {
    if (window.posthog) window.posthog.capture('practice_started');
    resetSession();
    setIsPracticing(false);
    setPracticeSpeed(20);
    bumpPracticeSessionKey();
    void navigate({ to: '/practice' });
  }, [bumpPracticeSessionKey, navigate, resetSession, setIsPracticing, setPracticeSpeed]);

  return (
    <div className="flex flex-1 flex-col">
      <ScriptEditor
        script={script}
        onScriptChange={setScript}
        onStartPractice={handleEnterPractice}
        notationPreferences={scriptPreferences}
        onNotationPreferencesChange={setScriptPreferences}
      />
    </div>
  );
}

export default ScriptRoute;
