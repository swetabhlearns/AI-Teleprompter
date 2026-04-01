import { create } from 'zustand';
import { buildInterviewReplayTurns } from '../utils/interviewArchive';

export const INTERVIEW_STORE_INITIAL_CONFIG = {
  college: '',
  interviewType: 'general',
  interviewMode: import.meta.env.VITE_GEMINI_API_KEY ? 'live' : 'groq',
  duration: 10,
  profile: {
    name: '',
    background: '',
    workExperience: '',
    education: '',
    hobbies: '',
    whyMba: ''
  }
};

const INITIAL_STATE = {
  state: 'idle',
  questions: [],
  currentQuestionIndex: 0,
  answers: [],
  evaluations: [],
  error: '',
  config: INTERVIEW_STORE_INITIAL_CONFIG,
  answerTime: 0
};

export const useInterviewStore = create((set, get) => ({
  ...INITIAL_STATE,
  setState: (state) => set({ state }),
  setConfig: (nextConfig) => set((current) => ({
    config: typeof nextConfig === 'function'
      ? nextConfig(current.config)
      : nextConfig
  })),
  setQuestions: (questions) => set({ questions }),
  setCurrentQuestionIndex: (currentQuestionIndex) => set({ currentQuestionIndex }),
  setAnswers: (answers) => set({ answers }),
  setEvaluations: (evaluations) => set({ evaluations }),
  setError: (error) => set({ error }),
  setAnswerTime: (answerTime) => set((current) => ({
    answerTime: typeof answerTime === 'function'
      ? answerTime(current.answerTime)
      : answerTime
  })),
  startInterview: (generatedQuestions = []) => set({
    error: '',
    questions: generatedQuestions,
    currentQuestionIndex: 0,
    answers: [],
    evaluations: [],
    answerTime: 0,
    state: 'ready'
  }),
  failInterview: (message) => set({
    error: message || 'Interview failed',
    state: 'error'
  }),
  submitAnswer: (transcript) => {
    const { currentQuestionIndex, answerTime, answers } = get();
    const nextAnswer = {
      questionIndex: currentQuestionIndex,
      transcript,
      duration: answerTime
    };

    set({
      answers: [...answers, nextAnswer],
      state: 'processing'
    });

    return nextAnswer;
  },
  recordLiveAnswer: (transcript, options = {}) => {
    const { currentQuestionIndex, answerTime, answers } = get();
    const nextAnswer = {
      questionIndex: currentQuestionIndex,
      transcript,
      duration: Number.isFinite(Number(options.duration)) ? Number(options.duration) : answerTime
    };

    set({
      answers: [...answers, nextAnswer],
      state: options.keepListening === false ? 'ready' : 'listening'
    });

    return nextAnswer;
  },
  addEvaluation: (evaluation) => set((current) => {
    const evaluations = [...current.evaluations, evaluation];

    if (current.config.interviewMode === 'live') {
      return {
        evaluations,
        state: 'listening'
      };
    }

    if (current.currentQuestionIndex + 1 >= current.questions.length) {
      return {
        evaluations,
        state: 'complete'
      };
    }

    return {
      evaluations,
      currentQuestionIndex: current.currentQuestionIndex + 1,
      state: 'ready'
    };
  }),
  skipQuestion: () => set((current) => {
    const answers = [...current.answers, {
      questionIndex: current.currentQuestionIndex,
      transcript: '[Skipped]',
      duration: 0
    }];

    const evaluations = [...current.evaluations, {
      score: 0,
      skipped: true
    }];

    if (current.currentQuestionIndex + 1 >= current.questions.length) {
      return {
        answers,
        evaluations,
        state: 'complete'
      };
    }

    return {
      answers,
      evaluations,
      currentQuestionIndex: current.currentQuestionIndex + 1,
      state: 'ready'
    };
  }),
  endInterview: () => set({ state: 'complete' }),
  resetInterview: () => set(INITIAL_STATE),
  getCurrentQuestion: () => {
    const { questions, currentQuestionIndex } = get();
    return questions[currentQuestionIndex] || null;
  },
  getResults: () => {
    const { config, questions, answers, evaluations } = get();
    const answeredEvaluations = evaluations.filter((evaluation) => !evaluation.skipped);
    const avgScore = answeredEvaluations.length > 0
      ? answeredEvaluations.reduce((sum, evaluation) => sum + (evaluation.score || 0), 0) / answeredEvaluations.length
      : 0;
    const turns = buildInterviewReplayTurns({
      questions,
      answers,
      evaluations
    });

    return {
      totalQuestions: questions.length,
      answered: answers.filter((answer) => answer.transcript !== '[Skipped]').length,
      skipped: answers.filter((answer) => answer.transcript === '[Skipped]').length,
      averageScore: Math.round(avgScore * 10) / 10,
      mode: config.interviewMode || 'groq',
      questions,
      answers,
      evaluations,
      turns,
      sessionSummary: {
        turnCount: turns.length,
        firstPromptPreview: turns[0]?.assistantText || questions[0]?.text || '',
        lastPromptPreview: turns[turns.length - 1]?.assistantText || answers[answers.length - 1]?.transcript || ''
      }
    };
  }
}));
