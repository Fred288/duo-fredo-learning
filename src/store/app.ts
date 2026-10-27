import { create } from 'zustand';

export type Screen =
  | { name: 'home' }
  | { name: 'settings' }
  | { name: 'review' }
  | { name: 'mistakes' }
  | { name: 'repeat' }
  | { name: 'lookup' }
  | { name: 'explainer'; unitId: string; section?: string; from?: 'lookup' }
  | { name: 'lesson'; unitId: string; lessonId: string };

interface AppState {
  screen: Screen;
  openLesson: (unitId: string, lessonId: string) => void;
  openSettings: () => void;
  openReview: () => void;
  openMistakes: () => void;
  openRepeat: () => void;
  openExplainer: (unitId: string, opts?: { section?: string; from?: 'lookup' }) => void;
  openLookup: () => void;
  /** Suchtext und geöffneter Eintrag bleiben erhalten, wenn man aus einer Erklärkarte zurückkehrt. */
  lookupQuery: string;
  lookupEntry?: string;
  setLookup: (query: string, entry?: string) => void;
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
  openExplainer: (unitId, opts) => set({ screen: { name: 'explainer', unitId, ...opts } }),
  openLookup: () => set({ screen: { name: 'lookup' } }),
  lookupQuery: '',
  lookupEntry: undefined,
  setLookup: (lookupQuery, lookupEntry) => set({ lookupQuery, lookupEntry }),
  goHome: () => set({ screen: { name: 'home' } }),
}));
