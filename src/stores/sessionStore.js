import { create } from 'zustand';

export const useSessionStore = create((set) => ({
  recordingResult: null,
  hasRecording: false,
  sessionDuration: 0,
  volumeHistory: [],
  resetSession: () => set({
    recordingResult: null,
    hasRecording: false,
    sessionDuration: 0,
    volumeHistory: []
  }),
  saveRecording: (blob, duration, volHistory = []) => {
    const nextState = {
      recordingResult: blob,
      hasRecording: true,
      sessionDuration: duration,
      volumeHistory: volHistory
    };

    set(nextState);

    console.log('Recording saved. Metrics:', {
      blobSize: blob?.size || 0,
      duration,
      volumeSamples: volHistory.length
    });

    return {
      blobSize: blob?.size || 0,
      duration,
      volumeSamples: volHistory.length
    };
  }
}));

