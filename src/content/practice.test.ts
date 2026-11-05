import { describe, expect, it } from 'vitest';
import { buildLookup } from '../lookup/index-build';
import { prepareLookup } from '../lookup/search';
import { withTexts } from './practice';
import { Unit, type PracticeText, type Vocab } from './schema';

const v = (tr: string, pos: Vocab['pos'], extra: Partial<Vocab> = {}): Vocab => ({
  tr,
  de: [tr],
  pos,
  ...extra,
});
const unit = (id: string, vocab: Vocab[], texts?: PracticeText[]): Unit =>
  ({
    id,
    level: 'A1',
    title: id,
    reviewed: false,
    lessons: [],
    vocab,
    texts,
    source: 's',
    license: 'l',
  }) as Unit;
const text = (id: string, ...tr: string[]): PracticeText => ({
  id,
  title: 'Titel',
  sentences: tr.map((s) => ({ tr: s, de: s })),
});

const units = [
  unit('a1-u01', [v('ev', 'noun'), v('büyük', 'adj'), v('bu', 'pron')]),
  unit('a1-u02', [v('kitap', 'noun', { softens: true })]),
];
const prepared = prepareLookup(buildLookup(units, new Map()));

describe('withTexts', () => {
  it('löst auf wie ein Lesetext, auch gebeugte Formen', () => {
    const u = unit('a1-u02', [], [text('a1-u02-t1', 'Bu ev büyük.', 'Evde kitap.', 'Kitabı.')]);
    const out = withTexts(u, prepared);
    expect(out.errors).toEqual([]);
    expect(out.warnings).toEqual([]);
    const words = out.unit.texts![0]!.tokens!.flat().filter((t) => t.w);
    expect(words.map((t) => t.vocab)).toEqual(['bu', 'ev', 'büyük', 'ev', 'kitap', 'kitap']);
  });

  it('unbekannte Wörter und Wörter späterer Units sind Fehler', () => {
    const u = unit('a1-u01', [], [text('a1-u01-t1', 'Bu kitap.', 'Ev araba.', 'Ev.')]);
    expect(withTexts(u, prepared).errors).toEqual([
      'a1-u01-t1: Wort unbekannt (Vokabel, Engine-Form oder glossary): araba',
      'a1-u01-t1: Wort aus einer späteren Unit: kitap (a1-u02)',
    ]);
  });

  it('Glossar erlaubt Namen; Satzzahl außerhalb des Niveaus ist eine Warnung', () => {
    const t = {
      ...text('a1-u01-t1', "Ayşe'nin ev büyük."),
      glossary: [{ tr: 'Ayşe', de: 'Ayşe (Name)' }],
    };
    const out = withTexts(unit('a1-u01', [], [t]), prepared);
    expect(out.errors).toEqual([]);
    expect(out.warnings).toEqual(['a1-u01-t1: 1 Sätze, für A1 sind 3–5 vorgesehen']);
  });
});

describe('Schema', () => {
  const base = { ...unit('a1-u01', []), lessons: [] };
  const parse = (texts: PracticeText[]) =>
    Unit.safeParse({
      ...base,
      lessons: [
        {
          id: 'a1-u01-l1',
          type: 'vocab',
          title: 't',
          exercises: [
            {
              id: 'a1-u01-l1-e1',
              type: 'multiple_choice',
              prompt: 'p',
              options: ['a', 'b'],
              answer: 'a',
            },
          ],
        },
      ],
      texts,
    });

  it('Text-ID gehört zur Unit und ist eindeutig', () => {
    expect(parse([text('a1-u01-t1', 'Ev.')]).success).toBe(true);
    expect(parse([text('a1-u02-t1', 'Ev.')]).success).toBe(false);
    expect(parse([text('a1-u01-t1', 'Ev.'), text('a1-u01-t1', 'Ev.')]).success).toBe(false);
    expect(parse([{ ...text('a1-u01-t1', 'Ev.'), extra: 1 } as PracticeText]).success).toBe(false);
  });
});
