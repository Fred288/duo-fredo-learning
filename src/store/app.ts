import { create } from 'zustand';

export type Screen =
  { name: 'home' } | { name: 'settings' } | { name: 'lesson'; unitId: string; lessonId: string };

interface AppState {
  screen: Screen;
  openLesson: (unitId: string, lessonId: string) => void;
  openSettings: () => void;
  goHome: () => void;
}

// Einstellungen und Fortschritt liegen in eigenen, persistenten Stores (settings.ts, progress.ts).
export const useApp = create<AppState>((set) => ({
  screen: { name: 'home' },
  openLesson: (unitId, lessonId) => set({ screen: { name: 'lesson', unitId, lessonId } }),
  openSettings: () => set({ screen: { name: 'settings' } }),
  goHome: () => set({ screen: { name: 'home' } }),
}));
