import { addDays } from './day';

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
