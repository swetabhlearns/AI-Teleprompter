import { createContext, useContext, useState, useRef, useCallback, useMemo } from 'react';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
    // Stream state
    const [stream, setStream] = useState(null);

    // Recording result state (after stopping, before analysis)
    const [recordingResult, setRecordingResult] = useState(null);
    const [hasRecording, setHasRecording] = useState(false);
    const [sessionDuration, setSessionDuration] = useState(0);

    // Saved metrics after stopping (for analysis)
    const [savedMetrics, setSavedMetrics] = useState(null);
    const [volumeHistory, setVolumeHistory] = useState([]); // Store volume history for analysis

    // Reset session state
    const resetSession = useCallback(() => {
        setRecordingResult(null);
        setHasRecording(false);
        setSavedMetrics(null);
        setVolumeHistory([]);
        setSessionDuration(0);
    }, []);

    // Save recording with pre-calculated metrics
    const saveRecording = useCallback((blob, duration, metrics, volHistory = []) => {
        setSessionDuration(duration);
        setSavedMetrics(metrics);
        setRecordingResult(blob);
        setVolumeHistory(volHistory);
        setHasRecording(true);

        console.log('Recording saved. Metrics:', {
            ...metrics,
            blobSize: blob?.size || 0,
            duration,
            volumeSamples: volHistory.length
        });

        return metrics;
    }, []);

    // Memoize the context value to prevent unnecessary re-renders
    const value = useMemo(() => ({
        // Stream
        stream,
        setStream,

        // Recording state
        recordingResult,
        hasRecording,
        sessionDuration,

        // Metrics
        savedMetrics,
        volumeHistory,

        // Actions
        resetSession,
        saveRecording,
        setRecordingResult,
        setHasRecording
    }), [
        stream,
        recordingResult,
        hasRecording,
        sessionDuration,
        savedMetrics,
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
