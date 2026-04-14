import { Navigate, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { useRecorder } from '../../hooks/useRecorder';
import { useGroq } from '../../hooks/useGroq';
import ExtemporePractice from '../../components/ExtemporePractice';

const EXTEMPORE_TOPIC_STORAGE_KEY = 'extempore.selectedTopic';

function getStoredTopic() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.sessionStorage.getItem(EXTEMPORE_TOPIC_STORAGE_KEY) || '';
}

function storeTopic(topic) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(EXTEMPORE_TOPIC_STORAGE_KEY, topic);
}

function clearStoredTopic() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(EXTEMPORE_TOPIC_STORAGE_KEY);
}

export function ExtemporeSelectionRoute() {
  const navigate = useNavigate();
  const { isRecording, duration, audioLevel, isSpeaking, startRecording, stopRecording } = useRecorder();
  const { generateExtemporeTopics, generateExtemporeCoachSuggestion, transcribeAudio } = useGroq();

  const handleStartExtempore = useCallback(() => {
    if (window.posthog) window.posthog.capture('extempore_started');
    startRecording().catch((err) => {
      console.error('Extempore recording failed to start:', err);
    });
  }, [startRecording]);

  const handleStopPractice = useCallback(async () => {
    return stopRecording();
  }, [stopRecording]);

  const handleTopicLocked = useCallback((topic) => {
    storeTopic(topic);
    void navigate({ to: '/extempore/live' });
  }, [navigate]);

  return (
    <div className="flex flex-1 flex-col">
      <ExtemporePractice
        isRecording={isRecording}
        duration={duration}
        audioLevel={audioLevel}
        isSpeaking={isSpeaking}
        onStartRecording={handleStartExtempore}
        onStopRecording={handleStopPractice}
        generateTopics={generateExtemporeTopics}
        generateCoachSuggestion={generateExtemporeCoachSuggestion}
        transcribeAudio={transcribeAudio}
        mode="selection"
        onTopicLocked={handleTopicLocked}
      />
    </div>
  );
}

export function ExtemporeLiveRoute() {
  const navigate = useNavigate();
  const { isRecording, duration, audioLevel, isSpeaking, startRecording, stopRecording } = useRecorder();
  const { generateExtemporeTopics, generateExtemporeCoachSuggestion, transcribeAudio } = useGroq();
  const selectedTopic = getStoredTopic();

  const handleStartExtempore = useCallback(() => {
    if (window.posthog) window.posthog.capture('extempore_started');
    startRecording().catch((err) => {
      console.error('Extempore recording failed to start:', err);
    });
  }, [startRecording]);

  const handleStopPractice = useCallback(async () => {
    return stopRecording();
  }, [stopRecording]);

  const handleChooseDifferentTopic = useCallback(() => {
    clearStoredTopic();
    void navigate({ to: '/extempore' });
  }, [navigate]);

  if (!selectedTopic) {
    return <Navigate to="/extempore" />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <ExtemporePractice
        isRecording={isRecording}
        duration={duration}
        audioLevel={audioLevel}
        isSpeaking={isSpeaking}
        onStartRecording={handleStartExtempore}
        onStopRecording={handleStopPractice}
        generateTopics={generateExtemporeTopics}
        generateCoachSuggestion={generateExtemporeCoachSuggestion}
        transcribeAudio={transcribeAudio}
        mode="live"
        selectedTopic={selectedTopic}
        onChooseDifferentTopic={handleChooseDifferentTopic}
      />
    </div>
  );
}

export default ExtemporeSelectionRoute;
