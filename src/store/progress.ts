import { create } from 'zustand';
import { db, safely } from '../db/db';
import type { Exercise } from '../content/schema';
import type { Verdict } from '../lib/answer';
import type { Placement } from '../placement/record';
import { dayKey } from '../progress/day';
import type { Attempt, Completion } from '../progress/stats';
import { cardId, tracks, unitOfExercise, type Card, type CardRef } from '../srs/card';
import { leitner } from '../srs/leitner';
import { record } from '../srs/scheduler';

/** Lektions- und Unit-ID der Wiederholungsdurchgänge; zählt als Lektion für Tagesziel und Serie. */
export const REVIEW_ID = 'srs';

interface ProgressState {
  completions: Completion[];
  /** Erste Versuche je Lauf, Grundlage für "Fehler wiederholen". */
  attempts: Attempt[];
  /** SRS-Karten (Übungen und Vokabeln). */
  cards: Card[];
  /** Angenommene Einstufungen (Protokoll); gültig ist die jüngste (`currentPlacement`). */
  placements: Placement[];
  loaded: boolean;
  load: () => Promise<void>;
  /** Verwirft den Speicherstand und lädt neu aus IndexedDB (nach einem Import). */
  reload: () => Promise<void>;
  /** Protokolliert den Versuch und führt die zugehörige Übungskarte fort. */
  recordAttempt: (
    exerciseId: string,
    lessonId: string,
    verdict: Verdict,
    type?: Exercise['type'],
  ) => void;
  /** Bewertet eine Vokabelkarte; legt sie beim ersten Mal an. */
  recordVocab: (ref: CardRef, unitId: string, verdict: Verdict) => void;
  /** Entfernt Karten, deren Inhalt es nicht mehr gibt. */
  removeCards: (ids: readonly string[]) => void;
  /** Speichert geänderte Karten (z. B. Vokabel in andere Unit gewandert). */
  putCards: (cards: readonly Card[]) => void;
  recordCompletion: (unitId: string, lessonId: string, correct: number, total: number) => void;
  /** Speichert eine angenommene (oder zurückgenommene) Einstufung. */
  recordPlacement: (placement: Placement) => void;
}

const upsertCard = (cards: Card[], card: Card): Card[] =>
  cards.some((c) => c.id === card.id)
    ? cards.map((c) => (c.id === card.id ? card : c))
    : [...cards, card];

/**
 * Läuft gerade `load()`, warten Schreibzugriffe darauf: Sonst bewertet `review` gegen noch nicht
 * geladene Karten und überschreibt den gespeicherten Stand, oder ein früher Eintrag steht nach
 * dem Laden doppelt im Speicher. Ohne laufendes Laden laufen sie sofort (synchron).
 */
let loading: Promise<void> | undefined;

/** Auto-ID der Tabelle gehört nicht in den Store (wie bei Sicherungen gerätelokal). */
const stripId = ({ at, startUnit, skipped, shaky }: Placement): Placement => ({
  at,
  startUnit,
  skipped,
  shaky,
});
const whenReady = (fn: () => void) => (loading ? void loading.then(fn) : fn());

export const useProgress = create<ProgressState>((set, get) => {
  /** Schreibt die Karte nach der Bewertung fort und speichert sie. */
  const review = (ref: CardRef, unitId: string, verdict: Verdict) => {
    const now = Date.now();
    const existing = get().cards.find((c) => c.id === cardId(ref));
    const card = record(leitner, existing, { ref, unitId }, verdict, dayKey(new Date(now)), now);
    set((s) => ({ cards: upsertCard(s.cards, card) }));
    void safely(() => db.cards.put({ ...card }), undefined);
  };

  return {
    completions: [],
    attempts: [],
    cards: [],
    placements: [],
    loaded: false,
    load: () => {
      if (loading) return loading;
      if (get().loaded) return Promise.resolve();
      const run = async () => {
        const [rows, attempts, cards, placements] = await Promise.all([
          safely(() => db.completions.toArray(), []),
          safely(() => db.attempts.toArray(), []),
          safely(() => db.cards.toArray(), []),
          safely(() => db.placements.toArray(), []),
        ]);
        // Lokal schon erfasste Einträge (vor dem Laden) bleiben erhalten.
        set((s) => ({
          completions: [...rows, ...s.completions],
          attempts: [...attempts, ...s.attempts],
          cards: s.cards.reduce(upsertCard, cards),
          placements: [...placements.map(stripId), ...s.placements],
          loaded: true,
        }));
      };
      const pending = run().finally(() => {
        if (loading === pending) loading = undefined;
      });
      loading = pending;
      return pending;
    },
    reload: async () => {
      await loading;
      set({ completions: [], attempts: [], cards: [], placements: [], loaded: false });
      await get().load();
    },
    recordAttempt: (exerciseId, lessonId, verdict, type) =>
      whenReady(() => {
        const attempt: Attempt = { exerciseId, lessonId, verdict, at: Date.now() };
        set((s) => ({ attempts: [...s.attempts, attempt] }));
        void safely(() => db.attempts.add({ ...attempt }), 0);

        const ref: CardRef = { kind: 'exercise', exerciseId };
        const unitId = unitOfExercise(exerciseId);
        const hasCard = get().cards.some((c) => c.id === cardId(ref));
        if (unitId && tracks(type, verdict, hasCard)) review(ref, unitId, verdict);
      }),
    recordVocab: (ref, unitId, verdict) => whenReady(() => review(ref, unitId, verdict)),
    removeCards: (ids) =>
      whenReady(() => {
        if (!ids.length) return;
        const gone = new Set(ids);
        set((s) => ({ cards: s.cards.filter((c) => !gone.has(c.id)) }));
        void safely(() => db.cards.bulkDelete([...gone]), undefined);
      }),
    putCards: (changed) =>
      whenReady(() => {
        if (!changed.length) return;
        set((s) => ({ cards: changed.reduce(upsertCard, s.cards) }));
        void safely(() => db.cards.bulkPut(changed.map((c) => ({ ...c }))), undefined);
      }),
    recordCompletion: (unitId, lessonId, correct, total) =>
      whenReady(() => {
        const now = new Date();
        const completion: Completion = {
          lessonId,
          unitId,
          correct,
          total,
          at: now.getTime(),
          day: dayKey(now),
        };
        set((s) => ({ completions: [...s.completions, completion] }));
        void safely(() => db.completions.add({ ...completion }), 0);
      }),
    recordPlacement: (placement) =>
      whenReady(() => {
        const row: Placement = {
          ...placement,
          skipped: [...placement.skipped],
          shaky: [...placement.shaky],
        };
        set((s) => ({ placements: [...s.placements, row] }));
        void safely(() => db.placements.add({ ...row }), 0);
      }),
  };
});
