import { create } from 'zustand';
import { db, safely } from '../db/db';
import { markedKeys } from '../flashcards/deck';
import {
  itemKey,
  type DeckCard,
  type Flash,
  type FlashItem,
  type FlashMark,
  type FlashMode,
} from '../flashcards/types';

// Karteikasten: Antworten und Markierungen. Getrennt vom SRS (`useProgress`), verändert keine Karten dort.

interface FlashcardsState {
  flashes: Flash[];
  marks: FlashMark[];
  loaded: boolean;
  load: () => Promise<void>;
  /** Verwirft den Speicherstand und lädt neu (nach einem Import). */
  reload: () => Promise<void>;
  /** Speichert die erste Antwort auf eine Karte in einer Runde. */
  recordFlash: (card: DeckCard, correct: boolean, mode: FlashMode) => void;
  /** Markiert ein Wort/einen Satz oder nimmt die Markierung zurück. */
  setMarked: (item: Pick<FlashItem, 'kind' | 'ref'>, marked: boolean) => void;
}

const stripId = ({ kind, ref, dir, correct, mode, at }: Flash): Flash => ({
  kind,
  ref,
  dir,
  correct,
  mode,
  at,
});

/** Wie in `useProgress`: Schreibzugriffe während `load()` warten, sonst stünden sie doppelt da. */
let loading: Promise<void> | undefined;
const whenReady = (fn: () => void) => (loading ? void loading.then(fn) : fn());

export const useFlashcards = create<FlashcardsState>((set, get) => ({
  flashes: [],
  marks: [],
  loaded: false,
  load: () => {
    if (loading) return loading;
    if (get().loaded) return Promise.resolve();
    const run = async () => {
      const [flashes, marks] = await Promise.all([
        safely(() => db.flashes.toArray(), []),
        safely(() => db.flashMarks.toArray(), []),
      ]);
      set((s) => {
        const byKey = new Map(marks.map((m) => [m.key, m]));
        for (const m of s.marks) byKey.set(m.key, m);
        return {
          flashes: [...flashes.map(stripId), ...s.flashes],
          marks: [...byKey.values()],
          loaded: true,
        };
      });
    };
    const pending = run().finally(() => {
      if (loading === pending) loading = undefined;
    });
    loading = pending;
    return pending;
  },
  reload: async () => {
    await loading;
    set({ flashes: [], marks: [], loaded: false });
    await get().load();
  },
  recordFlash: (card, correct, mode) =>
    whenReady(() => {
      const flash: Flash = {
        kind: card.kind,
        ref: card.ref,
        dir: card.dir,
        correct,
        mode,
        at: Date.now(),
      };
      set((s) => ({ flashes: [...s.flashes, flash] }));
      void safely(() => db.flashes.add({ ...flash }), 0);
    }),
  setMarked: (item, marked) =>
    whenReady(() => {
      const mark: FlashMark = { key: itemKey(item), marked, at: Date.now() };
      set((s) => ({ marks: [...s.marks.filter((m) => m.key !== mark.key), mark] }));
      void safely(() => db.flashMarks.put({ ...mark }), '');
    }),
}));

/** Ist das Wort/der Satz markiert? */
export function useIsMarked(item: Pick<FlashItem, 'kind' | 'ref'>): boolean {
  return useFlashcards((s) => markedKeys(s.marks).has(itemKey(item)));
}
