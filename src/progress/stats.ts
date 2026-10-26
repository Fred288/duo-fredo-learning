import type { Verdict } from '../lib/answer';
import { addDays } from './day';

export interface Attempt {
  exerciseId: string;
  lessonId: string;
  verdict: Verdict;
  at: number;
}

/** Übungen, deren letzter Versuch falsch war, ältester Fehler zuerst. "Fast richtig" zählt als gelöst. */
export function openMistakes(attempts: readonly Attempt[]): Attempt[] {
  const last = new Map<string, Attempt>();
  for (const a of [...attempts].sort((x, y) => x.at - y.at)) last.set(a.exerciseId, a);
  return [...last.values()].filter((a) => a.verdict === 'wrong').sort((x, y) => x.at - y.at);
}

/** a1-u03-l2 → a1-u03 */
export const unitOfLesson = (lessonId: string): string => lessonId.replace(/-l\d+$/, '');

export interface Completion {
  lessonId: string;
  unitId: string;
  correct: number;
  total: number;
  at: number;
  /** Lokaler Tag, 'YYYY-MM-DD'. */
  day: string;
}

/** Serie aufeinanderfolgender Tage mit Aktivität. Ein noch leerer heutiger Tag bricht sie nicht. */
export function streak(days: ReadonlySet<string>, today: string): number {
  let cursor = days.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (days.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export const activeDays = (completions: readonly Completion[]): Set<string> =>
  new Set(completions.map((c) => c.day));

export const lessonsOnDay = (completions: readonly Completion[], day: string): number =>
  completions.filter((c) => c.day === day).length;

export const completedLessonIds = (completions: readonly Completion[]): Set<string> =>
  new Set(completions.map((c) => c.lessonId));

export function unitProgress(
  lessonIds: readonly string[],
  completed: ReadonlySet<string>,
): { done: number; total: number } {
  return { done: lessonIds.filter((id) => completed.has(id)).length, total: lessonIds.length };
}
