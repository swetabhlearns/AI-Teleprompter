/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo } from 'react';
import { useSessionStore } from '../stores/sessionStore';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
    const recordingResult = useSessionStore((state) => state.recordingResult);
    const hasRecording = useSessionStore((state) => state.hasRecording);
    const sessionDuration = useSessionStore((state) => state.sessionDuration);
    const volumeHistory = useSessionStore((state) => state.volumeHistory);
    const resetSession = useSessionStore((state) => state.resetSession);
    const saveRecording = useSessionStore((state) => state.saveRecording);

    const value = useMemo(() => ({
        recordingResult,
        hasRecording,
        sessionDuration,
        volumeHistory,
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
