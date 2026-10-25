import { create } from 'zustand';

export type Screen = { name: 'home' } | { name: 'lesson'; unitId: string; lessonId: string };

interface AppState {
  screen: Screen;
  tolerateDiacritics: boolean;
  openLesson: (unitId: string, lessonId: string) => void;
  goHome: () => void;
}

// Persistenz der Einstellungen folgt mit Dexie (M6).
export const useApp = create<AppState>((set) => ({
  screen: { name: 'home' },
  tolerateDiacritics: true,
  openLesson: (unitId, lessonId) => set({ screen: { name: 'lesson', unitId, lessonId } }),
  goHome: () => set({ screen: { name: 'home' } }),
}));
