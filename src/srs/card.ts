import type { Exercise } from '../content/schema';
import type { Verdict } from '../lib/answer';

// Karten des Wiederholungssystems. Schlüssel sind die stabilen Inhalts-IDs (Übung, Vokabel).
export type VocabDir = 'tr_de' | 'de_tr';
export type ExerciseRef = { kind: 'exercise'; exerciseId: string };
export type VocabRef = { kind: 'vocab'; vocabId: string; dir: VocabDir };
export type CardRef = ExerciseRef | VocabRef;

export interface Card {
  id: string;
  ref: CardRef;
  unitId: string;
  /** Leitner-Box ab 1. */
  box: number;
  /** Fällig ab diesem lokalen Tag, 'YYYY-MM-DD'. */
  due: string;
  /** Tag der Einführung; begrenzt neue Vokabeln pro Tag. */
  introduced: string;
  lastAt: number;
  /** Wie oft eine schon eingeführte Karte falsch beantwortet wurde. */
  lapses: number;
}

export const cardId = (ref: CardRef): string =>
  ref.kind === 'exercise' ? `ex:${ref.exerciseId}` : `vo:${ref.dir}:${ref.vocabId}`;

/** a1-u03-l2-e5 → a1-u03; undefined bei unbekanntem Format. */
export const unitOfExercise = (exerciseId: string): string | undefined =>
  /^[ab][12]-u\d{2}(?=-)/.exec(exerciseId)?.[0];

/** Grammatikübungen werden immer Karten, alle anderen erst nach einem Fehler. */
export const GRAMMAR_TYPES: readonly Exercise['type'][] = [
  'suffix_builder',
  'conjugation',
  'paradigm',
  'segment',
  'sov_puzzle',
];

/**
 * Soll ein Übungsversuch eine Karte anlegen oder fortschreiben? Ohne Typ (Upgrade aus alten
 * Versuchen) entscheidet nur der Fehler.
 */
export const tracks = (
  type: Exercise['type'] | undefined,
  verdict: Verdict,
  hasCard: boolean,
): boolean => hasCard || verdict === 'wrong' || (!!type && GRAMMAR_TYPES.includes(type));
