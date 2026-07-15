import { create } from 'zustand';

export const useInterviewUiStore = create((set) => ({
  interviewMode: 'live',
  archivePreviewSession: null,
  setInterviewMode: (interviewMode) => set({ interviewMode }),
  setArchivePreviewSession: (archivePreviewSession) => set({ archivePreviewSession }),
  resetInterviewUi: () => set({
    interviewMode: 'live',
    archivePreviewSession: null,
  })
}));
