import { describe, expect, it } from 'vitest';
import { cardId, type Card, type CardRef } from '../srs/card';
import {
  dueForecast,
  hardItems,
  insights,
  unitOverview,
  vocabBoxes,
  type InsightUnit,
} from './insights';
import type { Attempt, Completion } from './stats';

const TODAY = '2026-10-28';
const at = (day: string) => new Date(`${day}T10:00:00`).getTime();

const vo = (vocabId: string, dir: 'tr_de' | 'de_tr' = 'tr_de'): CardRef => ({
  kind: 'vocab',
  vocabId,
  dir,
});
const ex = (exerciseId: string): CardRef => ({ kind: 'exercise', exerciseId });
const card = (ref: CardRef, unitId: string, o: Partial<Card> = {}): Card => ({
  id: cardId(ref),
  ref,
  unitId,
  box: 1,
  due: TODAY,
  introduced: '2026-10-01',
  lastAt: 0,
  lapses: 0,
  ...o,
});

const units: InsightUnit[] = [
  {
    id: 'a1-u02',
    title: 'Vokalharmonie',
    lessons: [
      { id: 'a1-u02-l1', type: 'vocab' },
      { id: 'a1-u02-l2', type: 'grammar' },
      { id: 'a1-u02-h1', type: 'listening' },
    ],
    vocab: ['ev', 'kitap', 'göz'],
  },
  { id: 'a1-u03', title: 'Orte', lessons: [{ id: 'a1-u03-l1', type: 'vocab' }], vocab: ['okul'] },
];

describe('vocabBoxes', () => {
  it('zählt je Box und Richtung, ungesehene Vokabeln getrennt', () => {
    const cards = [
      card(vo('ev'), 'a1-u02', { box: 1 }),
      card(vo('kitap'), 'a1-u02', { box: 5 }),
      card(vo('kitap', 'de_tr'), 'a1-u02', { box: 2 }),
      card(ex('a1-u02-l2-e1'), 'a1-u02', { box: 3 }),
    ];
    expect(vocabBoxes(units, cards, 'tr_de')).toEqual({ boxes: [1, 0, 0, 0, 1], unseen: 2 });
    expect(vocabBoxes(units, cards, 'de_tr')).toEqual({ boxes: [0, 1, 0, 0, 0], unseen: 3 });
  });

  it('klemmt Boxen außerhalb des Bereichs', () => {
    const cards = [card(vo('ev'), 'a1-u02', { box: 9 })];
    expect(vocabBoxes(units, cards, 'tr_de').boxes).toEqual([0, 0, 0, 0, 1]);
  });
});

describe('dueForecast', () => {
  it('verteilt auf sieben Tage, Überfälliges zählt auf heute', () => {
    const cards = [
      card(vo('ev'), 'a1-u02', { due: '2026-10-20' }),
      card(vo('kitap'), 'a1-u02', { due: TODAY }),
      card(vo('göz'), 'a1-u02', { due: '2026-10-30' }),
      card(vo('okul'), 'a1-u03', { due: '2026-11-03' }),
      card(ex('a1-u02-l2-e1'), 'a1-u02', { due: '2026-11-04' }),
    ];
    const f = dueForecast(cards, TODAY);
    expect(f).toHaveLength(7);
    expect(f[0]).toEqual({ day: TODAY, count: 2 });
    expect(f[2]).toEqual({ day: '2026-10-30', count: 1 });
    expect(f[6]).toEqual({ day: '2026-11-03', count: 1 });
    expect(f.reduce((s, d) => s + d.count, 0)).toBe(4);
  });
});

describe('hardItems', () => {
  it('sortiert nach Fehlern, dann niedriger Box, dann länger nicht geübt', () => {
    const a = card(vo('ev'), 'a1-u02', { lapses: 2, box: 2, lastAt: 5 });
    const b = card(vo('kitap'), 'a1-u02', { lapses: 3, box: 3 });
    const c = card(vo('göz'), 'a1-u02', { lapses: 2, box: 1, lastAt: 9 });
    const d = card(vo('okul'), 'a1-u03', { lapses: 2, box: 2, lastAt: 1 });
    const never = card(vo('ev', 'de_tr'), 'a1-u02', { lapses: 0 });
    const form = card(ex('a1-u02-l2-e1'), 'a1-u02', { lapses: 4 });
    expect(hardItems([a, b, c, d, never, form], 'vocab').map((x) => x.id)).toEqual([
      b.id,
      c.id,
      d.id,
      a.id,
    ]);
    expect(hardItems([a, form], 'exercise')).toEqual([form]);
    expect(hardItems([a, b, c], 'vocab', 2)).toHaveLength(2);
  });
});

describe('unitOverview', () => {
  const attempt = (exerciseId: string, verdict: Attempt['verdict'], day: string): Attempt => ({
    exerciseId,
    lessonId: exerciseId.replace(/-e\d+$/, ''),
    verdict,
    at: at(day),
  });
  const completion = (lessonId: string): Completion => ({
    lessonId,
    unitId: lessonId.slice(0, 6),
    correct: 1,
    total: 1,
    at: 0,
    day: TODAY,
  });

  it('zählt Lektionen ohne Hören, Trefferquote der letzten 30 Tage und gefestigte Karten', () => {
    const o = unitOverview(
      units,
      [completion('a1-u02-l1'), completion('a1-u02-h1'), completion('a1-u02-l1')],
      [
        attempt('a1-u02-l1-e1', 'correct', TODAY),
        attempt('a1-u02-l1-e2', 'almost', '2026-09-29'),
        attempt('a1-u02-l2-e1', 'wrong', '2026-10-10'),
        attempt('a1-u02-l2-e2', 'wrong', '2026-09-28'), // älter als 30 Tage
        attempt('unbekannt', 'wrong', TODAY),
      ],
      [card(vo('ev'), 'a1-u02', { box: 4 }), card(vo('kitap'), 'a1-u02', { box: 2 })],
      TODAY,
    );
    expect(o[0]).toEqual({
      id: 'a1-u02',
      title: 'Vokalharmonie',
      done: 1,
      total: 2,
      accuracy: 2 / 3,
      attempts: 3,
      cards: 2,
      settled: 1,
    });
    expect(o[1]).toMatchObject({ done: 0, total: 1, accuracy: undefined, attempts: 0, cards: 0 });
  });
});

describe('insights', () => {
  it('lässt Karten entfernter Inhalte und übersprungene Karten weg', () => {
    const gone = card(vo('gibtsnicht'), 'a1-u02', { lapses: 5 });
    const listen = card(ex('a1-u02-h1-e1'), 'a1-u02', { lapses: 2 });
    const form = card(ex('a1-u02-l2-e1'), 'a1-u02', { lapses: 1 });
    const r = insights(units, [], [], [gone, listen, form], TODAY, {
      skip: (c) => c.id === listen.id,
    });
    expect(r.hardWords).toEqual([]);
    expect(r.hardForms).toEqual([form]);
    expect(r.due[0]!.count).toBe(1);
    expect(r.vocab.tr_de.unseen).toBe(4);
  });
});
