import { describe, expect, it } from 'vitest';
import type { Exercise, Lesson, Unit, Vocab } from '../content/schema';
import { buildLookup } from '../lookup/index-build';
import { prepareLookup } from '../lookup/search';
import { checkCardFields, lessonVocab, phraseCards } from './build';

const v = (tr: string, pos: Vocab['pos'], extra: Partial<Vocab> = {}): Vocab => ({
  tr,
  de: [tr],
  pos,
  ...extra,
});
const lesson = (id: string, type: Lesson['type'], exercises: Exercise[]): Lesson => ({
  id,
  type,
  title: id,
  exercises,
});
const unit = (id: string, vocab: Vocab[], lessons: Lesson[]): Unit =>
  ({
    id,
    level: 'A1',
    title: id,
    reviewed: false,
    lessons,
    vocab,
    source: 's',
    license: 'l',
  }) as Unit;
const wb = (id: string, prompt: string, answer: string, extra: object = {}): Exercise =>
  ({ id, type: 'word_bank', prompt, answers: [answer], ...extra }) as Exercise;
const ft = (id: string, prompt: string, answer: string, extra: object = {}): Exercise =>
  ({ id, type: 'free_text', direction: 'de_tr', prompt, answers: [answer], ...extra }) as Exercise;

describe('lessonVocab', () => {
  const u = unit(
    'a1-u02',
    [
      v('kitap', 'noun', { softens: true }),
      v('okumak', 'verb'),
      v('hafta sonu', 'noun'),
      v('iyi akşamlar dilerim', 'phrase'),
      v('kalem', 'noun'),
      v('su', 'noun', { lesson: 'a1-u02-l3' }),
    ],
    [
      lesson('a1-u02-l1', 'vocab', [ft('a1-u02-l1-e1', 'Ich lese.', 'Okuyorum.')]),
      lesson('a1-u02-l2', 'grammar', [
        {
          id: 'a1-u02-l2-e1',
          type: 'suffix_builder',
          stem: 'kitap',
          suffixes: ['ACC'],
          target: 'kitabı',
        } as Exercise,
        wb('a1-u02-l2-e2', 'Am Wochenende.', 'Hafta sonu.'),
      ]),
      lesson('a1-u02-l3', 'dialog', [wb('a1-u02-l3-e1', 'Gruß', 'İyi akşamlar dilerim!')]),
      lesson('a1-u02-r1', 'review', [ft('a1-u02-r1-e1', 'Stift', 'kalem')]),
    ],
  );
  const prepared = prepareLookup(buildLookup([u], new Map()));
  const got = lessonVocab(u, prepared);

  it('ordnet jedes Wort der ersten Lektion zu, in der es (auch gebeugt) vorkommt', () => {
    expect(got.get('a1-u02-l2')).toEqual(['kitap', 'hafta sonu']);
    expect(got.get('a1-u02-l3')).toEqual(['iyi akşamlar dilerim', 'su']);
  });

  it('ohne Fundstelle zur ersten Vokabel-Lektion; Wiederholung zählt nicht', () => {
    expect(got.get('a1-u02-l1')).toEqual(['okumak', 'kalem']);
    expect(got.has('a1-u02-r1')).toBe(false);
  });

  it('jede Vokabel genau einmal', () => {
    expect([...got.values()].flat().sort()).toEqual((u.vocab ?? []).map((x) => x.tr).sort());
  });
});

describe('phraseCards', () => {
  const units = [
    unit(
      'a1-u01',
      [v('merhaba', 'interj')],
      [
        lesson('a1-u01-l1', 'vocab', [
          wb('a1-u01-l1-e1', 'Hallo!', 'Merhaba!'),
          wb('a1-u01-l1-e2', 'Wie geht es dir?', 'Nasılsın?'),
          ft('a1-u01-l1-e3', 'neben mir', 'yanımda'),
          ft('a1-u01-l1-e4', 'Ich bin müde.', 'Yorgunum.', { card: false }),
          wb(
            'a1-u01-l1-e5',
            'Das ist ein sehr langer Satz mit vielen Wörtern hier.',
            'Bu çok uzun bir cümle ve çok kelime var burada.',
          ),
        ]),
        lesson('a1-u01-l2', 'grammar', [
          wb('a1-u01-l2-e1', 'Ich gehe.', 'Gidiyorum.'),
          wb('a1-u01-l2-e2', 'Ich komme.', 'Geliyorum.', { card: true }),
        ]),
      ],
    ),
    unit(
      'a1-u02',
      [],
      [lesson('a1-u02-l1', 'dialog', [wb('a1-u02-l1-e1', 'Wie geht’s?', 'Nasılsın?')])],
    ),
  ];
  const got = phraseCards(units);

  it('nimmt kurze Sätze aus Vokabel- und Dialog-Lektionen, keine Wörter oder Glossen', () => {
    expect(got.get('a1-u01')?.get('a1-u01-l1')).toEqual(['a1-u01-l1-e2']);
  });

  it('card: true nimmt auch Grammatik-Sätze, card: false schließt aus', () => {
    expect(got.get('a1-u01')?.get('a1-u01-l2')).toEqual(['a1-u01-l2-e2']);
  });

  it('gleicher Satz nur beim ersten Vorkommen', () => {
    expect(got.get('a1-u02')?.size).toBe(0);
  });
});

describe('checkCardFields', () => {
  it('meldet unbekannte Lektion und card bei tr_de', () => {
    const u = unit(
      'a1-u01',
      [v('ev', 'noun', { lesson: 'a1-u01-l9' })],
      [
        lesson('a1-u01-l1', 'vocab', [
          {
            id: 'a1-u01-l1-e1',
            type: 'free_text',
            direction: 'tr_de',
            prompt: 'ev',
            answers: ['Haus'],
            card: true,
          } as Exercise,
        ]),
      ],
    );
    expect(checkCardFields(u)).toEqual([
      'Vokabel ev: lesson a1-u01-l9 gibt es in a1-u01 nicht',
      'a1-u01-l1-e1: card nur bei direction de_tr',
    ]);
  });
});
