import { useState, useCallback, useRef } from 'react';

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
    COMPLETE: 'complete'
};

/**
 * Custom hook for managing mock interview sessions
 * @param {Object} tts - TTS functions { speak, stop, isSpeaking }
 */
export function useInterview(tts = {}) {
    // Session state
    const [state, setState] = useState(INTERVIEW_STATES.IDLE);
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [evaluations, setEvaluations] = useState([]);

    // Interview config
    const [config, setConfig] = useState({
        college: '',
        interviewType: 'general',
        duration: 10,
        profile: {
            name: '',
            background: '',
            workExperience: '',
            education: '',
            hobbies: '',
            whyMba: ''
        }
    });

    // Timer
    const [answerTime, setAnswerTime] = useState(0);
    const timerRef = useRef(null);

    // TTS functions from external hook (Kokoro or Web Speech API)
    const speak = tts.speak || (async () => { });
    const stopSpeaking = tts.stop || (() => { });
    const isSpeaking = tts.isSpeaking || false;

    /**
     * Start interview with generated questions
     */
    const startInterview = useCallback((generatedQuestions) => {
        setQuestions(generatedQuestions);
        setCurrentQuestionIndex(0);
        setAnswers([]);
        setEvaluations([]);
        setState(INTERVIEW_STATES.READY);
    }, []);

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
        await speak(question.text);

        // After speaking, wait for user to start answering
        setState(INTERVIEW_STATES.LISTENING);
        setAnswerTime(0);

        // Start answer timer
        timerRef.current = setInterval(() => {
            setAnswerTime(prev => prev + 1);
        }, 1000);
    }, [currentQuestionIndex, questions, speak]);

    /**
     * Submit answer and move to evaluation
     */
    const submitAnswer = useCallback((transcript) => {
        // Stop timer
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        const answer = {
            questionIndex: currentQuestionIndex,
            transcript,
            duration: answerTime
        };

        setAnswers(prev => [...prev, answer]);
        setState(INTERVIEW_STATES.EVALUATING);

        return answer;
    }, [currentQuestionIndex, answerTime]);

    /**
     * Add evaluation for current question and move to next
     */
    const addEvaluation = useCallback((evaluation) => {
        setEvaluations(prev => [...prev, evaluation]);

        // Move to next question or complete
        if (currentQuestionIndex + 1 >= questions.length) {
            setState(INTERVIEW_STATES.COMPLETE);
        } else {
            setCurrentQuestionIndex(prev => prev + 1);
            setState(INTERVIEW_STATES.READY);
        }
    }, [currentQuestionIndex, questions.length]);

    /**
     * Skip current question
     */
    const skipQuestion = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        stopSpeaking();

        // Add empty answer and evaluation
        setAnswers(prev => [...prev, {
            questionIndex: currentQuestionIndex,
            transcript: '[Skipped]',
            duration: 0
        }]);
        setEvaluations(prev => [...prev, {
            score: 0,
            feedback: 'Question was skipped',
            skipped: true
        }]);

        if (currentQuestionIndex + 1 >= questions.length) {
            setState(INTERVIEW_STATES.COMPLETE);
        } else {
            setCurrentQuestionIndex(prev => prev + 1);
            setState(INTERVIEW_STATES.READY);
        }
    }, [currentQuestionIndex, questions.length, stopSpeaking]);

    /**
     * End interview early
     */
    const endInterview = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        stopSpeaking();
        setState(INTERVIEW_STATES.COMPLETE);
    }, [stopSpeaking]);

    /**
     * Reset interview
     */
    const resetInterview = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        stopSpeaking();
        setState(INTERVIEW_STATES.IDLE);
        setQuestions([]);
        setCurrentQuestionIndex(0);
        setAnswers([]);
        setEvaluations([]);
        setAnswerTime(0);
    }, [stopSpeaking]);

    /**
     * Get current question
     */
    const currentQuestion = questions[currentQuestionIndex] || null;

    /**
     * Calculate overall results
     */
    const getResults = useCallback(() => {
        const answeredEvaluations = evaluations.filter(e => !e.skipped);
        const avgScore = answeredEvaluations.length > 0
            ? answeredEvaluations.reduce((sum, e) => sum + (e.score || 0), 0) / answeredEvaluations.length
            : 0;

        return {
            totalQuestions: questions.length,
            answered: answers.filter(a => a.transcript !== '[Skipped]').length,
            skipped: answers.filter(a => a.transcript === '[Skipped]').length,
            averageScore: Math.round(avgScore * 10) / 10,
            questions,
            answers,
            evaluations
        };
    }, [questions, answers, evaluations]);

    return {
        // State
        state,
        setState,
        config,
        setConfig,

        // Questions
        questions,
        currentQuestion,
        currentQuestionIndex,

        // Answers & Evaluations
        answers,
        evaluations,
        answerTime,

        // Speech
        isSpeaking,
        speak,
        stopSpeaking,

        // Actions
        startInterview,
        askCurrentQuestion,
        submitAnswer,
        addEvaluation,
        skipQuestion,
        endInterview,
        resetInterview,
        getResults
    };
}

export default useInterview;
