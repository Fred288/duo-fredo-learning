import { describe, expect, it } from 'vitest';
import { MorphError } from './inflect';
import {
  conjugate,
  PERSONS,
  predicate,
  type ConjugateOptions,
  type Person,
  type VerbStem,
} from './verb';

type Opts = Omit<ConjugateOptions, 'person'>;
const all = (verb: VerbStem | string, opts: Opts, persons: readonly Person[] = PERSONS) =>
  persons.map((person) => conjugate(verb, { ...opts, person }).form);
const one = (verb: VerbStem | string, opts: ConjugateOptions) => conjugate(verb, opts).form;

const git = { form: 'gitmek', softens: true };
const OPT: Person[] = ['1sg', '1pl'];

describe('Konditional -sA (Personalendungen Typ 2)', () => {
  it.each([
    ['gelmek', ['gelsem', 'gelsen', 'gelse', 'gelsek', 'gelseniz', 'gelseler']],
    ['yapmak', ['yapsam', 'yapsan', 'yapsa', 'yapsak', 'yapsanız', 'yapsalar']],
    ['okumak', ['okusam', 'okusan', 'okusa', 'okusak', 'okusanız', 'okusalar']],
  ] as const)('%s', (verb, forms) => {
    expect(all(verb, { tense: 'conditional' })).toEqual(forms);
  });

  it('Verneinung, Frage, kein Stammwechsel', () => {
    expect(one('gelmek', { tense: 'conditional', person: '1sg', negative: true })).toBe('gelmesem');
    expect(one('yapmak', { tense: 'conditional', person: '3sg', negative: true })).toBe('yapmasa');
    expect(one('gelmek', { tense: 'conditional', person: '1sg', question: true })).toBe(
      'gelsem mi',
    );
    expect(one(git, { tense: 'conditional', person: '3sg' })).toBe('gitse');
    expect(one('yemek', { tense: 'conditional', person: '3sg' })).toBe('yese');
  });

  it('mit können und Passiv', () => {
    expect(one('gelmek', { tense: 'conditional', person: '1sg', ability: true })).toBe(
      'gelebilsem',
    );
    expect(
      one('gelmek', { tense: 'conditional', person: '1sg', ability: true, negative: true }),
    ).toBe('gelemesem');
    expect(one('yapmak', { tense: 'conditional', person: '3sg', passive: true })).toBe('yapılsa');
  });

  it('Bausteine: Stamm, -sA, Endung', () => {
    const r = conjugate('gelmek', { tense: 'conditional', person: '1pl', negative: true });
    expect(r.segments.map((s) => [s.tag, s.text])).toEqual([
      ['STEM', 'gel'],
      ['NEG', 'me'],
      ['COND', 'se'],
      ['P1PL', 'k'],
    ]);
  });
});

describe('Optativ -(y)AyIm / -(y)AlIm', () => {
  it.each([
    ['gelmek', ['geleyim', 'gelelim']],
    ['yapmak', ['yapayım', 'yapalım']],
    ['okumak', ['okuyayım', 'okuyalım']],
    ['görmek', ['göreyim', 'görelim']],
  ] as const)('%s', (verb, forms) => {
    expect(all(verb, { tense: 'optative' }, OPT)).toEqual(forms);
  });

  it('Erweichung, de-/ye-Hebung, Verneinung, Frage', () => {
    expect(all(git, { tense: 'optative' }, OPT)).toEqual(['gideyim', 'gidelim']);
    expect(all('yemek', { tense: 'optative' }, OPT)).toEqual(['yiyeyim', 'yiyelim']);
    expect(all('demek', { tense: 'optative' }, OPT)).toEqual(['diyeyim', 'diyelim']);
    expect(all('gelmek', { tense: 'optative', negative: true }, OPT)).toEqual([
      'gelmeyeyim',
      'gelmeyelim',
    ]);
    expect(all('yemek', { tense: 'optative', negative: true }, OPT)).toEqual([
      'yemeyeyim',
      'yemeyelim',
    ]);
    expect(one('gelmek', { tense: 'optative', person: '1pl', question: true })).toBe('gelelim mi');
    expect(one('okumak', { tense: 'optative', person: '1sg', question: true })).toBe('okuyayım mı');
  });

  it('Bausteine', () => {
    const r = conjugate('okumak', { tense: 'optative', person: '1sg' });
    expect(r.segments.map((s) => [s.tag, s.text])).toEqual([
      ['STEM', 'oku'],
      ['OPT', 'ya'],
      ['P1SG', 'yım'],
    ]);
  });

  it('nur 1. Person', () => {
    for (const person of ['2sg', '3sg', '2pl', '3pl'] as const) {
      expect(() => conjugate('gelmek', { tense: 'optative', person })).toThrow(MorphError);
    }
  });
});

describe('zusammengesetzte Zeiten mit idi (-DI, Typ 2)', () => {
  it.each([
    [
      'present',
      ['geliyordum', 'geliyordun', 'geliyordu', 'geliyorduk', 'geliyordunuz', 'geliyorlardı'],
    ],
    [
      'future',
      ['gelecektim', 'gelecektin', 'gelecekti', 'gelecektik', 'gelecektiniz', 'geleceklerdi'],
    ],
    ['aorist', ['gelirdim', 'gelirdin', 'gelirdi', 'gelirdik', 'gelirdiniz', 'gelirlerdi']],
    [
      'evidential',
      ['gelmiştim', 'gelmiştin', 'gelmişti', 'gelmiştik', 'gelmiştiniz', 'gelmişlerdi'],
    ],
    [
      'necessitative',
      ['gelmeliydim', 'gelmeliydin', 'gelmeliydi', 'gelmeliydik', 'gelmeliydiniz', 'gelmelilerdi'],
    ],
    [
      'conditional',
      ['gelseydim', 'gelseydin', 'gelseydi', 'gelseydik', 'gelseydiniz', 'gelselerdi'],
    ],
  ] as const)('gelmek, %s', (tense, forms) => {
    expect(all('gelmek', { tense, compound: 'past' })).toEqual(forms);
  });

  it('Harmonie und Assimilation am Basiswort', () => {
    expect(one('yapmak', { tense: 'present', compound: 'past', person: '1sg' })).toBe('yapıyordum');
    expect(one('yapmak', { tense: 'aorist', compound: 'past', person: '1sg' })).toBe('yapardım');
    expect(one('okumak', { tense: 'evidential', compound: 'past', person: '1pl' })).toBe(
      'okumuştuk',
    );
    expect(one('okumak', { tense: 'future', compound: 'past', person: '3sg' })).toBe('okuyacaktı');
    expect(one(git, { tense: 'future', compound: 'past', person: '1sg' })).toBe('gidecektim');
    expect(one('beklemek', { tense: 'present', compound: 'past', person: '3sg' })).toBe(
      'bekliyordu',
    );
  });

  it('Verneinung: Aorist mit -mez-, ohne 1sg-Sonderform', () => {
    expect(
      one('gelmek', { tense: 'aorist', compound: 'past', person: '1sg', negative: true }),
    ).toBe('gelmezdim');
    expect(
      one('gelmek', { tense: 'aorist', compound: 'past', person: '1pl', negative: true }),
    ).toBe('gelmezdik');
    expect(
      one('gelmek', { tense: 'present', compound: 'past', person: '1sg', negative: true }),
    ).toBe('gelmiyordum');
    expect(
      one('gelmek', { tense: 'conditional', compound: 'past', person: '1sg', negative: true }),
    ).toBe('gelmeseydim');
  });

  it('Frage: Partikel vor der Kopula', () => {
    expect(
      one('gelmek', { tense: 'present', compound: 'past', person: '1sg', question: true }),
    ).toBe('geliyor muydum');
    expect(
      one('gelmek', { tense: 'future', compound: 'past', person: '2sg', question: true }),
    ).toBe('gelecek miydin');
    expect(
      one('gelmek', { tense: 'aorist', compound: 'past', person: '3sg', question: true }),
    ).toBe('gelir miydi');
    expect(
      one('gelmek', { tense: 'present', compound: 'past', person: '3pl', question: true }),
    ).toBe('geliyorlar mıydı');
  });

  it('mit können und Passiv', () => {
    expect(one('gelmek', { tense: 'aorist', compound: 'past', person: '1sg', ability: true })).toBe(
      'gelebilirdim',
    );
    expect(
      one('gelmek', {
        tense: 'aorist',
        compound: 'past',
        person: '1sg',
        ability: true,
        negative: true,
      }),
    ).toBe('gelemezdim');
    expect(
      one('yapmak', { tense: 'present', compound: 'past', person: '3sg', passive: true }),
    ).toBe('yapılıyordu');
  });

  it('Bausteine: Basiszeit, Kopula, Endung', () => {
    const r = conjugate('gelmek', { tense: 'present', compound: 'past', person: '1sg' });
    expect(r.segments.map((s) => [s.tag, s.text])).toEqual([
      ['STEM', 'gel'],
      ['PRES', 'iyor'],
      ['PAST', 'du'],
      ['P1SG', 'm'],
    ]);
    const pl = conjugate('gelmek', { tense: 'evidential', compound: 'past', person: '3pl' });
    expect(pl.segments.map((s) => [s.tag, s.text])).toEqual([
      ['STEM', 'gel'],
      ['EVID', 'miş'],
      ['P3PL', 'ler'],
      ['PAST', 'di'],
    ]);
  });
});

describe('zusammengesetzte Zeiten mit imiş (-mIş, Typ 1)', () => {
  it.each([
    [
      'present',
      [
        'geliyormuşum',
        'geliyormuşsun',
        'geliyormuş',
        'geliyormuşuz',
        'geliyormuşsunuz',
        'geliyorlarmış',
      ],
    ],
    [
      'future',
      [
        'gelecekmişim',
        'gelecekmişsin',
        'gelecekmiş',
        'gelecekmişiz',
        'gelecekmişsiniz',
        'geleceklermiş',
      ],
    ],
    [
      'aorist',
      ['gelirmişim', 'gelirmişsin', 'gelirmiş', 'gelirmişiz', 'gelirmişsiniz', 'gelirlermiş'],
    ],
    [
      'evidential',
      ['gelmişmişim', 'gelmişmişsin', 'gelmişmiş', 'gelmişmişiz', 'gelmişmişsiniz', 'gelmişlermiş'],
    ],
    [
      'necessitative',
      [
        'gelmeliymişim',
        'gelmeliymişsin',
        'gelmeliymiş',
        'gelmeliymişiz',
        'gelmeliymişsiniz',
        'gelmelilermiş',
      ],
    ],
  ] as const)('gelmek, %s', (tense, forms) => {
    expect(all('gelmek', { tense, compound: 'evidential' })).toEqual(forms);
  });

  it('Harmonie, Verneinung, Frage', () => {
    expect(one('yapmak', { tense: 'present', compound: 'evidential', person: '3sg' })).toBe(
      'yapıyormuş',
    );
    expect(one('yapmak', { tense: 'aorist', compound: 'evidential', person: '3sg' })).toBe(
      'yaparmış',
    );
    expect(
      one('gelmek', { tense: 'aorist', compound: 'evidential', person: '3sg', negative: true }),
    ).toBe('gelmezmiş');
    expect(
      one('gelmek', { tense: 'present', compound: 'evidential', person: '3sg', question: true }),
    ).toBe('geliyor muymuş');
  });
});

describe('zusammengesetzte Zeiten mit ise (-sA, Typ 2)', () => {
  it.each([
    [
      'present',
      ['geliyorsam', 'geliyorsan', 'geliyorsa', 'geliyorsak', 'geliyorsanız', 'geliyorlarsa'],
    ],
    [
      'future',
      ['geleceksem', 'geleceksen', 'gelecekse', 'geleceksek', 'gelecekseniz', 'geleceklerse'],
    ],
    ['aorist', ['gelirsem', 'gelirsen', 'gelirse', 'gelirsek', 'gelirseniz', 'gelirlerse']],
    [
      'evidential',
      ['gelmişsem', 'gelmişsen', 'gelmişse', 'gelmişsek', 'gelmişseniz', 'gelmişlerse'],
    ],
    ['past', ['geldiysem', 'geldiysen', 'geldiyse', 'geldiysek', 'geldiyseniz', 'geldilerse']],
  ] as const)('gelmek, %s', (tense, forms) => {
    expect(all('gelmek', { tense, compound: 'conditional' })).toEqual(forms);
  });

  it('Harmonie und Verneinung', () => {
    expect(one('yapmak', { tense: 'aorist', compound: 'conditional', person: '1sg' })).toBe(
      'yaparsam',
    );
    expect(
      one('yapmak', { tense: 'aorist', compound: 'conditional', person: '3sg', negative: true }),
    ).toBe('yapmazsa');
    expect(one('okumak', { tense: 'past', compound: 'conditional', person: '3sg' })).toBe(
      'okuduysa',
    );
    expect(one('gelmek', { tense: 'past', compound: 'conditional', person: '1sg' })).toBe(
      'geldiysem',
    );
  });

  it('Bausteine: -DI mit Kopula', () => {
    const r = conjugate('gelmek', { tense: 'past', compound: 'conditional', person: '1sg' });
    expect(r.segments.map((s) => [s.tag, s.text])).toEqual([
      ['STEM', 'gel'],
      ['PAST', 'di'],
      ['COND', 'yse'],
      ['P1SG', 'm'],
    ]);
  });
});

describe('ausgeschlossene Kombinationen', () => {
  it.each([
    ['imperative', 'past', '2sg'],
    ['optative', 'past', '1sg'],
    ['past', 'past', '1sg'],
    ['past', 'evidential', '1sg'],
    ['conditional', 'evidential', '1sg'],
    ['conditional', 'conditional', '1sg'],
  ] as const)('%s + %s', (tense, compound, person) => {
    expect(() => conjugate('gelmek', { tense, compound, person })).toThrow(MorphError);
  });

  it('Frage mit ise', () => {
    expect(() =>
      conjugate('gelmek', {
        tense: 'aorist',
        compound: 'conditional',
        person: '1sg',
        question: true,
      }),
    ).toThrow(MorphError);
  });
});

describe('Kopula ise (-(y)sA, Typ 2)', () => {
  it('Nominalsatz', () => {
    const forms = PERSONS.map(
      (person) => predicate('öğrenci', { person, tense: 'conditional' }).form,
    );
    expect(forms).toEqual([
      'öğrenciysem',
      'öğrenciysen',
      'öğrenciyse',
      'öğrenciysek',
      'öğrenciyseniz',
      'öğrenciyseler',
    ]);
    expect(predicate('evde', { person: '3sg', tense: 'conditional' }).form).toBe('evdeyse');
    expect(predicate('hasta', { person: '1sg', tense: 'conditional' }).form).toBe('hastaysam');
    expect(predicate('Türk', { person: '1sg', tense: 'conditional' }).form).toBe('türksem');
    expect(predicate('öğrenci', { person: '1sg', tense: 'conditional', negative: true }).form).toBe(
      'öğrenci değilsem',
    );
  });

  it('Eigenname mit Apostroph', () => {
    expect(
      predicate({ form: 'Ayşe', proper: true }, { person: '3sg', tense: 'conditional' }).form,
    ).toBe("Ayşe'yse");
  });

  it('keine Frage mit ise', () => {
    expect(() =>
      predicate('öğrenci', { person: '1sg', tense: 'conditional', question: true }),
    ).toThrow(MorphError);
  });
});
