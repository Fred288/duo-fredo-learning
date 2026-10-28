import { create } from 'zustand';
import { db, safely } from '../db/db';

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  tolerateDiacritics: boolean;
  /** Ziel: abgeschlossene Lektionen pro Tag. */
  dailyGoal: number;
  /** Neue Wörter pro Tag im Wiederholen; 0 = keine neuen, schon eingeführte bleiben fällig. */
  newWordsPerDay: number;
  showStreak: boolean;
  theme: Theme;
  /** Türkisch vorlesen (Knöpfe, Hörübungen). */
  audioEnabled: boolean;
  /** Türkische Prompts und Lösungen von selbst vorlesen. */
  autoplay: boolean;
  /** Gewählte Stimme; '' = automatisch. */
  voiceURI: string;
  /** Nachsprechen: Mikrofon-Knopf neben Lesetext-Sätzen und Nachschlage-Einträgen. */
  shadowing: boolean;
  /** Tag der letzten gespeicherten Sicherung, 'YYYY-MM-DD'; '' = noch nie. */
  lastBackup: string;
}

export const DEFAULT_SETTINGS: Settings = {
  tolerateDiacritics: true,
  dailyGoal: 1,
  newWordsPerDay: 10,
  showStreak: true,
  theme: 'system',
  audioEnabled: true,
  autoplay: false,
  voiceURI: '',
  shadowing: true,
  lastBackup: '',
};

export const GOAL_RANGE = { min: 1, max: 10 } as const;
export const NEW_WORDS_RANGE = { min: 0, max: 30 } as const;

interface SettingsState extends Settings {
  loaded: boolean;
  load: () => Promise<void>;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

/** Setzt die Klasse `dark` auf <html>; `system` folgt der Systemeinstellung. */
export function applyTheme(theme: Theme): void {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export const useSettings = create<SettingsState>((set) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    const rows = await safely(() => db.settings.toArray(), []);
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Partial<Settings>;
    const merged = { ...DEFAULT_SETTINGS, ...pickKnown(stored) };
    applyTheme(merged.theme);
    set({ ...merged, loaded: true });
  },
  set: (key, value) => {
    set({ [key]: value } as Partial<Settings>);
    if (key === 'theme') applyTheme(value as Theme);
    void safely(() => db.settings.put({ key, value }), undefined);
  },
}));

/** Übernimmt nur bekannte Schlüssel mit passendem Typ (robust gegen alte/kaputte Daten). */
export function pickKnown(stored: Partial<Settings>): Partial<Settings> {
  const out: Partial<Settings> = {};
  if (typeof stored.tolerateDiacritics === 'boolean')
    out.tolerateDiacritics = stored.tolerateDiacritics;
  if (typeof stored.showStreak === 'boolean') out.showStreak = stored.showStreak;
  if (typeof stored.audioEnabled === 'boolean') out.audioEnabled = stored.audioEnabled;
  if (typeof stored.autoplay === 'boolean') out.autoplay = stored.autoplay;
  if (typeof stored.shadowing === 'boolean') out.shadowing = stored.shadowing;
  if (typeof stored.voiceURI === 'string') out.voiceURI = stored.voiceURI;
  if (typeof stored.lastBackup === 'string' && /^(\d{4}-\d{2}-\d{2})?$/.test(stored.lastBackup)) {
    out.lastBackup = stored.lastBackup;
  }
  if (
    typeof stored.dailyGoal === 'number' &&
    stored.dailyGoal >= GOAL_RANGE.min &&
    stored.dailyGoal <= GOAL_RANGE.max
  ) {
    out.dailyGoal = Math.round(stored.dailyGoal);
  }
  if (
    typeof stored.newWordsPerDay === 'number' &&
    stored.newWordsPerDay >= NEW_WORDS_RANGE.min &&
    stored.newWordsPerDay <= NEW_WORDS_RANGE.max
  ) {
    out.newWordsPerDay = Math.round(stored.newWordsPerDay);
  }
  if (stored.theme === 'system' || stored.theme === 'light' || stored.theme === 'dark') {
    out.theme = stored.theme;
  }
  return out;
}
