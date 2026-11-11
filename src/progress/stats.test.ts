import { describe, expect, it } from 'vitest';
import { addDays, dayKey, daysInMonth, monthStart, weekStart } from './day';
import {
  activeDays,
  carriedStreak,
  completedLessonIds,
  lessonsBetween,
  lessonsOnDay,
  periodGoals,
  openMistakes,
  frequentMistakes,
  missCounts,
  progressLessons,
  unitOfLesson,
  type Attempt,
  streak,
  unitProgress,
  type Completion,
} from './stats';

const c = (lessonId: string, day: string): Completion => ({
  lessonId,
  unitId: lessonId.split('-l')[0]!,
  correct: 1,
  total: 1,
  at: 0,
  day,
});

describe('day', () => {
  it('formatiert lokale Tage', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('rechnet über Monats- und Jahresgrenzen', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30'); // Sommerzeitwechsel
  });
});

describe('streak', () => {
  const days = (...d: string[]) => new Set(d);

  it('zählt aufeinanderfolgende Tage inkl. heute', () => {
    expect(streak(days('2026-02-27', '2026-02-28', '2026-03-01'), '2026-03-01')).toBe(3);
  });
  it('lässt die Serie bestehen, wenn heute noch nichts gelernt wurde', () => {
    expect(streak(days('2026-02-27', '2026-02-28'), '2026-03-01')).toBe(2);
  });
  it('bricht bei einer Lücke von einem vollen Tag ab', () => {
    expect(streak(days('2026-02-26', '2026-02-27'), '2026-03-01')).toBe(0);
  });
  it('zählt nur die zusammenhängende jüngste Serie', () => {
    expect(streak(days('2026-02-20', '2026-02-28', '2026-03-01'), '2026-03-01')).toBe(2);
  });
  it('ist ohne Aktivität 0', () => {
    expect(streak(days(), '2026-03-01')).toBe(0);
  });
});

describe('carriedStreak', () => {
  const days = (...d: string[]) => new Set(d);
  const carryDay = '2026-03-01';

  it('zeigt am Tag der Eingabe den Startwert, auch mit Lektion', () => {
    expect(carriedStreak(days(), carryDay, 472, carryDay)).toBe(472);
    expect(carriedStreak(days(carryDay), carryDay, 472, carryDay)).toBe(472);
  });
  it('zählt eigene Tage oben drauf', () => {
    expect(carriedStreak(days('2026-03-02'), '2026-03-02', 472, carryDay)).toBe(473);
    expect(carriedStreak(days('2026-03-02', '2026-03-03'), '2026-03-03', 472, carryDay)).toBe(474);
  });
  it('bricht nicht an einem noch leeren heutigen Tag', () => {
    expect(carriedStreak(days(), '2026-03-02', 472, carryDay)).toBe(472);
    expect(carriedStreak(days('2026-03-02'), '2026-03-03', 472, carryDay)).toBe(473);
  });
  it('verliert den Startwert nach einem ausgelassenen Tag', () => {
    expect(carriedStreak(days(), '2026-03-03', 472, carryDay)).toBe(0);
    expect(carriedStreak(days('2026-03-03'), '2026-03-03', 472, carryDay)).toBe(1);
    expect(carriedStreak(days('2026-03-02', '2026-03-04'), '2026-03-04', 472, carryDay)).toBe(1);
  });
  it('entspricht ohne Startwert der normalen Serie', () => {
    expect(carriedStreak(days('2026-03-01'), '2026-03-01', 0, '')).toBe(1);
    expect(carriedStreak(days('2026-03-01'), '2026-03-01', 5, '')).toBe(1);
  });
});

describe('Fortschritt', () => {
  const completions = [
    c('a1-u01-l1', '2026-03-01'),
    c('a1-u01-l1', '2026-03-01'),
    c('a1-u02-l1', '2026-03-02'),
  ];

  it('zählt Lektionen pro Tag inkl. Wiederholungen, Aktivtage nur einmal', () => {
    expect(lessonsOnDay(completions, '2026-03-01')).toBe(2);
    expect(activeDays(completions).size).toBe(2);
  });
  it('wertet Lektionen als erledigt, auch bei mehrfachem Abschluss', () => {
    const done = completedLessonIds(completions);
    expect(unitProgress(['a1-u01-l1', 'a1-u01-l2'], done)).toEqual({ done: 1, total: 2 });
  });
});

describe('Fehlerzahl', () => {
  const a = (
    exerciseId: string,
    verdict: Attempt['verdict'],
    at: number,
    retry = false,
  ): Attempt => ({
    exerciseId,
    lessonId: 'a1-u03-l2',
    verdict,
    at,
    ...(retry ? { retry: true as const } : {}),
  });

  it('zählt jede falsche Antwort, auch Wiederholungen im selben Lauf', () => {
    const attempts = [
      a('e1', 'wrong', 1),
      a('e1', 'wrong', 2, true),
      a('e1', 'correct', 3),
      a('e2', 'almost', 4),
    ];
    expect(missCounts(attempts)).toEqual(new Map([['e1', 2]]));
  });

  it('Wiederholungsfehler lösen „Fehler wiederholen“ weder aus noch auf', () => {
    expect(openMistakes([a('e1', 'correct', 1), a('e1', 'wrong', 2, true)])).toEqual([]);
    expect(openMistakes([a('e1', 'wrong', 1), a('e1', 'wrong', 2, true)]).map((m) => m.at)).toEqual(
      [1],
    );
  });

  it('häufigste Fehler: meiste zuerst, auch behobene, Gleichstand jüngster zuerst', () => {
    const attempts = [
      a('e1', 'wrong', 1),
      a('e1', 'correct', 2),
      a('e2', 'wrong', 3),
      a('e2', 'wrong', 4, true),
      a('e3', 'wrong', 5),
      a('e4', 'correct', 6),
    ];
    expect(frequentMistakes(attempts).map((m) => [m.exerciseId, m.misses])).toEqual([
      ['e2', 2],
      ['e3', 1],
      ['e1', 1],
    ]);
  });
});

describe('openMistakes', () => {
  const a = (exerciseId: string, verdict: Attempt['verdict'], at: number): Attempt => ({
    exerciseId,
    lessonId: 'a1-u03-l2',
    verdict,
    at,
  });

  it('liefert Übungen, deren letzter Versuch falsch war, ältester zuerst', () => {
    const attempts = [
      a('e2', 'wrong', 5),
      a('e1', 'wrong', 1),
      a('e1', 'correct', 3), // später gelöst
      a('e3', 'almost', 4), // fast richtig zählt als gelöst
      a('e4', 'correct', 2),
      a('e4', 'wrong', 6), // später wieder falsch
    ];
    expect(openMistakes(attempts).map((m) => m.exerciseId)).toEqual(['e2', 'e4']);
  });

  it('leitet die Unit aus der Lektions-ID ab', () => {
    expect(unitOfLesson('a1-u03-l12')).toBe('a1-u03');
    expect(unitOfLesson('a1-u03-h1')).toBe('a1-u03');
    expect(unitOfLesson('a1-u03-z1')).toBe('a1-u03');
    expect(unitOfLesson('a1-u03-s1')).toBe('a1-u03');
    expect(unitOfLesson('a2-u01-r1')).toBe('a2-u01');
  });

  it('Hörlektionen zählen nicht zum Unit-Fortschritt', () => {
    const lessons = [
      { id: 'a1-u03-l1', type: 'vocab' },
      { id: 'a1-u03-h1', type: 'listening' },
    ];
    expect(progressLessons(lessons).map((l) => l.id)).toEqual(['a1-u03-l1']);
  });
});

describe('Wochen- und Monatsziel', () => {
  it('Woche beginnt am Montag, auch über Monats- und Jahresgrenzen', () => {
    expect(weekStart('2026-11-10')).toBe('2026-11-09'); // Dienstag
    expect(weekStart('2026-11-09')).toBe('2026-11-09'); // Montag
    expect(weekStart('2026-11-15')).toBe('2026-11-09'); // Sonntag
    expect(weekStart('2027-01-01')).toBe('2026-12-28'); // Freitag
    expect(weekStart('2026-03-29')).toBe('2026-03-23'); // Sonntag der Zeitumstellung
  });
  it('kennt Monatsanfang und Monatslänge samt Schaltjahr', () => {
    expect(monthStart('2026-11-10')).toBe('2026-11-01');
    expect(daysInMonth('2026-11-10')).toBe(30);
    expect(daysInMonth('2026-02-01')).toBe(28);
    expect(daysInMonth('2028-02-29')).toBe(29);
    expect(daysInMonth('2026-12-31')).toBe(31);
  });
  it('zählt Lektionen der laufenden Woche und des Monats, Ziele aus dem Tagesziel', () => {
    const completions = [
      c('a1-u01-l1', '2026-10-31'), // Vormonat und Vorwoche
      c('a1-u01-l1', '2026-11-01'), // Sonntag der Vorwoche, aber im Monat
      c('a1-u01-l2', '2026-11-02'), // Montag
      c('a1-u01-l2', '2026-11-02'),
      c('a1-u02-l1', '2026-11-04'),
      c('a1-u02-l2', '2026-11-05'), // nach „heute“, zählt nicht
    ];
    expect(lessonsBetween(completions, '2026-11-02', '2026-11-04')).toBe(3);
    expect(periodGoals(completions, '2026-11-04', 2)).toEqual({
      week: { done: 3, goal: 14 },
      month: { done: 4, goal: 60 },
    });
  });
});
