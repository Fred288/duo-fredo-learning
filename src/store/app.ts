import { create } from 'zustand';

export type Screen =
  | { name: 'today' }
  | { name: 'course' }
  | { name: 'more' }
  | { name: 'settings' }
  | { name: 'review' }
  | { name: 'mistakes' }
  | { name: 'repeat' }
  | { name: 'lookup' }
  | { name: 'stats' }
  | { name: 'placement' }
  | { name: 'explainer'; unitId: string; section?: string; from?: 'lookup' }
  | { name: 'lesson'; unitId: string; lessonId: string };

/** Fokusbereiche: eine Aufgabe nach der anderen, ohne Navigation (Lektion, Wiederholen, Test). */
const FOCUS_SCREENS: ReadonlySet<Screen['name']> = new Set([
  'lesson',
  'repeat',
  'mistakes',
  'placement',
]);
export const isFocusScreen = (screen: Screen): boolean => FOCUS_SCREENS.has(screen.name);

/** Ziel, wenn es keinen Eintrag davor gibt (z. B. Test oder Direktstart). */
export function parentOf(screen: Screen): Screen {
  switch (screen.name) {
    case 'review':
      return { name: 'settings' };
    case 'explainer':
      return screen.from === 'lookup' ? { name: 'lookup' } : { name: 'course' };
    case 'lesson':
      return { name: 'course' };
    default:
      return { name: 'today' };
  }
}

interface AppState {
  screen: Screen;
  openLesson: (unitId: string, lessonId: string) => void;
  openToday: () => void;
  openCourse: () => void;
  openMore: () => void;
  openSettings: () => void;
  openReview: () => void;
  openMistakes: () => void;
  openRepeat: () => void;
  openExplainer: (unitId: string, opts?: { section?: string; from?: 'lookup' }) => void;
  openLookup: () => void;
  openStats: () => void;
  openPlacement: () => void;
  /** Suchtext und geöffneter Eintrag bleiben erhalten, wenn man aus einer Erklärkarte zurückkehrt. */
  lookupQuery: string;
  lookupEntry?: string;
  setLookup: (query: string, entry?: string) => void;
  /** Ein Schritt zurück: zum Eintrag davor, ohne ihn zum fachlichen Elternbildschirm. */
  goBack: () => void;
  /** Zur Startseite „Heute“ (neuer Eintrag). */
  goHome: () => void;
  /** Unit, zu der der Kurs beim nächsten Anzeigen scrollt (nach übernommener Einstufung). */
  focusUnit?: string;
  /** Ersetzt den aktuellen Bildschirm durch den Kurs (Einstufung übernommen) und scrollt zur Unit. */
  goHomeTo: (unitId: string) => void;
  clearFocusUnit: () => void;
}

// --- Verlauf ---------------------------------------------------------------------------------
// Jede Navigation legt einen History-Eintrag an (ohne die URL zu ändern), damit die Zurück-Taste
// des Geräts durch die App geht statt aus ihr heraus. Ein Neuladen beginnt wieder bei „Heute“.

interface Entry {
  sid: string;
  idx: number;
  screen: Screen;
}

const sid = Math.random().toString(36).slice(2);
let idx = 0;
/** Popstate-Ereignisse, die wir selbst auslösen (Zurück rückgängig machen) und überspringen. */
let ignorePops = 0;
const hasHistory = typeof window !== 'undefined' && typeof window.history?.pushState === 'function';

const same = (a: Screen, b: Screen) => JSON.stringify(a) === JSON.stringify(b);

function record(screen: Screen, mode: 'push' | 'replace'): void {
  if (!hasHistory) return;
  if (mode === 'push') idx += 1;
  const entry: Entry = { sid, idx, screen };
  try {
    if (mode === 'push') window.history.pushState(entry, '');
    else window.history.replaceState(entry, '');
  } catch {
    // Verlauf nicht erlaubt (z. B. eingebettet): die App läuft ohne Zurück-Taste weiter.
  }
}

// --- Zurück-Wächter --------------------------------------------------------------------------
// Ein Wächter fängt die Zurück-Taste ab, solange lokaler Zustand offen ist (Wort-Sheet,
// Nachschlage-Eintrag, Abbruch-Rückfrage): erst der schließt sich, die Navigation bleibt stehen.

interface Guard {
  handler: () => void;
}
const guards: Guard[] = [];

/** Meldet einen Wächter an; die Rückgabe meldet ihn wieder ab. */
export function addBackGuard(handler: () => void): () => void {
  const guard: Guard = { handler };
  guards.push(guard);
  return () => {
    const at = guards.indexOf(guard);
    if (at >= 0) guards.splice(at, 1);
  };
}

if (hasHistory) {
  record({ name: 'today' }, 'replace');
  window.addEventListener('popstate', (e) => {
    if (ignorePops > 0) {
      ignorePops -= 1;
      return;
    }
    const state = e.state as Entry | null;
    if (!state || state.sid !== sid) {
      // Eintrag aus einer früheren Sitzung (vor dem Neuladen): neu bei „Heute“ beginnen.
      idx = 0;
      record({ name: 'today' }, 'replace');
      useApp.setState({ screen: { name: 'today' } });
      return;
    }
    const guard = guards[guards.length - 1];
    if (guard && state.idx < idx) {
      // Zurück wurde gedrückt, aber etwas ist offen: Schritt rückgängig machen, Wächter handeln lassen.
      ignorePops += 1;
      window.history.forward();
      guard.handler();
      return;
    }
    idx = state.idx;
    useApp.setState({ screen: state.screen });
  });
}

// Einstellungen und Fortschritt liegen in eigenen, persistenten Stores (settings.ts, progress.ts).
export const useApp = create<AppState>((set, get) => {
  const go = (screen: Screen, extra: Partial<AppState> = {}) => {
    if (!same(get().screen, screen)) record(screen, 'push');
    set({ screen, ...extra });
  };
  return {
    screen: { name: 'today' },
    openLesson: (unitId, lessonId) => go({ name: 'lesson', unitId, lessonId }),
    openToday: () => go({ name: 'today' }),
    openCourse: () => go({ name: 'course' }),
    openMore: () => go({ name: 'more' }),
    openSettings: () => go({ name: 'settings' }),
    openReview: () => go({ name: 'review' }),
    openMistakes: () => go({ name: 'mistakes' }),
    openRepeat: () => go({ name: 'repeat' }),
    openExplainer: (unitId, opts) => go({ name: 'explainer', unitId, ...opts }),
    openLookup: () => go({ name: 'lookup' }),
    openStats: () => go({ name: 'stats' }),
    openPlacement: () => go({ name: 'placement' }),
    lookupQuery: '',
    lookupEntry: undefined,
    setLookup: (lookupQuery, lookupEntry) => set({ lookupQuery, lookupEntry }),
    goBack: () => {
      if (hasHistory && idx > 0) window.history.back();
      else set({ screen: parentOf(get().screen) });
    },
    goHome: () => go({ name: 'today' }, { focusUnit: undefined }),
    focusUnit: undefined,
    goHomeTo: (focusUnit) => {
      const screen: Screen = { name: 'course' };
      record(screen, 'replace');
      set({ screen, focusUnit });
    },
    clearFocusUnit: () => set({ focusUnit: undefined }),
  };
});
