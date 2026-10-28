import { describe, expect, it } from 'vitest';
import { buildLookup } from '../lookup/index-build';
import { prepareLookup } from '../lookup/search';
import { annotatePassage, checkGlossary, readingResolver, tokenize, withPassages } from './reading';
import { Lesson, type Unit, type Vocab } from './schema';

const v = (tr: string, pos: Vocab['pos'], extra: Partial<Vocab> = {}): Vocab => ({
  tr,
  de: [tr],
  pos,
  ...extra,
});
const unit = (id: string, vocab: Vocab[], lessons: Unit['lessons'] = []): Unit =>
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

const units = [
  unit('a1-u01', [
    v('ev', 'noun'),
    v('ol', 'verb', { tr: 'olmak' }),
    v('Ankara', 'noun', { proper: true }),
    v('altı', 'num'),
  ]),
  unit('a1-u02', [
    v('kitap', 'noun', { softens: true }),
    v('hafta sonu', 'noun'),
    v('ölmek', 'verb'),
    v('gitmek', 'verb', { softens: true }),
    v('alt', 'noun'),
  ]),
  unit('a1-u03', [v('ev', 'noun', { id: 'ev-spaet' })]),
];
const prepared = prepareLookup(buildLookup(units, new Map()));

describe('tokenize', () => {
  it('trennt Wörter und Lücken, zusammen ergeben sie den Satz', () => {
    const s = "Ayşe'yle Ankara'ya gittik, değil mi?";
    const parts = tokenize(s);
    expect(parts.map((p) => p.text).join('')).toBe(s);
    expect(parts.filter((p) => p.word).map((p) => p.text)).toEqual([
      "Ayşe'yle",
      "Ankara'ya",
      'gittik',
      'değil',
      'mi',
    ]);
  });
});

describe('readingResolver', () => {
  const r = readingResolver(prepared, 'a1-u02', [
    { tr: 'Ayşe', de: 'Ayşe (Name)' },
    { tr: 'güzeldi', de: 'war schön', vocab: 'ev' },
  ]);

  it('löst Grundform, gebeugte Form, Eigenname mit Apostroph und Glossar auf', () => {
    expect(r.resolve('Ev')).toEqual({ vocab: 'ev' });
    expect(r.resolve('kitabı')).toEqual({ vocab: 'kitap' });
    expect(r.resolve('gittik')).toEqual({ vocab: 'gitmek' });
    expect(r.resolve("Ankara'ya")).toEqual({ vocab: 'Ankara' });
    expect(r.resolve("Ayşe'yle")).toEqual({ gloss: 'Ayşe (Name)' });
    expect(r.resolve('güzeldi')).toEqual({ gloss: 'war schön', vocab: 'ev' });
    expect(r.resolve('2026')).toEqual({});
    expect(r.resolve('bilmiyorum')).toBeUndefined();
  });

  it('unterscheidet Sonderzeichen (ölür ist nicht olur)', () => {
    expect(r.resolve('ölür')?.vocab).toBe('ölmek');
  });

  it('bevorzugt die eigene, sonst die nächstfrühere Unit', () => {
    expect(readingResolver(prepared, 'a1-u03').resolve('altında')).toEqual({ vocab: 'alt' });
    expect(readingResolver(prepared, 'a1-u03').resolve('evde')).toEqual({ vocab: 'ev-spaet' });
    expect(readingResolver(prepared, 'a1-u02').resolve('evde')).toEqual({ vocab: 'ev' });
  });
});

describe('annotatePassage', () => {
  it('fasst Mehrwort-Vokabeln zusammen und meldet Unbekanntes', () => {
    const resolver = readingResolver(prepared, 'a1-u02');
    const { passage, unknown } = annotatePassage(
      { sentences: [{ tr: 'Hafta sonu evde kitap, tabii.', de: '…' }] },
      resolver,
    );
    expect(passage.tokens).toEqual([
      [
        { text: 'Hafta sonu', w: true, vocab: 'hafta sonu' },
        { text: ' ' },
        { text: 'evde', w: true, vocab: 'ev' },
        { text: ' ' },
        { text: 'kitap', w: true, vocab: 'kitap' },
        { text: ', ' },
        { text: 'tabii', w: true },
        { text: '.' },
      ],
    ]);
    expect(unknown).toEqual(['tabii']);
  });

  it('nimmt keine Gruppe über Satzzeichen hinweg', () => {
    const { passage } = annotatePassage(
      { sentences: [{ tr: 'hafta, sonu', de: '…' }] },
      readingResolver(prepared, 'a1-u02'),
    );
    expect(passage.tokens![0]!.filter((t) => t.w).map((t) => t.text)).toEqual(['hafta', 'sonu']);
  });
});

describe('withPassages und checkGlossary', () => {
  const lesson = Lesson.parse({
    id: 'a1-u02-r1',
    type: 'reading',
    title: 'Lesetext',
    passage: {
      sentences: [{ tr: 'Evde kitap var.', de: 'Zu Hause gibt es ein Buch.' }],
      glossary: [{ tr: 'var', de: 'es gibt', vocab: 'varmak' }],
    },
    exercises: [
      {
        id: 'a1-u02-r1-e1',
        type: 'multiple_choice',
        prompt: 'Was?',
        options: ['a', 'b'],
        answer: 'a',
      },
    ],
  });

  it('schreibt Tokens in die Lektion und warnt mit Fundstelle', () => {
    const u = unit('a1-u02', [], [lesson]);
    const { unit: out, warnings } = withPassages(u, prepared);
    expect(out.lessons[0]!.passage!.tokens![0]!.filter((t) => t.w)).toHaveLength(3);
    expect(warnings).toEqual([]);
    expect(checkGlossary(u, new Set(['ev']))).toEqual([
      'a1-u02-r1: glossary var verweist auf unbekannte Vokabel varmak',
    ]);
  });

  it('erlaubt passage nur bei Lesetexten', () => {
    const r = Lesson.safeParse({ ...lesson, type: 'dialog' });
    expect(r.success).toBe(false);
  });
});
