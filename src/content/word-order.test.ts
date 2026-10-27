import { describe, expect, it } from 'vitest';
import { Unit, type Exercise } from './schema';
import {
  caseHints,
  display,
  ORDER_SENTENCES,
  orderExercise,
  wordOrderLesson,
  withWordOrder,
} from './word-order';

type WordBank = Extract<Exercise, { type: 'word_bank' }>;

const tea = {
  id: 'a1-u08-l5-e1',
  type: 'word_bank',
  prompt: 'Ich trinke jeden Morgen Tee.',
  answers: ['Her sabah çay içiyorum.'],
  chunks: [
    { text: 'Her sabah', role: 'time' },
    { text: 'çay', role: 'object_bare' },
    { text: 'içiyorum', role: 'predicate' },
  ],
  reviewed: true,
} satisfies WordBank;

const ahmet = {
  id: 'a1-u08-l5-e2',
  type: 'word_bank',
  prompt: 'Ahmet geht zur Schule.',
  answers: ['Ahmet okula gidiyor.'],
  chunks: [
    { text: 'Ahmet', role: 'subject' },
    { text: 'okula', role: 'place' },
    { text: 'gidiyor', role: 'predicate' },
  ],
  orders: [{ order: [1, 0, 2], note: 'betont Ahmet' }],
} satisfies WordBank;

function makeUnit(exercises: Exercise[]): Unit {
  return Unit.parse({
    id: 'a1-u08',
    level: 'A1',
    title: 'Alltag',
    source: 's',
    license: 'l',
    vocab: [{ tr: 'her', de: ['jeder'], pos: 'adj' }],
    lessons: [
      { id: 'a1-u08-l5', type: 'dialog', title: 'D', exercises },
      {
        id: 'a1-u08-l6',
        type: 'review',
        title: 'W',
        exercises: [
          {
            id: 'a1-u08-l6-e1',
            type: 'free_text',
            direction: 'de_tr',
            prompt: 'x',
            answers: ['ev'],
          },
        ],
      },
    ],
  });
}

describe('caseHints und display', () => {
  const unit = makeUnit([
    tea,
    ahmet,
    {
      id: 'a1-u08-l5-e9',
      type: 'word_bank',
      prompt: 'p',
      answers: ['Bugün Ahmet geliyor. Burada kal!'],
    },
  ]);
  const hints = caseHints([unit]);

  it('Namen mitten im Satz, nicht nach einem Satzende', () => {
    expect(hints.names.has('Ahmet')).toBe(true);
    expect(hints.names.has('Burada')).toBe(false);
    expect(hints.lower.has('okula')).toBe(true);
  });

  it('schreibt das erste Wort klein, außer Namen, Apostroph-Formen und Unbekanntes', () => {
    expect(display('Her sabah', hints)).toBe('her sabah');
    expect(display('Herkese', hints)).toBe('herkese'); // Form der Vokabel her
    expect(display('Ahmet', hints)).toBe('Ahmet');
    expect(display("İstanbul'daki arkadaşım", hints)).toBe("İstanbul'daki arkadaşım");
    expect(display("1990'da", hints)).toBe("1990'da");
    expect(display('Zeynep', hints)).toBe('Zeynep');
  });
});

describe('orderExercise', () => {
  const hints = caseHints([makeUnit([tea, ahmet])]);

  it('übernimmt Satz, Prompt, Varianten und Prüfstand; erstes Wort klein', () => {
    expect(orderExercise('a1-u08-s1', 'a1-u08', tea, hints)).toEqual({
      id: 'a1-u08-s1-l5-e1',
      type: 'sov_puzzle',
      prompt: 'Ich trinke jeden Morgen Tee.',
      text: 'Her sabah çay içiyorum.',
      chunks: [
        { text: 'her sabah', role: 'time' },
        { text: 'çay', role: 'object_bare' },
        { text: 'içiyorum', role: 'predicate' },
      ],
      from: 'a1-u08-l5-e1',
      reviewed: true,
    });
  });

  it('Namen am Satzanfang bleiben groß', () => {
    const ex = orderExercise('a1-u08-s1', 'a1-u08', ahmet, hints);
    expect(ex.chunks[0]!.text).toBe('Ahmet');
    expect(ex.orders).toEqual(ahmet.orders);
  });
});

describe('wordOrderLesson', () => {
  const bank = (n: number): WordBank => ({
    ...tea,
    id: `a1-u08-l5-e${n}`,
    answers: [`Her sabah çay${n} içiyorum.`],
    chunks: [
      { text: 'Her sabah', role: 'time' },
      { text: `çay${n}`, role: 'object_bare' },
      { text: 'içiyorum', role: 'predicate' },
    ],
  });

  it('nimmt nur annotierte Sätze, höchstens ORDER_SENTENCES', () => {
    const plain: WordBank = {
      id: 'a1-u08-l5-e99',
      type: 'word_bank',
      prompt: 'p',
      answers: ['a b c'],
    };
    const lesson = wordOrderLesson(
      makeUnit([plain, ...Array.from({ length: 12 }, (_, i) => bank(i + 1))]),
      'Satzbau',
      caseHints([]),
    )!;
    expect(lesson).toMatchObject({ id: 'a1-u08-s1', type: 'word_order', title: 'Satzbau' });
    expect(lesson.exercises).toHaveLength(ORDER_SENTENCES);
    expect(lesson.exercises.every((e) => e.type === 'sov_puzzle')).toBe(true);
  });

  it('fügt die Lektion vor der Wiederholung ein; ohne Annotation keine Lektion', () => {
    const unit = withWordOrder(makeUnit([tea]), 'Satzbau', caseHints([]));
    expect(unit.lessons.map((l) => l.id)).toEqual(['a1-u08-l5', 'a1-u08-s1', 'a1-u08-l6']);
    const plain = makeUnit([
      { id: 'a1-u08-l5-e1', type: 'word_bank', prompt: 'p', answers: ['x'] },
    ]);
    expect(withWordOrder(plain, 'Satzbau', caseHints([]))).toBe(plain);
  });
});
