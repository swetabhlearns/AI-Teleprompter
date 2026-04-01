import { create } from 'zustand';

export const useAppStore = create((set) => ({
  activeRoute: '/script',
  shellReady: false,
  setActiveRoute: (activeRoute) => set({ activeRoute }),
  setShellReady: (shellReady) => set({ shellReady })
}));

