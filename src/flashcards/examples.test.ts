import { describe, expect, it } from 'vitest';
import type { Exercise, Lesson, Level, Unit, Vocab } from '../content/schema';
import { buildLookup } from '../lookup/index-build';
import { prepareLookup } from '../lookup/search';
import { examplePool, phraseTokens, vocabExamples } from './examples';

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
const unit = (id: string, level: Level, vocab: Vocab[], lessons: Lesson[]): Unit =>
  ({
    id,
    level,
    title: id,
    reviewed: false,
    lessons,
    vocab,
    source: 's',
    license: 'l',
  }) as Unit;
const wb = (id: string, prompt: string, answer: string): Exercise =>
  ({ id, type: 'word_bank', prompt, answers: [answer] }) as Exercise;
const tr = (id: string, prompt: string, answer: string): Exercise =>
  ({ id, type: 'free_text', direction: 'tr_de', prompt, answers: [answer] }) as Exercise;

const prep = (units: Unit[]) => prepareLookup(buildLookup(units, new Map()));
const pick = (units: Unit[]) => {
  const { examples, errors } = vocabExamples(units, prep(units));
  return {
    errors,
    from: Object.fromEntries(
      [...examples.values()].flatMap((m) => [...m].map(([id, e]) => [id, e.from])),
    ),
  };
};

describe('vocabExamples', () => {
  it('eigene Unit vor späterer, Übungssatz vor Lesetext, nur ganze Sätze mit mehr als dem Wort', () => {
    const units = [
      unit(
        'a1-u01',
        'A1',
        [v('ev', 'noun'), v('büyük', 'adj'), v('kitap', 'noun')],
        [
          lesson('a1-u01-l1', 'vocab', [
            wb('a1-u01-l1-e1', 'Haus', 'ev'),
            wb('a1-u01-l1-e2', 'Groß.', 'Büyük.'),
            wb('a1-u01-l1-e3', 'Das Haus ist groß', 'Ev büyük'),
          ]),
          {
            ...lesson('a1-u01-r1', 'reading', [wb('a1-u01-r1-e1', 'Ein Buch.', 'Bir kitap.')]),
            passage: { sentences: [{ tr: 'Ev büyük.', de: 'Das Haus ist groß.' }] },
          },
        ],
      ),
      unit(
        'a1-u02',
        'A1',
        [v('bir', 'num')],
        [lesson('a1-u02-l1', 'vocab', [tr('a1-u02-l1-e1', 'Bir ev büyük.', 'Ein Haus ist groß.')])],
      ),
    ];
    // ev/büyük: Lesetext-Satz der eigenen Unit vor dem Übungssatz der nächsten Unit; e3 hat
    // kein Satzzeichen, e2 nur ein Wort. kitap: Übungssatz vor nichts. bir: Satz aus u01 zählt
    // nicht (früher als das Wort), u02 hat einen.
    expect(pick(units).from).toEqual({
      ev: 'a1-u01-r1-p1',
      büyük: 'a1-u01-r1-p1',
      kitap: 'a1-u01-r1-e1',
      bir: 'a1-u02-l1-e1',
    });
  });

  it('höchstens ein Niveau über dem Wort; weit weg gewinnt die Nähe', () => {
    const filler = (n: number, level: Level) =>
      unit(
        `${level.toLocaleLowerCase('tr')}-u0${n}`,
        level,
        [],
        [
          lesson(`${level.toLocaleLowerCase('tr')}-u0${n}-l1`, 'vocab', [
            wb(`${level.toLocaleLowerCase('tr')}-u0${n}-l1-e1`, 'x', 'x'),
          ]),
        ],
      );
    const units = [
      unit(
        'a1-u01',
        'A1',
        [v('ev', 'noun'), v('büyük', 'adj')],
        [lesson('a1-u01-l1', 'vocab', [wb('a1-u01-l1-e1', 'Haus', 'ev')])],
      ),
      filler(2, 'A1'),
      filler(3, 'A1'),
      filler(4, 'A1'),
      unit(
        'a1-u05',
        'A1',
        [],
        [
          lesson('a1-u05-l1', 'vocab', [
            wb(
              'a1-u05-l1-e1',
              'Das Haus ist sehr sehr sehr sehr sehr groß.',
              'Ev çok çok çok çok çok büyük.',
            ),
          ]),
        ],
      ),
      unit(
        'a2-u01',
        'A2',
        [],
        [lesson('a2-u01-l1', 'vocab', [wb('a2-u01-l1-e1', 'Das Haus ist groß.', 'Ev büyük.')])],
      ),
      unit(
        'b1-u01',
        'B1',
        [v('çok', 'adv')],
        [lesson('b1-u01-l1', 'vocab', [wb('b1-u01-l1-e1', 'Ein großes Haus.', 'Büyük bir ev.')])],
      ),
    ];
    const { from } = pick(units);
    // a1-u05 ist näher als a2-u01, auch wenn der Satz länger ist; B1 ist zu weit über A1.
    expect(from.ev).toBe('a1-u05-l1-e1');
    expect(from.büyük).toBe('a1-u05-l1-e1');
  });

  it('Feld example erzwingt oder unterdrückt; falsche Quelle ist ein Fehler', () => {
    const base = (vocab: Vocab[]) => [
      unit('a1-u01', 'A1', vocab, [
        lesson('a1-u01-l1', 'vocab', [
          wb('a1-u01-l1-e1', 'Das Haus ist groß.', 'Ev büyük.'),
          wb('a1-u01-l1-e2', 'Mein großes Haus ist sehr schön.', 'Büyük evim çok güzel.'),
        ]),
      ]),
    ];
    const words = [v('büyük', 'adj'), v('çok', 'adv'), v('güzel', 'adj')];
    expect(pick(base([v('ev', 'noun', { example: 'a1-u01-l1-e2' }), ...words])).from.ev).toBe(
      'a1-u01-l1-e2',
    );
    expect(pick(base([v('ev', 'noun', { example: false }), ...words])).from.ev).toBeUndefined();
    expect(pick(base([v('ev', 'noun', { example: 'a1-u01-l1-e9' }), ...words])).errors).toEqual([
      'a1-u01: Vokabel ev: example a1-u01-l1-e9 ist kein Beispielsatz mit diesem Wort',
    ]);
  });

  it('höchstens ein unbekanntes Wort; Sätze mit allen Wörtern aufgelöst gehen vor', () => {
    const units = [
      unit(
        'a1-u01',
        'A1',
        [v('ev', 'noun'), v('var', 'adj')],
        [
          lesson('a1-u01-l1', 'vocab', [
            wb('a1-u01-l1-e1', 'Gibt es ein Haus?', 'Ev var mı?'),
            wb('a1-u01-l1-e2', 'Es gibt ein Haus.', 'Ev var.'),
            wb('a1-u01-l1-e3', 'Xyz qwe Haus.', 'Xyz qwe ev.'),
          ]),
        ],
      ),
    ];
    const pool = examplePool(units, prep(units));
    expect(pool.map((c) => [c.from, c.unknown])).toEqual([
      ['a1-u01-l1-e1', 1],
      ['a1-u01-l1-e2', 0],
    ]);
    expect(pick(units).from.ev).toBe('a1-u01-l1-e2');
  });
});

describe('phraseTokens', () => {
  it('Wörter der ersten Antwort, aufgelöst wie im Lesetext', () => {
    const u = unit(
      'a1-u01',
      'A1',
      [v('ev', 'noun'), v('büyük', 'adj')],
      [lesson('a1-u01-l1', 'vocab', [wb('a1-u01-l1-e1', 'Das Haus ist groß.', 'Evim büyük.')])],
    );
    const tokens = phraseTokens(u, ['a1-u01-l1-e1'], prep([u])).get('a1-u01-l1-e1');
    expect(tokens).toEqual([
      { text: 'Evim', w: true, vocab: 'ev' },
      { text: ' ' },
      { text: 'büyük', w: true, vocab: 'büyük' },
      { text: '.' },
    ]);
  });
});
