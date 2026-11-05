import { describe, expect, it } from 'vitest';
import {
  allItems,
  deckFor,
  hardVocabIds,
  lessonSummary,
  markedKeys,
  openWrong,
  shuffle,
  type DeckState,
  type Selection,
} from './deck';
import type { Card } from '../srs/card';
import { cardKey, type Flash, type FlashDir, type FlashMark } from './types';

const units = [
  {
    id: 'a1-u01',
    level: 'A1' as const,
    lessons: [
      { id: 'a1-u01-l1', vocab: ['merhaba', 'evet'], phrases: ['a1-u01-l1-e2'] },
      { id: 'a1-u01-l2', vocab: ['hayır'] },
      { id: 'a1-u01-h1' },
    ],
  },
  { id: 'a2-u01', level: 'A2' as const, lessons: [{ id: 'a2-u01-l1', vocab: ['dün'] }] },
];
const flash = (ref: string, dir: FlashDir, correct: boolean, at: number): Flash => ({
  kind: ref.includes('-e') ? 'phrase' : 'vocab',
  ref,
  dir,
  correct,
  mode: 'flip',
  at,
});
const state = (over: Partial<DeckState> = {}): DeckState => ({
  flashes: [],
  marks: [],
  completedLessons: new Set(),
  ...over,
});
const sel = (over: Partial<Selection>): Selection => ({
  scope: { scope: 'unit', unitId: 'a1-u01' },
  content: 'both',
  dir: 'tr_de',
  order: 'course',
  ...over,
});
const refs = (cards: { ref: string }[]) => cards.map((c) => c.ref);
/** Zufall in fester Folge. */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe('allItems', () => {
  it('Kursreihenfolge, je Lektion erst Wörter, dann Sätze', () => {
    expect(allItems(units).map((i) => `${i.kind}:${i.ref}@${i.lessonId}`)).toEqual([
      'vocab:merhaba@a1-u01-l1',
      'vocab:evet@a1-u01-l1',
      'phrase:a1-u01-l1-e2@a1-u01-l1',
      'vocab:hayır@a1-u01-l2',
      'vocab:dün@a2-u01-l1',
    ]);
  });
});

describe('deckFor', () => {
  it('Lektion, Unit, Niveau und Inhalt', () => {
    expect(
      refs(deckFor(units, sel({ scope: { scope: 'lesson', lessonId: 'a1-u01-l1' } }), state())),
    ).toEqual(['merhaba', 'evet', 'a1-u01-l1-e2']);
    expect(refs(deckFor(units, sel({ content: 'phrase' }), state()))).toEqual(['a1-u01-l1-e2']);
    expect(
      refs(
        deckFor(units, sel({ content: 'vocab', scope: { scope: 'level', level: 'A2' } }), state()),
      ),
    ).toEqual(['dün']);
  });

  it('gelernt = Lektionen mit Abschluss', () => {
    const s = state({ completedLessons: new Set(['a1-u01-l2', 'a2-u01-l1']) });
    expect(refs(deckFor(units, sel({ scope: { scope: 'learned' } }), s))).toEqual(['hayır', 'dün']);
  });

  it('gemischte Richtung je Karte aus dem Zufall', () => {
    const cards = deckFor(units, sel({ dir: 'mixed', content: 'vocab' }), state(), seq(0.2, 0.7));
    expect(cards.map((c) => c.dir)).toEqual(['tr_de', 'de_tr', 'tr_de']);
  });

  it('Falsch-Stapel: letzte Antwort falsch, mit ihrer Richtung, älteste zuerst', () => {
    const s = state({
      flashes: [
        flash('evet', 'de_tr', false, 3),
        flash('merhaba', 'tr_de', false, 1),
        flash('merhaba', 'tr_de', true, 2),
        flash('hayır', 'tr_de', false, 4),
        flash('dün', 'tr_de', false, 5),
      ],
    });
    const wrong = deckFor(units, sel({ scope: { scope: 'wrong' }, dir: 'mixed' }), s);
    expect(wrong.map(cardKey)).toEqual([
      'vocab:evet:de_tr',
      'vocab:hayır:tr_de',
      'vocab:dün:tr_de',
    ]);
    // Feste Richtung filtert; Inhalt filtert auch hier.
    expect(refs(deckFor(units, sel({ scope: { scope: 'wrong' }, dir: 'tr_de' }), s))).toEqual([
      'hayır',
      'dün',
    ]);
    expect(
      deckFor(units, sel({ scope: { scope: 'wrong' }, dir: 'mixed', content: 'phrase' }), s),
    ).toEqual([]);
  });

  it('markierte Wörter, jüngste Markierung gilt', () => {
    const marks: FlashMark[] = [
      { key: 'vocab:evet', marked: true, at: 1 },
      { key: 'vocab:hayır', marked: true, at: 1 },
      { key: 'vocab:hayır', marked: false, at: 2 },
    ];
    expect(refs(deckFor(units, sel({ scope: { scope: 'marked' } }), state({ marks })))).toEqual([
      'evet',
    ]);
    expect([...markedKeys(marks)]).toEqual(['vocab:evet']);
  });

  it('gemischte Reihenfolge über den Zufall', () => {
    const cards = deckFor(units, sel({ content: 'vocab', order: 'shuffled' }), state(), seq(0));
    expect(refs(cards)).toEqual(['evet', 'hayır', 'merhaba']);
  });
});

const srs = (vocabId: string, dir: 'tr_de' | 'de_tr', lapses: number): Card => ({
  id: `vo:${dir}:${vocabId}`,
  ref: { kind: 'vocab', vocabId, dir },
  unitId: 'a1-u01',
  box: 1,
  due: '2026-11-04',
  introduced: '2026-11-01',
  lastAt: 0,
  lapses,
});

describe('Schwer-Stapel', () => {
  it('Fehler beider Richtungen zählen zusammen, Gleichstand nach ID, höchstens max', () => {
    const cards = [
      srs('evet', 'tr_de', 1),
      srs('evet', 'de_tr', 2),
      srs('merhaba', 'tr_de', 3),
      srs('hayır', 'tr_de', 1),
      srs('dün', 'tr_de', 0),
    ];
    expect([...hardVocabIds(cards)]).toEqual(['evet', 'merhaba', 'hayır']);
    expect([...hardVocabIds(cards, 2)]).toEqual(['evet', 'merhaba']);
  });

  it('Stapel nimmt nur Wörter mit Fehlern, in Kursreihenfolge, ohne Sätze', () => {
    const srsCards = [srs('hayır', 'tr_de', 2), srs('merhaba', 'de_tr', 1), srs('dün', 'tr_de', 0)];
    const hard = deckFor(units, sel({ scope: { scope: 'hard' } }), state({ srsCards }));
    expect(refs(hard)).toEqual(['merhaba', 'hayır']);
    expect(deckFor(units, sel({ scope: { scope: 'hard' } }), state())).toEqual([]);
  });
});

describe('Hörkarten', () => {
  it('ohne Stimme fällt „Hören“ auf Türkisch → Deutsch zurück', () => {
    const cards = deckFor(units, sel({ dir: 'listen' }), state());
    expect(new Set(cards.map((c) => c.dir))).toEqual(new Set(['tr_de']));
  });

  it('mit Stimme: Hörkarten; „gemischt“ würfelt nur zwischen den Leserichtungen', () => {
    const listen = deckFor(units, sel({ dir: 'listen' }), state({ canListen: true }));
    expect(new Set(listen.map((c) => c.dir))).toEqual(new Set(['listen']));
    const mixed = deckFor(units, sel({ dir: 'mixed' }), state({ canListen: true }), seq(0.1, 0.9));
    expect(mixed.every((c) => c.dir !== 'listen')).toBe(true);
  });

  it('Falsch-Stapel: Hörkarten nur mit Stimme', () => {
    const flashes = [flash('merhaba', 'listen', false, 1), flash('evet', 'tr_de', false, 2)];
    const wrong = sel({ scope: { scope: 'wrong' }, dir: 'mixed' });
    expect(deckFor(units, wrong, state({ flashes })).map((c) => c.ref)).toEqual(['evet']);
    expect(
      deckFor(units, wrong, state({ flashes, canListen: true })).map((c) => `${c.ref}:${c.dir}`),
    ).toEqual(['merhaba:listen', 'evet:tr_de']);
  });
});

describe('openWrong / lessonSummary / shuffle', () => {
  it('openWrong vergisst, was danach richtig war', () => {
    expect(openWrong([flash('ev', 'tr_de', false, 1), flash('ev', 'tr_de', true, 2)])).toEqual([]);
    expect(openWrong([flash('ev', 'tr_de', true, 1), flash('ev', 'de_tr', false, 2)])).toEqual([
      'vocab:ev:de_tr',
    ]);
  });

  it('lessonSummary: letzte Antwort gleich welcher Richtung', () => {
    const items = allItems(units).filter((i) => i.lessonId === 'a1-u01-l1');
    const flashes = [
      flash('merhaba', 'tr_de', true, 1),
      flash('evet', 'tr_de', true, 1),
      flash('evet', 'de_tr', false, 2),
    ];
    expect(lessonSummary(items, flashes)).toEqual({ total: 3, known: 1, wrong: 1 });
  });

  it('shuffle lässt die Eingabe unverändert', () => {
    const list = [1, 2, 3];
    expect(shuffle(list, seq(0)).sort()).toEqual([1, 2, 3]);
    expect(list).toEqual([1, 2, 3]);
  });
});

describe('Formkarten', () => {
  // merhaba/evet/hayır (a1-u01) und dün (a2-u01) als Formwörter; Plural ab a1-u01-l2,
  // Dativ erst ab a2-u01-l1, Präsens ist unbekannt.
  const forms = {
    intro: { 'noun:PL': 'a1-u01-l2', 'noun:DAT': 'a2-u01-l1' },
    nouns: ['evet', 'dün'],
    verbs: ['hayır'],
  };
  const formRefs = (s: Partial<Selection>, st: Partial<DeckState> = {}) =>
    deckFor(units, sel({ content: 'form', ...s }), state({ forms, ...st })).map(
      (c) => `${c.ref}@${c.lessonId}:${c.dir}`,
    );

  it('je Muster in der späteren Lektion von Wort und Muster, Richtung immer de_tr', () => {
    expect(formRefs({ scope: { scope: 'level', level: 'A1' }, dir: 'tr_de' })).toEqual([
      'evet|noun:PL@a1-u01-l2:de_tr',
    ]);
    expect(formRefs({ scope: { scope: 'level', level: 'A2' }, dir: 'mixed' })).toEqual([
      'evet|noun:DAT@a2-u01-l1:de_tr',
      'dün|noun:PL@a2-u01-l1:de_tr',
      'dün|noun:DAT@a2-u01-l1:de_tr',
    ]);
  });

  it('„Wörter und Sätze“ enthält keine Formen; ohne Index keine Formkarten', () => {
    const both = deckFor(units, sel({ content: 'both' }), state({ forms }));
    expect(both.some((c) => c.kind === 'form')).toBe(false);
    expect(deckFor(units, sel({ content: 'form' }), state())).toEqual([]);
  });

  it('Falsch-Stapel nimmt Formkarten unabhängig von der gewählten Richtung', () => {
    const flashes: Flash[] = [
      { kind: 'form', ref: 'evet|noun:PL', dir: 'de_tr', correct: false, mode: 'type', at: 1 },
    ];
    expect(formRefs({ scope: { scope: 'wrong' }, dir: 'tr_de' }, { flashes })).toEqual([
      'evet|noun:PL@a1-u01-l2:de_tr',
    ]);
  });
});
