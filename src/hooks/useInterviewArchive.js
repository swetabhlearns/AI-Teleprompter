import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    appendInterviewAnswer,
    appendInterviewQuestion,
    completeInterviewArchiveSession,
    createInterviewArchiveSession,
    deleteInterviewArchiveSession,
    downloadInterviewArchiveSession,
    exportInterviewArchiveSession,
    failInterviewArchiveSession,
    getInterviewArchiveSession,
    listInterviewArchiveSessions,
    saveInterviewArchiveSession,
    summarizeInterviewArchiveSession,
    updateInterviewArchiveConversation,
    updateInterviewArchiveQuestions
} from '../utils/interviewArchive';

const ARCHIVE_QUERY_KEY = ['interview-archive', 'sessions'];

function upsertSummary(list = [], summary = null) {
    if (!summary) return list;

    const index = list.findIndex((item) => item.id === summary.id);
    const next = list.slice();

    if (index >= 0) {
        next[index] = summary;
        return next.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    }

    next.push(summary);
    return next.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
}

function removeSummary(list = [], sessionId = '') {
    return list.filter((item) => item.id !== sessionId);
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useInterviewArchive({ enabled = true } = {}) {
    const queryClient = useQueryClient();
    const taskQueueRef = useRef(Promise.resolve());
    const sessionCreateStateRef = useRef(new Map());

    const sessionsQuery = useQuery({
        queryKey: ARCHIVE_QUERY_KEY,
        queryFn: listInterviewArchiveSessions,
        enabled,
        staleTime: 10_000
    });

    const enqueueTask = useCallback((task) => {
        const wrappedTask = async () => {
            try {
                return await task();
            } catch (taskError) {
                const message = taskError?.message || 'Interview archive write failed';
                console.warn('[InterviewArchive] write failed:', message, taskError);
                return null;
            }
        };

        const next = taskQueueRef.current.then(wrappedTask, wrappedTask);
        taskQueueRef.current = next.then(() => undefined, () => undefined);
        return next;
    }, []);

    const refreshSessions = useCallback(async () => {
        const result = await queryClient.invalidateQueries({ queryKey: ARCHIVE_QUERY_KEY });
        return result;
    }, [queryClient]);

    const beginSession = useCallback(({ id, mode, config, questions = [], source = 'interview' } = {}) => {
        const session = createInterviewArchiveSession({
            id,
            mode,
            config,
            questions,
            source
        });

        const createTask = enqueueTask(async () => {
            const initialQuestions = Array.isArray(questions) && questions.length > 0 ? questions : session.questions;
            try {
                const nextSession = await saveInterviewArchiveSession({
                    ...session,
                    questions: initialQuestions
                });

                if (nextSession) {
                    sessionCreateStateRef.current.set(session.id, 'ready');
                    queryClient.setQueryData(ARCHIVE_QUERY_KEY, (current = []) => upsertSummary(current, summarizeInterviewArchiveSession(nextSession)));
                    return nextSession;
                }
            } catch (createError) {
                console.warn('[InterviewArchive] create request failed, probing for persisted session:', createError);
            }

            for (let attempt = 0; attempt < 3; attempt += 1) {
                await delay(100 * (attempt + 1));
                const recoveredSession = await getInterviewArchiveSession(session.id);
                if (recoveredSession) {
                    sessionCreateStateRef.current.set(session.id, 'ready');
                    queryClient.setQueryData(ARCHIVE_QUERY_KEY, (current = []) => upsertSummary(current, summarizeInterviewArchiveSession(recoveredSession)));
                    return recoveredSession;
                }
            }

            sessionCreateStateRef.current.set(session.id, 'failed');
            return null;
        });

        sessionCreateStateRef.current.set(session.id, 'pending');

        createTask.catch(() => {
            sessionCreateStateRef.current.set(session.id, 'failed');
        });

        return session.id;
    }, [enqueueTask, queryClient]);

    const waitForSessionCreate = useCallback(async (sessionId) => {
        const state = sessionCreateStateRef.current.get(sessionId);
        if (!state || state === 'ready') {
            return true;
        }

        if (state === 'failed') {
            return false;
        }

        while (sessionCreateStateRef.current.get(sessionId) === 'pending') {
            await new Promise((resolve) => setTimeout(resolve, 10));
        }

        return sessionCreateStateRef.current.get(sessionId) === 'ready';
    }, []);

    const recordQuestion = useCallback((sessionId, payload = {}) => {
        if (!sessionId) return Promise.resolve(null);

        return enqueueTask(async () => {
            const ready = await waitForSessionCreate(sessionId);
            if (!ready) return null;

            const nextSession = await appendInterviewQuestion(sessionId, payload);
            if (!nextSession) return null;

            queryClient.setQueryData(ARCHIVE_QUERY_KEY, (current = []) => upsertSummary(current, summarizeInterviewArchiveSession(nextSession)));
            return nextSession;
        });
    }, [enqueueTask, queryClient, waitForSessionCreate]);

    const recordQuestionBank = useCallback((sessionId, questions = []) => {
        if (!sessionId) return Promise.resolve(null);

        return enqueueTask(async () => {
            const ready = await waitForSessionCreate(sessionId);
            if (!ready) return null;

            const nextSession = await updateInterviewArchiveQuestions(sessionId, questions);
            if (!nextSession) return null;

            queryClient.setQueryData(ARCHIVE_QUERY_KEY, (current = []) => upsertSummary(current, summarizeInterviewArchiveSession(nextSession)));
            return nextSession;
        });
    }, [enqueueTask, queryClient, waitForSessionCreate]);

    const recordAnswer = useCallback((sessionId, payload = {}) => {
        if (!sessionId) return Promise.resolve(null);

        return enqueueTask(async () => {
            const ready = await waitForSessionCreate(sessionId);
            if (!ready) return null;

            const nextSession = await appendInterviewAnswer(sessionId, payload);
            if (!nextSession) return null;

            queryClient.setQueryData(ARCHIVE_QUERY_KEY, (current = []) => upsertSummary(current, summarizeInterviewArchiveSession(nextSession)));
            return nextSession;
        });
    }, [enqueueTask, queryClient, waitForSessionCreate]);

    const finalizeSession = useCallback((sessionId, results = null) => {
        if (!sessionId) return Promise.resolve(null);

        return enqueueTask(async () => {
            const ready = await waitForSessionCreate(sessionId);
            if (!ready) return null;

            const nextSession = await completeInterviewArchiveSession(sessionId, results);
            if (!nextSession) return null;

            queryClient.setQueryData(ARCHIVE_QUERY_KEY, (current = []) => upsertSummary(current, summarizeInterviewArchiveSession(nextSession)));
            return nextSession;
        });
    }, [enqueueTask, queryClient, waitForSessionCreate]);

    const syncConversationSnapshot = useCallback((sessionId, snapshot = {}) => {
        if (!sessionId) return Promise.resolve(null);

        return enqueueTask(async () => {
            const ready = await waitForSessionCreate(sessionId);
            if (!ready) return null;

            const nextSession = await updateInterviewArchiveConversation(sessionId, snapshot);
            if (!nextSession) return null;

            queryClient.setQueryData(ARCHIVE_QUERY_KEY, (current = []) => upsertSummary(current, summarizeInterviewArchiveSession(nextSession)));
            return nextSession;
        });
    }, [enqueueTask, queryClient, waitForSessionCreate]);

    const failSession = useCallback((sessionId, errorMessage = '', results = null) => {
        if (!sessionId) return Promise.resolve(null);

        return enqueueTask(async () => {
            const ready = await waitForSessionCreate(sessionId);
            if (!ready) return null;

            const nextSession = await failInterviewArchiveSession(sessionId, errorMessage, results);
            if (!nextSession) return null;

            queryClient.setQueryData(ARCHIVE_QUERY_KEY, (current = []) => upsertSummary(current, summarizeInterviewArchiveSession(nextSession)));
            return nextSession;
        });
    }, [enqueueTask, queryClient, waitForSessionCreate]);

    const getSession = useCallback(async (sessionId) => {
        if (!sessionId) return null;
        return getInterviewArchiveSession(sessionId);
    }, []);

    const exportSession = useCallback(async (sessionId) => {
        if (!sessionId) return null;
        return exportInterviewArchiveSession(sessionId);
    }, []);

    const downloadSession = useCallback(async (sessionOrId, fileName = '') => {
        const session = typeof sessionOrId === 'string'
            ? await exportInterviewArchiveSession(sessionOrId)
            : sessionOrId;

        if (!session) return false;
        return downloadInterviewArchiveSession(session, fileName);
    }, []);

    const deleteSession = useCallback((sessionId) => {
        if (!sessionId) return Promise.resolve(false);

        return enqueueTask(async () => {
            const deleted = await deleteInterviewArchiveSession(sessionId);
            if (deleted) {
                queryClient.setQueryData(ARCHIVE_QUERY_KEY, (current = []) => removeSummary(current, sessionId));
            }
            return deleted;
        });
    }, [enqueueTask, queryClient]);

    useEffect(() => {
        if (sessionsQuery.error) {
            console.warn('[InterviewArchive] load failed:', sessionsQuery.error?.message || 'Failed to load interview archive');
        }
    }, [sessionsQuery.error]);

    return {
        sessions: sessionsQuery.data || [],
        isLoading: sessionsQuery.isPending,
        error: sessionsQuery.error?.message || null,
        beginSession,
        recordQuestion,
        recordQuestionBank,
        recordAnswer,
        finalizeSession,
        syncConversationSnapshot,
        failSession,
        getSession,
        exportSession,
        downloadSession,
        deleteSession,
        refreshSessions
    };
}

export default useInterviewArchive;
