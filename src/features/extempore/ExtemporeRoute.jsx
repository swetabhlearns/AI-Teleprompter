import { useRecorder } from '../../hooks/useRecorder';
import { useGroq } from '../../hooks/useGroq';
import ExtemporePractice from '../../components/ExtemporePractice';

export function ExtemporeRoute() {
  const { isRecording, startRecording, stopRecording } = useRecorder();
  const { generateExtemporeTopics } = useGroq();

  const handleStartExtempore = () => {
    if (window.posthog) window.posthog.capture('extempore_started');
    startRecording().catch((err) => {
      console.error('Extempore recording failed to start:', err);
    });
  };

  const handleStopPractice = async () => {
    return stopRecording();
  };

  return (
    <div className="flex flex-1 flex-col">
      <ExtemporePractice
        isRecording={isRecording}
        onStartRecording={handleStartExtempore}
        onStopRecording={handleStopPractice}
        generateTopics={generateExtemporeTopics}
      />
    </div>
  );
}

export default ExtemporeRoute;

