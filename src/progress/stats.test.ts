import { describe, expect, it } from 'vitest';
import { addDays, dayKey } from './day';
import {
  activeDays,
  completedLessonIds,
  lessonsOnDay,
  openMistakes,
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
  });

  it('Hörlektionen zählen nicht zum Unit-Fortschritt', () => {
    const lessons = [
      { id: 'a1-u03-l1', type: 'vocab' },
      { id: 'a1-u03-h1', type: 'listening' },
    ];
    expect(progressLessons(lessons).map((l) => l.id)).toEqual(['a1-u03-l1']);
  });
});
