import { describe, expect, it } from 'vitest';
import { MorphError } from './inflect';
import {
  conjugate,
  conjugateVariants,
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

describe('Nebenformen und weitere Kombinationen (Review E1)', () => {
  it('3. Person Plural: -lAr auch nach der Kopula', () => {
    const v = (opts: Opts) => conjugateVariants('gelmek', { ...opts, person: '3pl' });
    expect(v({ tense: 'present', compound: 'past' })).toEqual(['geliyordular']);
    expect(v({ tense: 'conditional', compound: 'past' })).toEqual(['gelseydiler']);
    expect(v({ tense: 'past', compound: 'conditional' })).toEqual(['geldiyseler']);
    expect(v({ tense: 'necessitative', compound: 'past' })).toEqual(['gelmeliydiler']);
    expect(v({ tense: 'present', compound: 'evidential' })).toEqual(['geliyormuşlar']);
    expect(v({ tense: 'present', compound: 'past', question: true })).toEqual(['geliyor muydular']);
    expect(v({ tense: 'present' })).toEqual([]);
    expect(
      conjugateVariants('gelmek', { tense: 'present', compound: 'past', person: '1sg' }),
    ).toEqual([]);
  });

  it('Erweichung, Mehrwortverb, de/ye mit Kopula', () => {
    expect(one(git, { tense: 'present', compound: 'past', person: '1sg' })).toBe('gidiyordum');
    expect(one(git, { tense: 'aorist', compound: 'past', person: '1sg' })).toBe('giderdim');
    expect(one(git, { tense: 'future', compound: 'conditional', person: '1sg' })).toBe(
      'gideceksem',
    );
    expect(one(git, { tense: 'past', compound: 'conditional', person: '3sg' })).toBe('gittiyse');
    expect(one(git, { tense: 'optative', person: '1sg', negative: true })).toBe('gitmeyeyim');
    const visit = { form: 'ziyaret etmek', softens: true };
    expect(one(visit, { tense: 'present', compound: 'past', person: '1sg' })).toBe(
      'ziyaret ediyordum',
    );
    expect(one(visit, { tense: 'present', compound: 'past', person: '1sg', question: true })).toBe(
      'ziyaret ediyor muydum',
    );
    expect(one(visit, { tense: 'optative', person: '1pl' })).toBe('ziyaret edelim');
    expect(one(visit, { tense: 'conditional', person: '1pl' })).toBe('ziyaret etsek');
    expect(one('yemek', { tense: 'present', compound: 'past', person: '1sg' })).toBe('yiyordum');
    expect(one('demek', { tense: 'future', compound: 'evidential', person: '1sg' })).toBe(
      'diyecekmişim',
    );
  });

  it('Passiv und können mit Kopula und Optativ', () => {
    expect(one('yapmak', { tense: 'aorist', compound: 'past', person: '1sg', passive: true })).toBe(
      'yapılırdım',
    );
    expect(
      one('yapmak', { tense: 'aorist', compound: 'conditional', person: '3sg', passive: true }),
    ).toBe('yapılırsa');
    expect(
      one('yapmak', {
        tense: 'conditional',
        compound: 'past',
        person: '1sg',
        passive: true,
        ability: true,
      }),
    ).toBe('yapılabilseydim');
    expect(
      one('yapmak', { tense: 'present', compound: 'past', person: '1sg', ability: true }),
    ).toBe('yapabiliyordum');
    expect(
      one('yapmak', {
        tense: 'present',
        compound: 'past',
        person: '1sg',
        ability: true,
        negative: true,
      }),
    ).toBe('yapamıyordum');
    expect(one('gelmek', { tense: 'optative', person: '1sg', ability: true })).toBe('gelebileyim');
    expect(one('gelmek', { tense: 'optative', person: '1sg', ability: true, negative: true })).toBe(
      'gelemeyeyim',
    );
    expect(one('yapmak', { tense: 'optative', person: '1sg', passive: true })).toBe('yapılayım');
  });

  it('Fragen mit imiş, verneinte Fragen, Konditional 3pl', () => {
    expect(
      one('gelmek', { tense: 'present', compound: 'evidential', person: '1sg', question: true }),
    ).toBe('geliyor muymuşum');
    expect(
      one('gelmek', { tense: 'present', compound: 'evidential', person: '3pl', question: true }),
    ).toBe('geliyorlar mıymış');
    expect(
      one('gelmek', {
        tense: 'aorist',
        compound: 'past',
        person: '1sg',
        question: true,
        negative: true,
      }),
    ).toBe('gelmez miydim');
    expect(one('gelmek', { tense: 'conditional', person: '3pl', question: true })).toBe(
      'gelseler mi',
    );
    expect(
      one('gelmek', { tense: 'conditional', compound: 'past', person: '3pl', question: true }),
    ).toBe('gelseler miydi');
    expect(
      one('gelmek', { tense: 'aorist', compound: 'conditional', person: '1sg', negative: true }),
    ).toBe('gelmezsem');
    expect(
      one('gelmek', { tense: 'aorist', compound: 'conditional', person: '1pl', negative: true }),
    ).toBe('gelmezsek');
  });

  it('Bausteine einer Frage mit Kopula', () => {
    const r = conjugate('gelmek', {
      tense: 'present',
      compound: 'past',
      person: '1sg',
      question: true,
    });
    expect(r.segments.map((s) => [s.tag, s.text])).toEqual([
      ['STEM', 'gel'],
      ['PRES', 'iyor'],
      ['Q', 'mu'],
      ['PAST', 'ydu'],
      ['P1SG', 'm'],
    ]);
  });

  it('polite nur im Imperativ', () => {
    expect(() => conjugate('gelmek', { tense: 'optative', person: '1sg', polite: true })).toThrow(
      MorphError,
    );
    expect(() =>
      conjugate('gelmek', { tense: 'present', compound: 'past', person: '1sg', polite: true }),
    ).toThrow(MorphError);
  });

  it('Kopula ise und imiş: Eigennamen, Verneinung, Frage', () => {
    const ist = { form: 'İstanbul', proper: true };
    expect(predicate(ist, { person: '3sg', tense: 'conditional' }).form).toBe("İstanbul'sa");
    expect(predicate(ist, { person: '1sg', tense: 'conditional' }).form).toBe("İstanbul'sam");
    expect(
      predicate(
        { form: 'Ankara', proper: true },
        {
          person: '1sg',
          tense: 'conditional',
          negative: true,
        },
      ).form,
    ).toBe('Ankara değilsem');
    expect(predicate('kitap', { person: '3sg', tense: 'conditional' }).form).toBe('kitapsa');
    expect(predicate('öğretmen', { person: '1sg', tense: 'evidential', question: true }).form).toBe(
      'öğretmen miymişim',
    );
  });
});
