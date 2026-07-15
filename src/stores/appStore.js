import { create } from 'zustand';

export const useAppStore = create((set) => ({
  activeRoute: '/script',
  shellReady: false,
  workerHealth: 'unknown',
  workerHealthMessage: '',
  workerHealthCheckedAt: null,
  setActiveRoute: (activeRoute) => set({ activeRoute }),
  setShellReady: (shellReady) => set({ shellReady }),
  setWorkerHealth: (workerHealth, workerHealthMessage = '') => set({
    workerHealth,
    workerHealthMessage,
    workerHealthCheckedAt: new Date().toISOString()
  })
}));
