import { describe, expect, it } from 'vitest';
import type { Completion } from '../progress/stats';
import { isListeningCard } from '../content/listening';
import { cardId, planRepeat, SESSION_MAX, type Card } from '.';

const units = [
  { id: 'a1-u01', lessons: [{ id: 'a1-u01-l1' }], vocab: ['a', 'b', 'c'] },
  { id: 'a1-u02', lessons: [{ id: 'a1-u02-l1' }], vocab: ['d'] },
];
const done = (lessonId: string): Completion => ({
  lessonId,
  unitId: lessonId.replace(/-l\d+$/, ''),
  correct: 1,
  total: 1,
  at: 0,
  day: '2026-05-01',
});
const exCard = (id: string, due: string): Card => {
  const ref = { kind: 'exercise', exerciseId: id } as const;
  return {
    id: cardId(ref),
    ref,
    unitId: 'a1-u01',
    box: 1,
    due,
    introduced: due,
    lastAt: 0,
    lapses: 0,
  };
};

describe('planRepeat', () => {
  it('ist leer ohne abgeschlossene Lektion und ohne Karten', () => {
    expect(planRepeat(units, [], [], '2026-05-01', 10)).toMatchObject({
      queue: [],
      due: 0,
      fresh: 0,
      gone: [],
      moved: [],
    });
  });

  it('zählt fällige Karten und neue Wörter getrennt', () => {
    const cards = [exCard('a1-u01-l1-e1', '2026-05-01'), exCard('a1-u01-l1-e2', '2026-05-09')];
    const plan = planRepeat(units, [done('a1-u01-l1')], cards, '2026-05-01', 2);
    expect(plan).toMatchObject({ due: 1, fresh: 2 });
    expect(plan.queue).toHaveLength(3);
  });

  it('schaltet Vokabelkarten mit 0 neuen Wörtern ab und begrenzt den Durchgang', () => {
    expect(planRepeat(units, [done('a1-u01-l1')], [], '2026-05-01', 0).fresh).toBe(0);
    const many = Array.from({ length: SESSION_MAX + 5 }, (_, i) =>
      exCard(`a1-u01-l1-e${i}`, '2026-05-01'),
    );
    expect(planRepeat(units, [], many, '2026-05-01', 10).queue).toHaveLength(SESSION_MAX);
  });

  it('skip hält Karten zurück: kein Platz im Durchgang, nicht fällig, nicht verwaist', () => {
    const listen = exCard('a1-u01-h1-l1-e1', '2026-05-01');
    const other = exCard('a1-u01-l1-e1', '2026-05-01');
    const plan = planRepeat(units, [], [listen, other], '2026-05-01', 10, {
      skip: isListeningCard,
    });
    expect(plan.queue.map((e) => cardId(e.ref))).toEqual([other.id]);
    expect(plan).toMatchObject({ due: 1, gone: [] });
    expect(planRepeat(units, [], [listen, other], '2026-05-01', 10).due).toBe(2);
  });
});
