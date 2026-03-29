import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
    // Recording result state (after stopping, before analysis)
    const [recordingResult, setRecordingResult] = useState(null);
    const [hasRecording, setHasRecording] = useState(false);
    const [sessionDuration, setSessionDuration] = useState(0);

    const [volumeHistory, setVolumeHistory] = useState([]); // Store volume history for analysis

    // Reset session state
    const resetSession = useCallback(() => {
        setRecordingResult(null);
        setHasRecording(false);
        setVolumeHistory([]);
        setSessionDuration(0);
    }, []);

    // Save recording with volume history for analysis
    const saveRecording = useCallback((blob, duration, volHistory = []) => {
        setSessionDuration(duration);
        setRecordingResult(blob);
        setVolumeHistory(volHistory);
        setHasRecording(true);

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
    }, []);

    // Memoize the context value to prevent unnecessary re-renders
    const value = useMemo(() => ({
        // Recording state
        recordingResult,
        hasRecording,
        sessionDuration,

        // Metrics
        volumeHistory,

        // Actions
        resetSession,
        saveRecording
    }), [
        recordingResult,
        hasRecording,
        sessionDuration,
        volumeHistory,
        resetSession,
        saveRecording
    ]);

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
}
