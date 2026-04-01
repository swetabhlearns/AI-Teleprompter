import { useCallback, useRef } from 'react';
import { useInterviewStore } from '../stores/interviewStore';

const NOOP_ASYNC = async () => {};
const NOOP = () => {};

/**
 * Interview session states
 */
export const INTERVIEW_STATES = {
  IDLE: 'idle',
  SETUP: 'setup',
  READY: 'ready',
  ASKING: 'asking',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  EVALUATING: 'evaluating',
  COMPLETE: 'complete',
  ERROR: 'error'
};

/**
 * Custom hook for managing mock interview sessions
 * @param {Object} tts - TTS functions { speak, stop, isSpeaking }
 */
export function useInterview(tts = {}) {
  const state = useInterviewStore((store) => store.state);
  const setState = useInterviewStore((store) => store.setState);
  const config = useInterviewStore((store) => store.config);
  const setConfig = useInterviewStore((store) => store.setConfig);
  const questions = useInterviewStore((store) => store.questions);
  const currentQuestionIndex = useInterviewStore((store) => store.currentQuestionIndex);
  const answers = useInterviewStore((store) => store.answers);
  const evaluations = useInterviewStore((store) => store.evaluations);
  const answerTime = useInterviewStore((store) => store.answerTime);
  const error = useInterviewStore((store) => store.error);
  const startInterview = useInterviewStore((store) => store.startInterview);
  const failInterview = useInterviewStore((store) => store.failInterview);
  const submitAnswerToStore = useInterviewStore((store) => store.submitAnswer);
  const addEvaluation = useInterviewStore((store) => store.addEvaluation);
  const recordLiveAnswerToStore = useInterviewStore((store) => store.recordLiveAnswer);
  const skipQuestion = useInterviewStore((store) => store.skipQuestion);
  const endInterview = useInterviewStore((store) => store.endInterview);
  const resetInterviewStore = useInterviewStore((store) => store.resetInterview);
  const setAnswerTime = useInterviewStore((store) => store.setAnswerTime);
  const getResults = useInterviewStore((store) => store.getResults);

  const timerRef = useRef(null);
  const speak = tts.speak || NOOP_ASYNC;
  const stopSpeaking = tts.stop || NOOP;
  const isSpeaking = tts.isSpeaking || false;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      setAnswerTime((prev) => prev + 1);
    }, 1000);
  }, [setAnswerTime, stopTimer]);

  /**
   * Ask the current question (speak it)
   */
  const askCurrentQuestion = useCallback(async () => {
    if (currentQuestionIndex >= questions.length) {
      setState(INTERVIEW_STATES.COMPLETE);
      return;
    }

    setState(INTERVIEW_STATES.ASKING);
    const question = questions[currentQuestionIndex];

    try {
      await speak(question.text);
    } catch (err) {
      failInterview(err?.message || 'Failed to speak question');
      return;
    }

    setState(INTERVIEW_STATES.LISTENING);
    setAnswerTime(0);

    if (config.interviewMode !== 'live') {
      startTimer();
    }
  }, [config.interviewMode, currentQuestionIndex, failInterview, questions, setAnswerTime, setState, speak, startTimer]);

  const beginListening = useCallback((options = {}) => {
    const { preserveTimer = false, startTimer: shouldStartTimer = true } = options;
    stopTimer();

    if (!preserveTimer) {
      setAnswerTime(0);
    }

    setState(INTERVIEW_STATES.LISTENING);

    if (!shouldStartTimer) {
      return;
    }

    startTimer();
  }, [setAnswerTime, setState, startTimer, stopTimer]);

  /**
   * Submit answer and move to evaluation
   */
  const submitAnswer = useCallback((transcript) => {
    stopTimer();
    return submitAnswerToStore(transcript);
  }, [stopTimer, submitAnswerToStore]);

  const recordLiveAnswer = useCallback((transcript, options = {}) => {
    stopTimer();
    return recordLiveAnswerToStore(transcript, options);
  }, [recordLiveAnswerToStore, stopTimer]);

  /**
   * Get current question
   */
  const currentQuestion = questions[currentQuestionIndex] || null;

  return {
    state,
    setState,
    config,
    setConfig,
    questions,
    currentQuestion,
    currentQuestionIndex,
    answers,
    evaluations,
    answerTime,
    error,
    isSpeaking,
    speak,
    stopSpeaking,
    startInterview,
    failInterview,
    askCurrentQuestion,
    beginListening,
    submitAnswer,
    addEvaluation,
    recordLiveAnswer,
    skipQuestion,
    endInterview,
    resetInterview: () => {
      stopTimer();
      stopSpeaking();
      resetInterviewStore();
    },
    getResults
  };
}

export default useInterview;
