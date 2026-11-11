import type { Exercise } from '../content/schema';
import type { AnswerResult, Verdict } from '../lib/answer';

// Reine Sitzungslogik einer Lektion, unabhängig von React.
export interface Session {
  queue: Exercise[];
  index: number;
  phase: 'answering' | 'feedback' | 'done';
  last?: AnswerResult;
  /** Die letzte Antwort war „Weiß ich nicht“ (zählt als falsch). */
  gaveUp?: boolean;
  /** Bewertung beim ersten Versuch je Übungs-ID. */
  firstTry: Record<string, Verdict>;
  /** Falsche Antworten je Übungs-ID in diesem Lauf (auch die Wiederholungen). */
  misses: Record<string, number>;
}

export function createSession(exercises: Exercise[]): Session {
  return {
    queue: exercises,
    index: 0,
    phase: exercises.length ? 'answering' : 'done',
    firstTry: {},
    misses: {},
  };
}

export const currentExercise = (s: Session): Exercise | undefined => s.queue[s.index];

/** Ergebnis von „Weiß ich nicht“: falsch, ohne Hinweise. */
export const GAVE_UP: AnswerResult = { verdict: 'wrong', hints: [] };

/**
 * Bewertet die aktuelle Übung. Falsch beantwortete Übungen (auch „Weiß ich nicht“) kommen ans Ende
 * der Warteschlange, bis sie einmal richtig oder fast richtig beantwortet sind.
 */
export function submit(
  s: Session,
  result: AnswerResult,
  { gaveUp = false }: { gaveUp?: boolean } = {},
): Session {
  const ex = currentExercise(s);
  if (!ex || s.phase !== 'answering') return s;
  const firstTry = ex.id in s.firstTry ? s.firstTry : { ...s.firstTry, [ex.id]: result.verdict };
  const wrong = result.verdict === 'wrong';
  return {
    ...s,
    phase: 'feedback',
    last: result,
    gaveUp,
    firstTry,
    misses: wrong ? { ...s.misses, [ex.id]: (s.misses[ex.id] ?? 0) + 1 } : s.misses,
    queue: wrong ? [...s.queue, ex] : s.queue,
  };
}

export function next(s: Session): Session {
  if (s.phase !== 'feedback') return s;
  const index = s.index + 1;
  return {
    ...s,
    index,
    last: undefined,
    gaveUp: false,
    phase: index >= s.queue.length ? 'done' : 'answering',
  };
}

/**
 * Überspringt die aktuelle Übung ohne Bewertung (Hörübung, gerade kein Ton möglich), mit `sameType`
 * auch alle folgenden desselben Typs. Kein Versuch, also auch keine SRS-Karte.
 */
export function skip(s: Session, { sameType = false }: { sameType?: boolean } = {}): Session {
  const ex = currentExercise(s);
  if (!ex || s.phase !== 'answering') return s;
  const rest = s.queue
    .slice(s.index)
    .filter((e) => e.id !== ex.id && !(sameType && e.type === ex.type));
  const queue = [...s.queue.slice(0, s.index), ...rest];
  return { ...s, queue, phase: s.index >= queue.length ? 'done' : 'answering' };
}

/** "Fast richtig" zählt als geschafft; nur echte Fehler werden wiederholt. */
export function summary(s: Session): { correct: number; total: number } {
  const verdicts = Object.values(s.firstTry);
  return { correct: verdicts.filter((v) => v !== 'wrong').length, total: verdicts.length };
}
