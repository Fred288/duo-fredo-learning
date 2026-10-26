import { create } from 'zustand';

export type Screen =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'review' }
  | { name: 'mistakes' }
  | { name: 'repeat' }
  | { name: 'explainer'; unitId: string }
  | { name: 'lesson'; unitId: string; lessonId: string };

interface AppState {
  screen: Screen;
  openLesson: (unitId: string, lessonId: string) => void;
  openSettings: () => void;
  openReview: () => void;
  openMistakes: () => void;
  openRepeat: () => void;
  openExplainer: (unitId: string) => void;
  goHome: () => void;
}

// Einstellungen und Fortschritt liegen in eigenen, persistenten Stores (settings.ts, progress.ts).
export const useApp = create<AppState>((set) => ({
  screen: { name: 'home' },
  openLesson: (unitId, lessonId) => set({ screen: { name: 'lesson', unitId, lessonId } }),
  openSettings: () => set({ screen: { name: 'settings' } }),
  openReview: () => set({ screen: { name: 'review' } }),
  openMistakes: () => set({ screen: { name: 'mistakes' } }),
  openRepeat: () => set({ screen: { name: 'repeat' } }),
  openExplainer: (unitId) => set({ screen: { name: 'explainer', unitId } }),
  goHome: () => set({ screen: { name: 'home' } }),
}));
