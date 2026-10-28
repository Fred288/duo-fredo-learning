import { describe, expect, it } from 'vitest';
import { formTable, nounForms, verbForms } from './forms';
import { lemmatize, prepareLookup, search, TIER } from './search';
import type { LookupIndex, VocabEntry } from './types';

const v = (tr: string, de: string[], pos: VocabEntry['pos'], extra: Partial<VocabEntry> = {}) =>
  ({ id: tr, tr, de, pos, unit: 'a1-u01', ...extra }) satisfies VocabEntry;

const index: LookupIndex = {
  v: 1,
  units: [{ id: 'a1-u01', title: 'Test', explainer: 'explainers/t.md' }],
  vocab: [
    v('ev', ['Haus'], 'noun'),
    v('kitap', ['Buch'], 'noun', { softens: true }),
    v('oğul', ['Sohn'], 'noun', { drops_vowel: true }),
    v('İstanbul', ['Istanbul'], 'noun', { proper: true }),
    v('sıcak', ['heiß', 'warm'], 'adj'),
    v('sicim', ['Schnur'], 'noun'),
    v('ışık', ['Licht'], 'noun', { softens: true }),
    v('gitmek', ['gehen'], 'verb', { softens: true }),
    v('gelmek', ['kommen'], 'verb'),
    v('yemek', ['essen'], 'verb'),
    v('yemek', ['Essen', 'Mahlzeit'], 'noun', { id: 'yemek-essen' }),
    v('ben', ['ich'], 'pron'),
    v('hoşça kal', ['tschüss (sagt, wer geht)'], 'phrase'),
    v('yıkanmak', ['sich waschen'], 'verb'),
    v('masa', ['Tisch'], 'noun'),
    v('çay', ['Tee'], 'noun'),
    v('yatak odası', ['Schlafzimmer'], 'noun'),
    v('şemsiye', ['Regenschirm'], 'noun'),
  ],
  sections: [
    { unit: 'a1-u01', title: 'Wo? -de / -da', slug: 'wo-de-da', words: ['wo', 'de', 'da', 'evde'] },
    {
      unit: 'a1-u01',
      title: 'Der Lokativ',
      slug: 'der-lokativ',
      words: ['der', 'lokativ', 'ortsangabe'],
    },
  ],
};
const prepared = prepareLookup(index);
const ids = (q: string) => search(prepared, q).vocab.map((h) => h.entry.id);
const first = (q: string) => search(prepared, q).vocab[0];

describe('search: Sonderzeichen und Groß/Klein', () => {
  it.each([
    ['semsiye', 'şemsiye'],
    ['isik', 'ışık'],
    ['IŞIK', 'ışık'],
    ['istanbul', 'İstanbul'],
    ['ISTANBUL', 'İstanbul'],
    ['oglum', 'oğul'],
    ['cay', 'çay'],
    ['Ich', 'ben'],
    ['heiss', 'sıcak'],
    ['heiß', 'sıcak'],
  ])('%s findet %s', (q, id) => {
    expect(ids(q)).toContain(id);
  });

  it('genau getippte Sonderzeichen ranken vor gefalteten', () => {
    const before = (q: string, a: string, b: string) =>
      expect(ids(q).indexOf(a)).toBeLessThan(ids(q).indexOf(b));
    before('sıc', 'sıcak', 'sicim');
    before('sic', 'sicim', 'sıcak');
  });
});

describe('search: Präfix, Teilwort, Glossen', () => {
  it('exakt vor Präfix vor Wortanfang vor Teilwort', () => {
    expect(first('ev')).toMatchObject({ tier: TIER.exact, entry: { id: 'ev' } });
    expect(first('kit')).toMatchObject({ tier: TIER.prefix, entry: { id: 'kitap' } });
    expect(first('kal')).toMatchObject({ tier: TIER.wordPrefix, entry: { id: 'hoşça kal' } });
    expect(search(prepared, 'tap').vocab[0]).toMatchObject({
      tier: TIER.infix,
      entry: { id: 'kitap' },
    });
  });

  it('Teilwort erst ab drei Zeichen', () => {
    expect(ids('ta')).not.toContain('kitap');
  });

  it('deutsch: Klammerzusatz und „sich“ optional', () => {
    expect(first('tschüss')).toMatchObject({ tier: TIER.exact, lang: 'de' });
    expect(first('waschen')).toMatchObject({ tier: TIER.exact, entry: { id: 'yıkanmak' } });
    expect(first('Tisch')).toMatchObject({ lang: 'de', entry: { id: 'masa' } });
  });

  it('Homonyme erscheinen getrennt', () => {
    expect(ids('yemek').slice(0, 2).sort()).toEqual(['yemek', 'yemek-essen']);
    expect(first('Mahlzeit')!.entry.id).toBe('yemek-essen');
  });

  it('leere Anfrage liefert nichts', () => {
    expect(search(prepared, '  ')).toEqual({ vocab: [], sections: [], more: false });
  });
});

describe('lemmatize: gebeugte Formen', () => {
  const lemma = (q: string) => lemmatize(prepared, q).map((h) => h.entry.id);

  it.each([
    ['evlerde', 'ev'],
    ['kitabı', 'kitap'],
    ['kitabi', 'kitap'],
    ['oğlum', 'oğul'],
    ["İstanbul'da", 'İstanbul'],
    ['istanbulda', 'İstanbul'],
    ['gidiyorum', 'gitmek'],
    ['gelmedim', 'gelmek'],
    ['yiyorum', 'yemek'],
    ['bana', 'ben'],
    ['ışıkları', 'ışık'],
  ])('%s → %s', (q, id) => {
    expect(lemma(q)).toContain(id);
  });

  it('nennt alle Lesarten einer Form', () => {
    const [hit] = lemmatize(prepared, 'evi');
    expect(hit!.labels).toEqual([
      { kind: 'noun', tags: ['ACC'] },
      { kind: 'noun', tags: ['POSS_3SG'] },
    ]);
  });

  it('Form-Treffer stehen hinter direkten Treffern', () => {
    expect(first('evlerde')).toMatchObject({
      tier: TIER.form,
      entry: { id: 'ev' },
      form: { form: 'evlerde', labels: [{ kind: 'noun', tags: ['PL', 'LOC'] }] },
    });
  });

  it('keine Formen unter drei Zeichen und nicht für die Grundform', () => {
    expect(lemma('eve')).toContain('ev');
    expect(lemma('ev')).toEqual([]);
    expect(lemma('kitap')).toEqual([]);
  });
});

describe('search: Obergrenze', () => {
  it('meldet, wenn Treffer abgeschnitten wurden', () => {
    const many: LookupIndex = {
      v: 1,
      units: [],
      sections: [],
      vocab: Array.from({ length: 5 }, (_, i) => ({
        id: `ev${i}`,
        tr: `ev${'abcde'[i]}`,
        de: ['Haus'],
        pos: 'noun' as const,
        unit: 'a1-u01',
      })),
    };
    const p = prepareLookup(many);
    expect(search(p, 'ev', 3)).toMatchObject({ more: true });
    expect(search(p, 'ev', 3).vocab).toHaveLength(3);
    expect(search(p, 'ev', 10).more).toBe(false);
  });
});

describe('search: Grammatik-Abschnitte', () => {
  const sections = (q: string) => search(prepared, q).sections.map((s) => [s.section.slug, s.tier]);
  it('Titel vor Text, Suffixe als Wort', () => {
    expect(sections('-de')).toEqual([
      ['wo-de-da', 0],
      ['der-lokativ', 1],
    ]);
    expect(sections('lokativ')).toEqual([['der-lokativ', 0]]);
    expect(sections('lok')).toEqual([['der-lokativ', 1]]);
    expect(sections('ortsangabe')).toEqual([['der-lokativ', 2]]);
    expect(sections('orts')).toEqual([['der-lokativ', 3]]);
  });
});

describe('Formtabellen', () => {
  const entry = (id: string) => index.vocab.find((x) => x.id === id)!;

  it('Nomen: Kasus × Sg/Pl mit Erweichung', () => {
    const t = formTable(entry('kitap'));
    expect(t).toMatchObject({ kind: 'noun' });
    expect(t!.kind === 'noun' && t!.rows.map((r) => [r.case, r.sg, r.pl])).toEqual([
      ['NOM', 'kitap', 'kitaplar'],
      ['ACC', 'kitabı', 'kitapları'],
      ['DAT', 'kitaba', 'kitaplara'],
      ['LOC', 'kitapta', 'kitaplarda'],
      ['ABL', 'kitaptan', 'kitaplardan'],
      ['GEN', 'kitabın', 'kitapların'],
      ['INS', 'kitapla', 'kitaplarla'],
    ]);
  });

  it('Verb: Präsens, Vergangenheit, Futur, Aorist × Personen', () => {
    const t = formTable(entry('gitmek'));
    expect(t!.kind === 'verb' && t!.rows[0]).toEqual({
      person: '1sg',
      forms: ['gidiyorum', 'gittim', 'gideceğim', 'giderim'],
    });
  });

  it('Pronomen aus der Tabelle', () => {
    const t = formTable(entry('ben'));
    expect(t!.kind === 'pronoun' && t!.rows.map((r) => r.form)).toEqual([
      'ben',
      'beni',
      'bana',
      'bende',
      'benden',
      'benim',
      'benimle',
    ]);
  });

  it('keine Tabelle für Mehrwort-Nomen und Wendungen', () => {
    expect(formTable(entry('yatak odası'))).toBeUndefined();
    expect(formTable(entry('hoşça kal'))).toBeUndefined();
  });

  it('Formenmengen sind begrenzt', () => {
    expect(nounForms(entry('ev')).length).toBe(97);
    expect(verbForms(entry('gelmek')).length).toBeLessThan(150);
  });
});
