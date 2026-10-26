import { describe, expect, it } from 'vitest';
import type { Vocab } from '../content/schema';
import type { Verdict } from '../lib/answer';
import type { Attempt } from '../progress/stats';
import {
  buildQueue,
  cardId,
  dueCards,
  glossOf,
  INTERVALS,
  isDue,
  leitner,
  record,
  seedFromAttempts,
  tracks,
  unitOfExercise,
  vocabCandidates,
  vocabExercise,
  type Card,
  type CardRef,
  type VocabRef,
} from '.';

const exRef = (exerciseId: string): CardRef => ({ kind: 'exercise', exerciseId });
const voRef = (vocabId: string, dir: VocabRef['dir'] = 'tr_de'): VocabRef => ({
  kind: 'vocab',
  vocabId,
  dir,
});

const card = (ref: CardRef, over: Partial<Card> = {}): Card => ({
  id: cardId(ref),
  ref,
  unitId: 'a1-u01',
  box: 1,
  due: '2026-05-01',
  introduced: '2026-04-01',
  lastAt: 0,
  lapses: 0,
  ...over,
});

describe('Karten', () => {
  it('bildet IDs aus den stabilen Inhalts-IDs', () => {
    expect(cardId(exRef('a1-u01-l1-e1'))).toBe('ex:a1-u01-l1-e1');
    expect(cardId(voRef('güle güle', 'de_tr'))).toBe('vo:de_tr:güle güle');
  });

  it('leitet die Unit aus der Übungs-ID ab', () => {
    expect(unitOfExercise('a2-u10-l3-e12')).toBe('a2-u10');
    expect(unitOfExercise('srs-vo:tr_de:ev')).toBeUndefined();
    expect(unitOfExercise('a1-u01')).toBeUndefined();
  });

  it('verfolgt Grammatikübungen immer, andere erst nach einem Fehler', () => {
    expect(tracks('suffix_builder', 'correct', false)).toBe(true);
    expect(tracks('conjugation', 'almost', false)).toBe(true);
    expect(tracks('paradigm', 'correct', false)).toBe(true);
    expect(tracks('multiple_choice', 'correct', false)).toBe(false);
    expect(tracks('word_bank', 'almost', false)).toBe(false);
    expect(tracks('free_text', 'wrong', false)).toBe(true);
    expect(tracks('multiple_choice', 'correct', true)).toBe(true);
    expect(tracks(undefined, 'correct', false)).toBe(false);
    expect(tracks(undefined, 'wrong', false)).toBe(true);
  });
});

describe('Leitner', () => {
  const today = '2026-05-01';

  it('führt richtig gelöste Karten in Box 2 ein, sonst in Box 1', () => {
    expect(leitner.introduce('correct', today)).toEqual({ box: 2, due: '2026-05-04', lapses: 0 });
    expect(leitner.introduce('almost', today)).toEqual({ box: 1, due: '2026-05-02', lapses: 0 });
    expect(leitner.introduce('wrong', today)).toEqual({ box: 1, due: '2026-05-02', lapses: 0 });
  });

  it('rückt fällige Karten bei richtig eine Box vor, mit wachsendem Abstand', () => {
    let c = card(exRef('a1-u01-l1-e1'), { box: 1, due: today });
    const seen: [number, string][] = [];
    let day = today;
    for (let i = 0; i < 6; i++) {
      c = leitner.review(c, 'correct', day, i);
      seen.push([c.box, c.due]);
      day = c.due;
    }
    expect(seen).toEqual([
      [2, '2026-05-04'],
      [3, '2026-05-11'],
      [4, '2026-05-25'],
      [5, '2026-06-24'],
      [5, '2026-07-24'], // Box 5 ist die letzte
      [5, '2026-08-23'],
    ]);
    expect(c.lastAt).toBe(5);
    expect(INTERVALS).toHaveLength(5);
  });

  it('setzt bei falsch immer auf Box 1 zurück und zählt den Rückfall', () => {
    const c = card(exRef('x'), { box: 4, due: '2026-05-20', lapses: 1 });
    expect(leitner.review(c, 'wrong', today, 9)).toMatchObject({
      box: 1,
      due: '2026-05-02',
      lapses: 2,
      lastAt: 9,
    });
  });

  it('hält bei fast richtig die Box und plant neu', () => {
    const c = card(exRef('x'), { box: 3, due: '2026-04-28' });
    expect(leitner.review(c, 'almost', today, 1)).toMatchObject({ box: 3, due: '2026-05-08' });
  });

  it('schiebt nicht fällige Karten bei richtig nicht vor', () => {
    const c = card(exRef('x'), { box: 2, due: '2026-05-03' });
    const after = leitner.review(c, 'correct', today, 7);
    expect(after).toEqual({ ...c, lastAt: 7 });
    expect(leitner.review(c, 'almost', today, 7)).toEqual({ ...c, lastAt: 7 });
  });

  it('rechnet über Monats-, Jahres- und Sommerzeitgrenzen in lokalen Tagen', () => {
    const c = (due: string) => card(exRef('x'), { box: 2, due });
    expect(leitner.review(c('2026-03-28'), 'correct', '2026-03-28', 0).due).toBe('2026-04-04');
    expect(leitner.review(c('2026-10-24'), 'correct', '2026-10-24', 0).due).toBe('2026-10-31');
    expect(leitner.review(c('2026-12-30'), 'correct', '2026-12-30', 0).due).toBe('2027-01-06');
  });

  it('isDue vergleicht Tagesschlüssel', () => {
    expect(isDue({ due: '2026-05-01' }, '2026-05-01')).toBe(true);
    expect(isDue({ due: '2026-04-30' }, '2026-05-01')).toBe(true);
    expect(isDue({ due: '2026-05-02' }, '2026-05-01')).toBe(false);
  });
});

describe('record', () => {
  it('legt eine neue Karte an', () => {
    const ref = voRef('ev');
    expect(
      record(leitner, undefined, { ref, unitId: 'a1-u02' }, 'correct', '2026-05-01', 42),
    ).toEqual({
      id: 'vo:tr_de:ev',
      ref,
      unitId: 'a1-u02',
      box: 2,
      due: '2026-05-04',
      introduced: '2026-05-01',
      lastAt: 42,
      lapses: 0,
    });
  });

  it('schreibt eine vorhandene Karte fort und behält Einführungstag und Unit', () => {
    const c = card(exRef('a1-u01-l1-e1'), { box: 2, due: '2026-05-01' });
    const after = record(leitner, c, { ref: c.ref, unitId: 'egal' }, 'correct', '2026-05-01', 1);
    expect(after).toMatchObject({ box: 3, introduced: '2026-04-01', unitId: 'a1-u01' });
  });
});

describe('dueCards', () => {
  it('liefert fällige Karten, schwächste Box und ältester Termin zuerst', () => {
    const cards = [
      card(exRef('a'), { box: 3, due: '2026-04-01' }),
      card(exRef('b'), { box: 1, due: '2026-05-01' }),
      card(exRef('c'), { box: 1, due: '2026-04-20' }),
      card(exRef('d'), { box: 1, due: '2026-05-02' }), // morgen
      card(exRef('e'), { box: 1, due: '2026-04-20' }),
    ];
    expect(dueCards(cards, '2026-05-01').map((c) => c.id)).toEqual([
      'ex:c',
      'ex:e',
      'ex:b',
      'ex:a',
    ]);
  });
});

describe('vocabCandidates', () => {
  const units = [
    { id: 'a1-u01', lessons: [{ id: 'a1-u01-l1' }], vocab: ['merhaba', 'evet'] },
    { id: 'a1-u02', lessons: [{ id: 'a1-u02-l1' }, { id: 'a1-u02-l2' }], vocab: ['ev', 'göz'] },
    { id: 'a1-u03', lessons: [{ id: 'a1-u03-l1' }], vocab: ['şehir'] },
  ];

  it('nimmt nur Units mit abgeschlossener Lektion, in Inhaltsreihenfolge', () => {
    const got = vocabCandidates(units, new Set(['a1-u02-l2', 'a1-u01-l1']), []);
    expect(got.map((c) => cardId(c.ref))).toEqual([
      'vo:tr_de:merhaba',
      'vo:tr_de:evet',
      'vo:tr_de:ev',
      'vo:tr_de:göz',
    ]);
    expect(got[2]!.unitId).toBe('a1-u02');
  });

  it('ergänzt de→tr erst ab Box 2 der tr→de-Karte', () => {
    const cards = [
      card(voRef('ev'), { box: 1 }),
      card(voRef('göz'), { box: 2 }),
      card(voRef('merhaba'), { box: 3 }),
      card(voRef('merhaba', 'de_tr')),
    ];
    const got = vocabCandidates(units, new Set(['a1-u01-l1', 'a1-u02-l1']), cards);
    expect(got.map((c) => cardId(c.ref))).toEqual(['vo:tr_de:evet', 'vo:de_tr:göz']);
  });
});

describe('buildQueue', () => {
  const today = '2026-05-01';
  const dueEx = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      card(exRef(`ex${String(i).padStart(2, '0')}`), { due: today }),
    );
  const dueVo = (n: number) =>
    Array.from({ length: n }, (_, i) => card(voRef(`w${i}`), { due: today, box: 2 }));
  const cands = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ ref: voRef(`neu${i}`), unitId: 'a1-u01' }));
  const ids = (q: { ref: CardRef }[]) => q.map((e) => cardId(e.ref));

  it('mischt Übungen und Vokabeln abwechselnd', () => {
    const q = buildQueue([...dueEx(3), ...dueVo(1)], cands(2), today, { max: 20, newPerDay: 10 });
    expect(ids(q)).toEqual([
      'ex:ex00',
      'vo:tr_de:w0',
      'ex:ex01',
      'vo:tr_de:neu0',
      'ex:ex02',
      'vo:tr_de:neu1',
    ]);
  });

  it('begrenzt auf max und lässt neuen Wörtern bei Rückstau ein Viertel', () => {
    const q = buildQueue(dueEx(30), cands(30), today, { max: 20, newPerDay: 10 });
    expect(q).toHaveLength(20);
    expect(q.filter((e) => e.ref.kind === 'vocab')).toHaveLength(5);
  });

  it('füllt freie Plätze mit neuen Wörtern bis zum Tageslimit', () => {
    const q = buildQueue(dueEx(4), cands(30), today, { max: 20, newPerDay: 10 });
    expect(q.filter((e) => e.ref.kind === 'vocab')).toHaveLength(10);
    expect(q).toHaveLength(14);
  });

  it('rechnet heute schon eingeführte Vokabeln an', () => {
    const introducedToday = Array.from({ length: 7 }, (_, i) =>
      card(voRef(`heute${i}`), { introduced: today, due: '2026-05-02' }),
    );
    const q = buildQueue(introducedToday, cands(30), today, { max: 20, newPerDay: 10 });
    expect(ids(q)).toEqual(['vo:tr_de:neu0', 'vo:tr_de:neu1', 'vo:tr_de:neu2']);
  });

  it('ohne neue Wörter (0) nur fällige Karten; leer, wenn nichts ansteht', () => {
    expect(buildQueue(dueEx(2), cands(5), today, { max: 20, newPerDay: 0 })).toHaveLength(2);
    expect(buildQueue([], [], today, { max: 20, newPerDay: 10 })).toEqual([]);
  });

  it('nimmt keine noch nicht fälligen Karten', () => {
    const later = card(exRef('später'), { due: '2026-05-02' });
    expect(buildQueue([later], [], today, { max: 20, newPerDay: 10 })).toEqual([]);
  });
});

describe('seedFromAttempts', () => {
  const at = (day: string, h = 12) =>
    new Date(`${day}T${String(h).padStart(2, '0')}:00:00`).getTime();
  const a = (exerciseId: string, verdict: Verdict, day: string, h?: number): Attempt => ({
    exerciseId,
    lessonId: exerciseId.replace(/-e\d+$/, ''),
    verdict,
    at: at(day, h),
  });

  it('legt Karten erst ab dem ersten Fehler an und spielt danach alles ab', () => {
    const cards = seedFromAttempts(
      [
        a('a1-u01-l1-e2', 'correct', '2026-04-01'), // vor dem Fehler: zählt nicht
        a('a1-u01-l1-e2', 'wrong', '2026-04-02'),
        a('a1-u01-l1-e2', 'correct', '2026-04-02', 14), // gleich danach, nicht fällig
        a('a1-u01-l1-e2', 'correct', '2026-04-03'), // fällig → Box 2
        a('a1-u01-l1-e3', 'correct', '2026-04-01'), // nie falsch: keine Karte
      ],
      leitner,
    );
    expect(cards).toEqual([
      {
        id: 'ex:a1-u01-l1-e2',
        ref: exRef('a1-u01-l1-e2'),
        unitId: 'a1-u01',
        box: 2,
        due: '2026-04-06',
        introduced: '2026-04-02',
        lastAt: at('2026-04-03'),
        lapses: 0,
      },
    ]);
  });

  it('sortiert nach Zeit und überspringt unbekannte IDs', () => {
    const cards = seedFromAttempts(
      [
        a('a1-u02-l1-e1', 'correct', '2026-04-05'),
        a('a1-u02-l1-e1', 'wrong', '2026-04-04'),
        a('kaputt', 'wrong', '2026-04-04'),
      ],
      leitner,
    );
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ box: 2, due: '2026-04-08', introduced: '2026-04-04' });
  });

  it('wiederholte Fehler zählen als Rückfälle', () => {
    const cards = seedFromAttempts(
      [a('a1-u01-l2-e1', 'wrong', '2026-04-01'), a('a1-u01-l2-e1', 'wrong', '2026-04-02')],
      leitner,
    );
    expect(cards[0]).toMatchObject({ box: 1, lapses: 1, due: '2026-04-03' });
  });
});

describe('vocabExercise', () => {
  const v = (
    tr: string,
    de: string[],
    pos: Vocab['pos'] = 'noun',
    extra: Partial<Vocab> = {},
  ): Vocab => ({
    tr,
    de,
    pos,
    ...extra,
  });
  const pool = [
    v('ev', ['Haus']),
    v('göz', ['Auge']),
    v('kitap', ['Buch']),
    v('okul', ['Schule']),
    v('masa', ['Tisch']),
    v('büyük', ['groß'], 'adj'),
    v('ülke', ['Land', 'Staat']),
    v('memleket', ['Land', 'Heimat']),
  ];

  it('tr→de: Multiple Choice mit Ablenkern gleicher Wortart, stabil gemischt', () => {
    const ex = vocabExercise(voRef('ev'), pool[0]!, pool);
    if (ex.type !== 'multiple_choice') throw new Error('MC erwartet');
    expect(ex.id).toBe('srs-vo:tr_de:ev');
    expect(ex.prompt).toBe('ev');
    expect(ex.answer).toBe('Haus');
    expect(ex.options).toHaveLength(4);
    expect(ex.options).toContain('Haus');
    expect(ex.options).not.toContain('groß'); // genug Nomen vorhanden
    expect(vocabExercise(voRef('ev'), pool[0]!, [...pool].reverse())).toEqual(ex);
  });

  it('tr→de: keine Ablenker mit gleicher Bedeutung', () => {
    const ex = vocabExercise(voRef('ülke'), pool[6]!, pool);
    if (ex.type !== 'multiple_choice') throw new Error('MC erwartet');
    expect(ex.answer).toBe('Land, Staat');
    expect(ex.options).not.toContain('Land, Heimat');
  });

  it('tr→de: füllt mit anderen Wortarten auf und weicht ohne Pool auf Freitext aus', () => {
    const small = [pool[0]!, pool[5]!];
    const ex = vocabExercise(voRef('ev'), pool[0]!, small);
    expect(ex).toMatchObject({
      type: 'multiple_choice',
      options: expect.arrayContaining(['Haus', 'groß']),
    });
    expect(vocabExercise(voRef('ev'), pool[0]!, [pool[0]!])).toMatchObject({
      type: 'free_text',
      direction: 'tr_de',
      answers: ['Haus'],
    });
  });

  it('de→tr: Freitext, Synonyme mit gleicher Bedeutung gelten', () => {
    const ex = vocabExercise(voRef('ülke', 'de_tr'), pool[6]!, pool);
    expect(ex).toEqual({
      id: 'srs-vo:de_tr:ülke',
      type: 'free_text',
      direction: 'de_tr',
      prompt: 'Land, Staat',
      answers: ['ülke', 'memleket'],
    });
  });

  it('de→tr: übernimmt das Register und nutzt die explizite Vokabel-ID', () => {
    const siz = v('siz', ['ihr', 'Sie'], 'pron', { register: 'formal', id: 'siz-pron' });
    const ex = vocabExercise(voRef('siz-pron', 'de_tr'), siz, [
      siz,
      v('siz', ['ihr'], 'pron', { id: 'siz2' }),
    ]);
    expect(ex).toMatchObject({ register: 'formal', answers: ['siz'] });
    expect(glossOf(siz)).toBe('ihr, Sie');
  });
});
