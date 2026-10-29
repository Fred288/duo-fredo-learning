import { describe, expect, it } from 'vitest';
import type { Exercise, Level, Unit } from '../content/schema';
import { fnv1a } from '../lib/hash';
import {
  allowedMisses,
  answer,
  currentItem,
  recommend,
  selectPlacement,
  startPlacement,
  type Outcome,
  type PlacementPlan,
  type PlacementState,
} from '.';

const mc = (id: string): Exercise => ({
  id,
  type: 'multiple_choice',
  prompt: 'Welche Form?',
  options: ['evde', 'evda'],
  answer: 'evde',
});
const free = (id: string): Exercise => ({
  id,
  type: 'free_text',
  direction: 'de_tr',
  prompt: 'im Haus',
  answers: ['evde'],
});
const bank = (id: string): Exercise => ({
  id,
  type: 'word_bank',
  prompt: 'Ich bin zu Hause.',
  answers: ['Evdeyim.'],
});
const paradigm = (id: string): Exercise =>
  ({ id, type: 'paradigm', kind: 'noun', stem: 'ev', rows: [['LOC']] }) as unknown as Exercise;

type LessonSpec = { n: number; type: string; title?: string; ex: ((id: string) => Exercise)[] };

function unit(id: string, lessons: LessonSpec[]): Unit {
  const level = id.slice(0, 2).toLocaleUpperCase('tr') as Level;
  // Ohne Schema-Prüfung: die Tabellen-Attrappe ist absichtlich unvollständig.
  return {
    id,
    level,
    reviewed: false,
    title: `Titel ${id}`,
    source: 's',
    license: 'l',
    lessons: lessons.map((l) => ({
      id: `${id}-l${l.n}`,
      type: l.type,
      title: l.title ?? `Lektion ${l.n}`,
      exercises: l.ex.map((make, i) => make(`${id}-l${l.n}-e${i + 1}`)),
    })),
  } as Unit;
}

/** Unit mit zwei Grammatiklektionen (Wortbank + Freitext), wie die meisten echten Units. */
const plain = (id: string) =>
  unit(id, [
    { n: 1, type: 'vocab', ex: [free, free] },
    { n: 2, type: 'grammar', ex: [bank, free] },
    { n: 3, type: 'grammar', ex: [bank, mc] },
  ]);

describe('selectPlacement', () => {
  it('nimmt Grammatik vor Wortschatz, besseren Typ vor schlechterem, Bestätigung aus anderer Lektion', () => {
    const { plan, errors } = selectPlacement([plain('a1-u02')]);
    expect(errors).toEqual([]);
    const [probe, confirm] = plan.levels[0]!.units[0]!.items;
    // Beide Wortbänke sind Kandidaten; der kleinere Hash gewinnt die Probe.
    const banks = ['a1-u02-l2-e1', 'a1-u02-l3-e1'].sort((a, b) => fnv1a(a) - fnv1a(b));
    expect(probe!.id).toBe(banks[0]);
    expect(confirm!.id).toBe(banks[1]);
    expect(confirm!.lessonId).not.toBe(probe!.lessonId);
    expect(probe!.topic).toMatch(/^Lektion [23]$/);
  });

  it('fällt ohne Grammatik auf Dialog, dann Wortschatz zurück, ohne Multiple Choice dort', () => {
    const u = unit('a1-u01', [
      { n: 1, type: 'vocab', ex: [mc, free, free] },
      { n: 2, type: 'dialog', ex: [mc, bank] },
    ]);
    const { plan, errors } = selectPlacement([u]);
    expect(errors).toEqual([]);
    const ids = plan.levels[0]!.units[0]!.items.map((i) => i.id);
    // Im Dialog zählt Multiple Choice nicht, die Bestätigung kommt daher aus dem Wortschatz.
    const vocabFree = ['a1-u01-l1-e2', 'a1-u01-l1-e3'].sort((a, b) => fnv1a(a) - fnv1a(b));
    expect(ids).toEqual(['a1-u01-l2-e2', vocabFree[0]]);
  });

  it('meldet Units mit weniger als zwei Aufgaben', () => {
    const u = unit('a1-u01', [{ n: 1, type: 'grammar', ex: [paradigm, bank] }]);
    expect(selectPlacement([u]).errors).toEqual([
      'a1-u01: weniger als zwei Aufgaben für die Einstufung',
    ]);
  });

  it('schließt Tabellen, Lesetexte und Wiederholung aus', () => {
    const u = unit('a2-u01', [
      { n: 1, type: 'grammar', ex: [paradigm, bank, free] },
      { n: 2, type: 'review', ex: [bank, bank] },
    ]);
    const ids = selectPlacement([u]).plan.levels[0]!.units[0]!.items.map((i) => i.id);
    expect(ids.sort()).toEqual(['a2-u01-l1-e2', 'a2-u01-l1-e3']);
  });

  it('gruppiert nach Niveau, Units in Eingabereihenfolge (Manifest)', () => {
    const { plan } = selectPlacement([
      plain('b1-u01'),
      plain('a2-u02'),
      plain('a1-u02'),
      plain('a2-u01'),
    ]);
    expect(plan.levels.map((l) => [l.level, l.units.map((u) => u.unitId)])).toEqual([
      ['A1', ['a1-u02']],
      ['A2', ['a2-u02', 'a2-u01']],
      ['B1', ['b1-u01']],
    ]);
  });

  it('eine angehängte Übung verschiebt die Auswahl nur, wenn sie besser liegt', () => {
    const before = selectPlacement([plain('a1-u02')]).plan;
    const grown = plain('a1-u02');
    // Multiple Choice steht in der Rangfolge hinten und ändert daher nichts.
    grown.lessons[1]!.exercises.push(mc('a1-u02-l2-e9'));
    expect(selectPlacement([grown]).plan).toEqual(before);
  });

  it('eine angehängte Übung gleichen Typs mit größerem Hash ändert nichts', () => {
    const before = selectPlacement([plain('a1-u02')]).plan;
    const [probe] = before.levels[0]!.units[0]!.items;
    // Neue Wortbank in der Lektion der Probe, hinter ihr: Probe und Bestätigung bleiben.
    const id = Array.from({ length: 200 }, (_, i) => `${probe!.lessonId}-e${10 + i}`).find(
      (x) => fnv1a(x) > fnv1a(probe!.id),
    )!;
    const grown = plain('a1-u02');
    grown.lessons.find((l) => l.id === probe!.lessonId)!.exercises.push(bank(id));
    expect(selectPlacement([grown]).plan).toEqual(before);
  });

  it('Overrides folgen denselben Typregeln', () => {
    const u = unit('a1-u02', [
      { n: 1, type: 'vocab', ex: [mc, free] },
      { n: 2, type: 'grammar', ex: [paradigm, bank] },
      { n: 3, type: 'review', ex: [bank] },
    ]);
    const r = selectPlacement([u], { overrides: { 'a1-u02': ['a1-u02-l1-e1', 'a1-u02-l2-e1'] } });
    expect(r.errors).toEqual([
      'placement.yaml: a1-u02: a1-u02-l1-e1 (multiple_choice in vocab) ist nicht erlaubt',
      'placement.yaml: a1-u02: a1-u02-l2-e1 (paradigm in grammar) ist nicht erlaubt',
    ]);
    const review = selectPlacement([u], {
      overrides: { 'a1-u02': ['a1-u02-l3-e1', 'a1-u02-l2-e2'] },
    });
    expect(review.errors).toEqual([
      'placement.yaml: a1-u02: a1-u02-l3-e1 (word_bank in review) ist nicht erlaubt',
    ]);
  });

  it('übernimmt Overrides und prüft sie', () => {
    const u = plain('a1-u02');
    const ok = selectPlacement([u], { overrides: { 'a1-u02': ['a1-u02-l3-e2', 'a1-u02-l1-e1'] } });
    expect(ok.errors).toEqual([]);
    expect(ok.plan.levels[0]!.units[0]!.items.map((i) => i.id)).toEqual([
      'a1-u02-l3-e2',
      'a1-u02-l1-e1',
    ]);
    const bad = selectPlacement([u], {
      overrides: { 'a1-u02': ['a1-u02-l9-e1', 'a1-u02-l9-e1'], 'a1-u99': ['x', 'y'] },
    });
    expect(bad.errors).toEqual([
      'placement.yaml: Unit a1-u99 gibt es nicht',
      'placement.yaml: a1-u02: zweimal a1-u02-l9-e1',
      'placement.yaml: a1-u02: Übung a1-u02-l9-e1 gibt es nicht',
      'placement.yaml: a1-u02: Übung a1-u02-l9-e1 gibt es nicht',
    ]);
  });
});

/** Plan mit n Units je Niveau, ohne Inhalte (Ablauf kennt nur IDs). */
function planOf(counts: Partial<Record<Level, number>>): PlacementPlan {
  return {
    levels: Object.entries(counts).map(([level, n]) => ({
      level: level as Level,
      units: Array.from({ length: n }, (_, i) => {
        const unitId = `${level.toLocaleLowerCase('tr')}-u${String(i + 1).padStart(2, '0')}`;
        return {
          unitId,
          title: `T ${unitId}`,
          items: [
            { id: `${unitId}-p`, lessonId: `${unitId}-l2`, topic: `Thema ${unitId}` },
            { id: `${unitId}-c`, lessonId: `${unitId}-l3`, topic: `Thema ${unitId}` },
          ],
        };
      }),
    })),
  };
}

/** Spielt den Test; `respond` bekommt die Aufgaben-ID. Liefert Endstand und gestellte IDs. */
function play(plan: PlacementPlan, respond: (id: string) => Outcome) {
  let s: PlacementState = startPlacement(plan);
  const asked: string[] = [];
  for (let cur = currentItem(plan, s); cur; cur = currentItem(plan, s)) {
    asked.push(cur.item.id);
    s = answer(plan, s, respond(cur.item.id));
  }
  return { s, asked };
}

describe('Ablauf', () => {
  it('erlaubt je Niveau 20 % unsichere Units', () => {
    expect(allowedMisses(12)).toBe(2);
    expect(allowedMisses(10)).toBe(2);
    expect(allowedMisses(4)).toBe(0);
  });

  it('fragt bei richtiger Probe keine Bestätigung und läuft durch alle Niveaus', () => {
    const plan = planOf({ A1: 3, A2: 2 });
    const { s, asked } = play(plan, () => 'correct');
    expect(s.done).toBe(true);
    expect(asked).toEqual(['a1-u01-p', 'a1-u02-p', 'a1-u03-p', 'a2-u01-p', 'a2-u02-p']);
    expect(Object.values(s.statuses)).toEqual(Array(5).fill('secure'));
  });

  it('wertet Probe falsch + Bestätigung richtig als wackelig, fast richtig als richtig', () => {
    const plan = planOf({ A1: 10 });
    const { s, asked } = play(plan, (id) =>
      id === 'a1-u02-p' ? 'unknown' : id === 'a1-u03-p' ? 'almost' : 'correct',
    );
    expect(asked.slice(0, 4)).toEqual(['a1-u01-p', 'a1-u02-p', 'a1-u02-c', 'a1-u03-p']);
    expect(s.statuses['a1-u02']).toBe('shaky');
    expect(s.statuses['a1-u03']).toBe('secure');
  });

  it('bricht ab, sobald das Niveau nicht mehr zu schaffen ist', () => {
    const plan = planOf({ A1: 12, A2: 10 });
    const { s, asked } = play(plan, () => 'unknown');
    expect(s.done).toBe(true);
    // Drei unsichere Units à zwei Aufgaben, dann Schluss.
    expect(asked).toHaveLength(6);
    expect(Object.keys(s.statuses)).toEqual(['a1-u01', 'a1-u02', 'a1-u03']);
  });

  it('geht mit zwei unsicheren Units ins nächste Niveau', () => {
    const plan = planOf({ A1: 10, A2: 10 });
    const miss = new Set(['a1-u04-p', 'a1-u04-c', 'a1-u07-p', 'a1-u07-c']);
    const { s } = play(plan, (id) =>
      miss.has(id) || id.startsWith('a2-u03') ? 'wrong' : 'correct',
    );
    expect(s.statuses['a1-u07']).toBe('unsure');
    expect(s.statuses['a2-u10']).toBe('secure');
  });

  it('wertet eine Unit mit nur einer Aufgabe direkt', () => {
    const plan = planOf({ A1: 10 });
    plan.levels[0]!.units[0]!.items.pop();
    const { s, asked } = play(plan, (id) => (id === 'a1-u01-p' ? 'wrong' : 'correct'));
    expect(asked[1]).toBe('a1-u02-p');
    expect(s.statuses['a1-u01']).toBe('unsure');
  });

  it('ohne erlaubte Fehlversuche endet ein kleines Niveau mit der ersten unsicheren Unit', () => {
    const plan = planOf({ A1: 4, A2: 2 });
    const { s, asked } = play(plan, (id) => (id.startsWith('a1-u02') ? 'wrong' : 'correct'));
    expect(asked).toEqual(['a1-u01-p', 'a1-u02-p', 'a1-u02-c']);
    expect(s.done).toBe(true);
    expect(recommend(plan, s.statuses).startUnit).toBe('a1-u02');
  });

  it('fast richtig in der Bestätigung zählt als wackelig; nach dem Ende ändert nichts mehr', () => {
    const plan = planOf({ A1: 1 });
    let s = startPlacement(plan);
    s = answer(plan, s, 'wrong');
    s = answer(plan, s, 'almost');
    expect(s).toMatchObject({ done: true, statuses: { 'a1-u01': 'shaky' } });
    expect(answer(plan, s, 'wrong')).toBe(s);
  });

  it('überspringt ein leeres erstes Niveau', () => {
    const plan = planOf({ A1: 0, A2: 1 });
    expect(currentItem(plan, startPlacement(plan))?.unit.unitId).toBe('a2-u01');
  });

  it('zeigt Niveau und Position, endet bei leerem Plan sofort', () => {
    const plan = planOf({ A1: 3, A2: 2 });
    let s = startPlacement(plan);
    for (let i = 0; i < 3; i++) s = answer(plan, s, 'correct');
    expect(currentItem(plan, s)).toMatchObject({ level: 'A2', position: 1, total: 2 });
    expect(startPlacement({ levels: [] }).done).toBe(true);
    expect(startPlacement({ levels: [{ level: 'A1', units: [] }] }).done).toBe(true);
  });
});

describe('recommend', () => {
  it('Anfänger: Start bei a1-u01, nichts übersprungen', () => {
    const plan = planOf({ A1: 12, A2: 10 });
    const r = recommend(plan, play(plan, () => 'unknown').s.statuses);
    expect(r).toMatchObject({ startUnit: 'a1-u01', skipped: [], shaky: [], catchUp: [] });
  });

  it('Abbruch in A2: Start bei der ersten unsicheren A2-Unit, unsichere A1-Unit zum Nachholen', () => {
    const plan = planOf({ A1: 10, A2: 10, B1: 10 });
    const wrong = (id: string) =>
      id.startsWith('a1-u05') ||
      id === 'a1-u08-p' ||
      ['a2-u02', 'a2-u04', 'a2-u05'].some((u) => id.startsWith(u));
    const { s } = play(plan, (id) => (wrong(id) ? 'wrong' : 'correct'));
    const r = recommend(plan, s.statuses);
    expect(r.startUnit).toBe('a2-u02');
    expect(r.catchUp).toEqual(['a1-u05']);
    expect(r.shaky).toEqual(['a1-u08']);
    expect(r.skipped).toEqual([
      'a1-u01',
      'a1-u02',
      'a1-u03',
      'a1-u04',
      'a1-u06',
      'a1-u07',
      'a1-u08',
      'a1-u09',
      'a1-u10',
      'a2-u01',
    ]);
    // a2-u03 war sicher, liegt aber hinter dem Start: nicht übersprungen.
    expect(r.units.find((u) => u.unitId === 'a2-u03')?.status).toBe('secure');
    expect(r.units.find((u) => u.unitId === 'b1-u01')?.status).toBeUndefined();
  });

  it('alles sicher: kein Start, alles übersprungen; unsichere Units zum Nachholen', () => {
    const plan = planOf({ A1: 10, B1: 10 });
    const { s } = play(plan, (id) => (id.startsWith('b1-u09') ? 'wrong' : 'correct'));
    const r = recommend(plan, s.statuses);
    expect(r.startUnit).toBeNull();
    expect(r.catchUp).toEqual(['b1-u09']);
    expect(r.skipped).toHaveLength(19);
  });

  it('nennt Titel und Thema je Unit in Kursreihenfolge', () => {
    const plan = planOf({ A1: 2 });
    const r = recommend(plan, { 'a1-u01': 'secure' });
    expect(r.units[0]).toEqual({
      unitId: 'a1-u01',
      title: 'T a1-u01',
      topic: 'Thema a1-u01',
      status: 'secure',
    });
    // Ohne Abbruch beginnt man bei der ersten ungeprüften Unit (Test vorzeitig beendet).
    expect(r.startUnit).toBe('a1-u02');
  });
});
