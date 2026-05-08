import { Navigate, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import ExtemporeSpeakOnly from '../../components/ExtemporeSpeakOnly';
import ExtemporeTopicPicker from '../../components/ExtemporeTopicPicker';

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

  const handleTopicLocked = useCallback((topic) => {
    storeTopic(topic);
    void navigate({ to: '/extempore/live' });
  }, [navigate]);

  return (
    <div className="flex flex-1 flex-col">
      <ExtemporeTopicPicker onTopicSelect={handleTopicLocked} />
    </div>
  );
}

export function ExtemporeLiveRoute() {
  const navigate = useNavigate();
  const selectedTopic = getStoredTopic();

  const handleChooseDifferentTopic = useCallback(() => {
    clearStoredTopic();
    void navigate({ to: '/extempore' });
  }, [navigate]);

  if (!selectedTopic) {
    return <Navigate to="/extempore" />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <ExtemporeSpeakOnly
        selectedTopic={selectedTopic}
        onChooseDifferentTopic={handleChooseDifferentTopic}
      />
    </div>
  );
}

export default ExtemporeSelectionRoute;
