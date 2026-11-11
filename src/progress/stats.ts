import type { Verdict } from '../lib/answer';
import { addDays, daysInMonth, monthStart, weekStart } from './day';

export interface Attempt {
  exerciseId: string;
  lessonId: string;
  verdict: Verdict;
  at: number;
  /**
   * Weiterer falscher Versuch im selben Lauf (die Übung kam nach einem Fehler wieder). Zählt nur
   * in die Fehlerzahl, nicht als erster Versuch: Trefferquote und „Fehler wiederholen“ sehen ihn nicht.
   */
  retry?: true;
}

/** Erste Versuche je Lauf (ohne die Fehlversuche bei der Wiederholung im selben Lauf). */
export const firstAttempts = (attempts: readonly Attempt[]): Attempt[] =>
  attempts.filter((a) => !a.retry);

/** Übungen, deren letzter Versuch falsch war, ältester Fehler zuerst. "Fast richtig" zählt als gelöst. */
export function openMistakes(attempts: readonly Attempt[]): Attempt[] {
  const last = new Map<string, Attempt>();
  for (const a of firstAttempts(attempts).sort((x, y) => x.at - y.at)) last.set(a.exerciseId, a);
  return [...last.values()].filter((a) => a.verdict === 'wrong').sort((x, y) => x.at - y.at);
}

/** Alle falschen Antworten je Übung, auch die Wiederholungen im selben Lauf und „Weiß ich nicht“. */
export function missCounts(attempts: readonly Attempt[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of attempts) {
    if (a.verdict === 'wrong') out.set(a.exerciseId, (out.get(a.exerciseId) ?? 0) + 1);
  }
  return out;
}

export interface FrequentMistake {
  exerciseId: string;
  /** Lektion des jüngsten Versuchs. */
  lessonId: string;
  misses: number;
  /** Zeitpunkt des jüngsten Fehlers. */
  lastWrong: number;
}

/**
 * Jemals falsch beantwortete Übungen, häufigste zuerst, auch schon behobene. Gleichstand: jüngster
 * Fehler zuerst, dann ID.
 */
export function frequentMistakes(attempts: readonly Attempt[]): FrequentMistake[] {
  const out = new Map<string, FrequentMistake>();
  for (const a of [...attempts].sort((x, y) => x.at - y.at)) {
    const m = out.get(a.exerciseId);
    if (a.verdict !== 'wrong') {
      if (m) m.lessonId = a.lessonId;
      continue;
    }
    out.set(a.exerciseId, {
      exerciseId: a.exerciseId,
      lessonId: a.lessonId,
      misses: (m?.misses ?? 0) + 1,
      lastWrong: a.at,
    });
  }
  return [...out.values()].sort(
    (x, y) =>
      y.misses - x.misses || y.lastWrong - x.lastWrong || x.exerciseId.localeCompare(y.exerciseId),
  );
}

/** a1-u03-l2 → a1-u03; ebenso erzeugte Lektionen (-h1, -z1, -s1) und Lesetexte (-r1). */
export const unitOfLesson = (lessonId: string): string => lessonId.replace(/-[a-z]\d+$/, '');

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

/**
 * Serie mit übernommenem Startwert: `carry` gilt bis einschließlich `carryDay`, eigene Tage danach
 * zählen oben drauf. Fehlt ein Tag dazwischen, fällt der Startwert weg.
 */
export function carriedStreak(
  days: ReadonlySet<string>,
  today: string,
  carry: number,
  carryDay: string,
): number {
  if (carry <= 0 || !carryDay) return streak(days, today);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let count = 0;
  while (cursor > carryDay && days.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return cursor <= carryDay ? carry + count : streak(days, today);
}

export const activeDays = (completions: readonly Completion[]): Set<string> =>
  new Set(completions.map((c) => c.day));

export const lessonsOnDay = (completions: readonly Completion[], day: string): number =>
  completions.filter((c) => c.day === day).length;

/** Lektionen von `from` bis einschließlich `to` (Tagesschlüssel sind lexikalisch sortierbar). */
export const lessonsBetween = (
  completions: readonly Completion[],
  from: string,
  to: string,
): number => completions.filter((c) => c.day >= from && c.day <= to).length;

export interface GoalProgress {
  done: number;
  goal: number;
}

/**
 * Wochen- und Monatsziel, abgeleitet aus dem Tagesziel (Nutzerentscheidung): Woche = Tagesziel × 7
 * (Montag bis Sonntag), Monat = Tagesziel × Tage des Monats. Gezählt werden Lektionen bis heute.
 */
export function periodGoals(
  completions: readonly Completion[],
  today: string,
  dailyGoal: number,
): { week: GoalProgress; month: GoalProgress } {
  return {
    week: { done: lessonsBetween(completions, weekStart(today), today), goal: dailyGoal * 7 },
    month: {
      done: lessonsBetween(completions, monthStart(today), today),
      goal: dailyGoal * daysInMonth(today),
    },
  };
}

export const completedLessonIds = (completions: readonly Completion[]): Set<string> =>
  new Set(completions.map((c) => c.lessonId));

/** Lektionen, die zum Unit-Fortschritt zählen: Hören ist optional und hängt am Gerät (Stimme). */
export const progressLessons = <L extends { type: string }>(lessons: readonly L[]): L[] =>
  lessons.filter((l) => l.type !== 'listening');

export function unitProgress(
  lessonIds: readonly string[],
  completed: ReadonlySet<string>,
): { done: number; total: number } {
  return { done: lessonIds.filter((id) => completed.has(id)).length, total: lessonIds.length };
}
