import type { Exercise } from '../content/schema';
import type { AnswerResult, Verdict } from '../lib/answer';

// Reine Sitzungslogik einer Lektion, unabhängig von React.
export interface Session {
  queue: Exercise[];
  index: number;
  phase: 'answering' | 'feedback' | 'done';
  last?: AnswerResult;
  /** Bewertung beim ersten Versuch je Übungs-ID. */
  firstTry: Record<string, Verdict>;
  /** Falsch beantwortete Übungen werden einmal am Ende wiederholt. */
  requeued: string[];
}

export function createSession(exercises: Exercise[]): Session {
  return {
    queue: exercises,
    index: 0,
    phase: exercises.length ? 'answering' : 'done',
    firstTry: {},
    requeued: [],
  };
}

export const currentExercise = (s: Session): Exercise | undefined => s.queue[s.index];

export function submit(s: Session, result: AnswerResult): Session {
  const ex = currentExercise(s);
  if (!ex || s.phase !== 'answering') return s;
  const firstTry = ex.id in s.firstTry ? s.firstTry : { ...s.firstTry, [ex.id]: result.verdict };
  const retry = result.verdict === 'wrong' && !s.requeued.includes(ex.id);
  return {
    ...s,
    phase: 'feedback',
    last: result,
    firstTry,
    queue: retry ? [...s.queue, ex] : s.queue,
    requeued: retry ? [...s.requeued, ex.id] : s.requeued,
  };
}

export function next(s: Session): Session {
  if (s.phase !== 'feedback') return s;
  const index = s.index + 1;
  return { ...s, index, last: undefined, phase: index >= s.queue.length ? 'done' : 'answering' };
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
