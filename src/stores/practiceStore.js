import { create } from 'zustand';

export const usePracticeStore = create((set) => ({
  isPracticing: false,
  practiceSpeed: 20,
  practiceSessionKey: 0,
  setIsPracticing: (isPracticing) => set({ isPracticing }),
  setPracticeSpeed: (practiceSpeed) => set((current) => ({
    practiceSpeed: typeof practiceSpeed === 'function'
      ? practiceSpeed(current.practiceSpeed)
      : practiceSpeed
  })),
  bumpPracticeSessionKey: () => set((state) => ({ practiceSessionKey: state.practiceSessionKey + 1 })),
  resetPractice: () => set({
    isPracticing: false,
    practiceSpeed: 20,
    practiceSessionKey: 0
  })
}));
