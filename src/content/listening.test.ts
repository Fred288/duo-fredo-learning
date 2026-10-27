import { describe, expect, it } from 'vitest';
import {
  DICTATION_MAX_WORDS,
  LISTEN_SENTENCES,
  LISTEN_WORDS,
  listeningLesson,
  withListening,
} from './listening';
import { Unit, type Exercise, type Vocab } from './schema';

type Listen = Extract<Exercise, { type: 'listen' }>;

const NUMBERS = ['bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz', 'on'];
const GERMAN = ['eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn'];

const vocab: Vocab[] = NUMBERS.map((tr, i) => ({ tr, de: [GERMAN[i]!], pos: 'num' }));

const bank = (n: number, answer: string, prompt = `Satz ${n}`, lesson = 'l2'): Exercise => ({
  id: `a1-u05-${lesson}-e${n}`,
  type: 'word_bank',
  prompt,
  answers: [answer, `${answer} da`],
  distractors: ['ev'],
});

function makeUnit(banks: Exercise[], extra: Partial<Unit> = {}): Unit {
  return Unit.parse({
    id: 'a1-u05',
    level: 'A1',
    title: 'Zahlen',
    source: 's',
    license: 'l',
    vocab: [...vocab, { tr: '-de', de: ['in'], pos: 'particle' }],
    lessons: [
      { id: 'a1-u05-l1', type: 'vocab', title: 'V', exercises: [bank(99, 'on bir', 'elf', 'l1')] },
      { id: 'a1-u05-l2', type: 'dialog', title: 'D', exercises: banks },
      {
        id: 'a1-u05-l3',
        type: 'review',
        title: 'W',
        exercises: [bank(98, 'yüz', 'hundert', 'l3')],
      },
    ],
    ...extra,
  });
}

const sentences = Array.from({ length: 20 }, (_, i) =>
  bank(i + 1, `${NUMBERS[i % 10]} ${i < 10 ? 'kedi' : 'büyük güzel kedi var'}`),
);

describe('Hörlektion aus vorhandenen Inhalten', () => {
  const unit = makeUnit(sentences);
  const lesson = listeningLesson(unit, 'Hören')!;
  const exercises = lesson.exercises as Listen[];

  it('ist schema-gültig und steht vor der Wiederholung', () => {
    const out = withListening(unit, 'Hören');
    expect(() => Unit.parse(out)).not.toThrow();
    expect(out.lessons.map((l) => l.id)).toEqual([
      'a1-u05-l1',
      'a1-u05-l2',
      'a1-u05-h1',
      'a1-u05-l3',
    ]);
    expect(lesson).toMatchObject({ id: 'a1-u05-h1', type: 'listening', title: 'Hören' });
  });

  it('Vokabeln: Bedeutung wählen, Suffix-Vokabeln fallen weg', () => {
    const words = exercises.filter((e) => e.from && !e.from.startsWith('a1-'));
    expect(words).toHaveLength(LISTEN_WORDS);
    for (const e of words) {
      expect(e.mode).toBe('meaning');
      expect(e.id).toBe(`a1-u05-h1-v-${e.from}`);
      expect(e.options).toContain(e.answer);
      expect(e.answer).toBe(GERMAN[NUMBERS.indexOf(e.text)]);
    }
    expect(words.some((e) => e.text === '-de')).toBe(false);
  });

  it('Sätze: erste Antwort ist der Text, IDs aus der Quelle, Obergrenze', () => {
    const fromBank = exercises.filter((e) => e.from?.startsWith('a1-'));
    expect(fromBank).toHaveLength(LISTEN_SENTENCES);
    for (const e of fromBank) {
      const src = [
        ...sentences,
        bank(99, 'on bir', 'elf', 'l1'),
        bank(98, 'yüz', 'hundert', 'l3'),
      ].find((s) => s.id === e.from) as Extract<Exercise, { type: 'word_bank' }>;
      expect(e.text).toBe(src.answers[0]);
      expect(e.gloss_de).toBe(src.prompt);
      expect(e.id).toBe(`a1-u05-h1-${src.id.slice('a1-u05-'.length)}`);
      if (e.mode === 'dictation') {
        expect(e.text.split(' ').length).toBeLessThanOrEqual(DICTATION_MAX_WORDS);
      }
      if (e.mode === 'tiles') expect(e.distractors).toEqual(['ev']);
      if (e.mode === 'meaning') {
        expect(e.answer).toBe(src.prompt);
        expect(new Set(e.options).size).toBe(e.options!.length);
      }
    }
    expect(new Set(fromBank.map((e) => e.mode)).size).toBeGreaterThan(1);
  });

  it('ist deterministisch, und neue Übungen verdrängen höchstens einzelne', () => {
    expect(listeningLesson(makeUnit(sentences), 'Hören')).toEqual(lesson);
    const more = makeUnit([...sentences, bank(21, 'iki büyük kedi'), bank(22, 'üç küçük kedi')]);
    const before = new Set(exercises.map((e) => e.id));
    const after = listeningLesson(more, 'Hören')!.exercises.map((e) => e.id);
    expect(after.filter((id) => !before.has(id)).length).toBeLessThanOrEqual(2);
  });

  it('gleiche Sätze nur einmal; Ablenker sind nie eine Lösung desselben Satzes', () => {
    const dup = makeUnit([bank(1, 'bir kedi', 'eine Katze'), bank(2, 'bir kedi', 'eine Katze!')]);
    const listen = listeningLesson(dup, 'Hören')!.exercises.filter((e) => e.id.includes('-l2-'));
    expect(listen).toHaveLength(1);
    const only = listen[0] as Listen;
    if (only.mode === 'meaning') expect(only.options).not.toContain('eine Katze!');
  });

  it('übernimmt Prüfstand und Register der Quelle', () => {
    const reviewed = makeUnit([{ ...bank(1, 'bir kedi'), reviewed: true, register: 'formal' }]);
    const e = listeningLesson(reviewed, 'Hören')!.exercises.find((x) => x.id.includes('-l2-'))!;
    expect(e).toMatchObject({ reviewed: true, register: 'formal' });
  });

  it('eine handgeschriebene Hörlektion bleibt unangetastet; ohne Material keine Lektion', () => {
    const own = makeUnit(sentences);
    own.lessons.push({
      id: 'a1-u05-h1',
      type: 'listening',
      title: 'Eigene',
      exercises: [{ id: 'a1-u05-h1-e1', type: 'listen', mode: 'dictation', text: 'bir' }],
    });
    expect(withListening(own, 'Hören')).toBe(own);
    const free: Exercise = {
      id: 'a1-u05-l2-e1',
      type: 'free_text',
      direction: 'de_tr',
      prompt: 'x',
      answers: ['y'],
    };
    const empty = makeUnit([free], { vocab: [] });
    empty.lessons = empty.lessons.filter((l) => l.id === 'a1-u05-l2');
    expect(withListening(empty, 'Hören')).toBe(empty);
  });
});

describe('Schema Hörübung', () => {
  const parse = (ex: object) =>
    Unit.safeParse({
      id: 'a1-u05',
      level: 'A1',
      title: 'T',
      source: 's',
      license: 'l',
      lessons: [
        {
          id: 'a1-u05-h1',
          type: 'listening',
          title: 'H',
          exercises: [{ id: 'a1-u05-h1-e1', type: 'listen', ...ex }],
        },
      ],
    }).success;

  it('meaning braucht options mit answer, die anderen Modi keine', () => {
    expect(parse({ mode: 'meaning', text: 'bir', options: ['eins', 'zwei'], answer: 'eins' })).toBe(
      true,
    );
    expect(parse({ mode: 'meaning', text: 'bir', options: ['eins', 'zwei'], answer: 'drei' })).toBe(
      false,
    );
    expect(parse({ mode: 'meaning', text: 'bir' })).toBe(false);
    expect(parse({ mode: 'meaning', text: 'bir', options: ['eins', 'eins'], answer: 'eins' })).toBe(
      false,
    );
    expect(parse({ mode: 'tiles', text: 'bir kedi', distractors: ['ev'] })).toBe(true);
    expect(
      parse({ mode: 'dictation', text: 'bir', options: ['eins', 'zwei'], answer: 'eins' }),
    ).toBe(false);
    expect(parse({ mode: 'tiles', text: 'bir', unknown: 1 })).toBe(false);
  });
});
