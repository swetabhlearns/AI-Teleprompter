import { create } from 'zustand';

export const useInterviewUiStore = create((set) => ({
  interviewMode: import.meta.env.VITE_GEMINI_API_KEY ? 'live' : 'groq',
  archivePreviewSession: null,
  setInterviewMode: (interviewMode) => set({ interviewMode }),
  setArchivePreviewSession: (archivePreviewSession) => set({ archivePreviewSession }),
  resetInterviewUi: () => set({
    interviewMode: import.meta.env.VITE_GEMINI_API_KEY ? 'live' : 'groq',
    archivePreviewSession: null,
  })
}));
