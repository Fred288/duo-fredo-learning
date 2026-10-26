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

const git = { form: 'gitmek', softens: true };
const IMP: Person[] = ['2sg', '3sg', '2pl', '3pl'];

describe('Perfekt/Evidential -mIş', () => {
  it.each([
    ['gelmek', ['gelmişim', 'gelmişsin', 'gelmiş', 'gelmişiz', 'gelmişsiniz', 'gelmişler']],
    ['yapmak', ['yapmışım', 'yapmışsın', 'yapmış', 'yapmışız', 'yapmışsınız', 'yapmışlar']],
    ['okumak', ['okumuşum', 'okumuşsun', 'okumuş', 'okumuşuz', 'okumuşsunuz', 'okumuşlar']],
    ['görmek', ['görmüşüm', 'görmüşsün', 'görmüş', 'görmüşüz', 'görmüşsünüz', 'görmüşler']],
  ] as const)('%s', (verb, forms) => {
    expect(all(verb, { tense: 'evidential' })).toEqual(forms);
  });

  it('kein Stammwechsel, Verneinung und Frage', () => {
    expect(conjugate(git, { tense: 'evidential', person: '3sg' }).form).toBe('gitmiş');
    expect(conjugate('yemek', { tense: 'evidential', person: '3sg' }).form).toBe('yemiş');
    expect(conjugate('gelmek', { tense: 'evidential', person: '3sg', negative: true }).form).toBe(
      'gelmemiş',
    );
    expect(conjugate('yapmak', { tense: 'evidential', person: '1sg', negative: true }).form).toBe(
      'yapmamışım',
    );
    expect(conjugate('gelmek', { tense: 'evidential', person: '2sg', question: true }).form).toBe(
      'gelmiş misin',
    );
    expect(conjugate('gelmek', { tense: 'evidential', person: '3pl', question: true }).form).toBe(
      'gelmişler mi',
    );
  });
});

describe('Notwendigkeit -mAlI', () => {
  it.each([
    ['gelmek', ['gelmeliyim', 'gelmelisin', 'gelmeli', 'gelmeliyiz', 'gelmelisiniz', 'gelmeliler']],
    ['yapmak', ['yapmalıyım', 'yapmalısın', 'yapmalı', 'yapmalıyız', 'yapmalısınız', 'yapmalılar']],
    ['okumak', ['okumalıyım', 'okumalısın', 'okumalı', 'okumalıyız', 'okumalısınız', 'okumalılar']],
  ] as const)('%s', (verb, forms) => {
    expect(all(verb, { tense: 'necessitative' })).toEqual(forms);
  });

  it('Verneinung und Frage', () => {
    expect(
      conjugate('gelmek', { tense: 'necessitative', person: '1sg', negative: true }).form,
    ).toBe('gelmemeliyim');
    expect(conjugate('içmek', { tense: 'necessitative', person: '3sg', negative: true }).form).toBe(
      'içmemeli',
    );
    expect(
      conjugate('gelmek', { tense: 'necessitative', person: '1sg', question: true }).form,
    ).toBe('gelmeli miyim');
    expect(
      conjugate('yapmak', { tense: 'necessitative', person: '2sg', question: true }).form,
    ).toBe('yapmalı mısın');
  });
});

describe('Imperativ', () => {
  it.each([
    ['gelmek', ['gel', 'gelsin', 'gelin', 'gelsinler']],
    ['okumak', ['oku', 'okusun', 'okuyun', 'okusunlar']],
    ['yapmak', ['yap', 'yapsın', 'yapın', 'yapsınlar']],
    ['yemek', ['ye', 'yesin', 'yiyin', 'yesinler']],
    ['demek', ['de', 'desin', 'deyin', 'desinler']],
    ['beklemek', ['bekle', 'beklesin', 'bekleyin', 'beklesinler']],
  ] as const)('%s', (verb, forms) => {
    expect(all(verb, { tense: 'imperative' }, IMP)).toEqual(forms);
  });

  it('Erweichung nur vor Vokal: gidin, aber gitsin', () => {
    expect(all(git, { tense: 'imperative' }, IMP)).toEqual(['git', 'gitsin', 'gidin', 'gitsinler']);
  });

  it('Verneinung', () => {
    expect(all('gelmek', { tense: 'imperative', negative: true }, IMP)).toEqual([
      'gelme',
      'gelmesin',
      'gelmeyin',
      'gelmesinler',
    ]);
    expect(all('yapmak', { tense: 'imperative', negative: true }, IMP)).toEqual([
      'yapma',
      'yapmasın',
      'yapmayın',
      'yapmasınlar',
    ]);
  });

  it('höfliche Form -(y)InIz', () => {
    const polite = (verb: VerbStem | string, negative = false) =>
      conjugate(verb, { tense: 'imperative', person: '2pl', polite: true, negative }).form;
    expect(polite('gelmek')).toBe('geliniz');
    expect(polite('okumak')).toBe('okuyunuz');
    expect(polite(git)).toBe('gidiniz');
    expect(polite('gelmek', true)).toBe('gelmeyiniz');
  });

  it('1. Person gibt es nicht', () => {
    expect(() => conjugate('gelmek', { tense: 'imperative', person: '1sg' })).toThrow(MorphError);
  });
});

describe('können -(y)Abil', () => {
  const ab = (verb: VerbStem | string, opts: Opts, person: Person = '1sg') =>
    conjugate(verb, { ...opts, person, ability: true }).form;

  it('in allen Zeiten', () => {
    expect(all('gelmek', { tense: 'aorist', ability: true })).toEqual([
      'gelebilirim',
      'gelebilirsin',
      'gelebilir',
      'gelebiliriz',
      'gelebilirsiniz',
      'gelebilirler',
    ]);
    expect(ab('gelmek', { tense: 'present' })).toBe('gelebiliyorum');
    expect(ab('gelmek', { tense: 'past' })).toBe('gelebildim');
    expect(ab('gelmek', { tense: 'future' })).toBe('gelebileceğim');
    expect(ab('gelmek', { tense: 'necessitative' })).toBe('gelebilmeliyim');
    expect(ab('gelmek', { tense: 'evidential' }, '3sg')).toBe('gelebilmiş');
  });

  it('Harmonie, Puffer-y und Stammwechsel', () => {
    expect(ab('yapmak', { tense: 'aorist' })).toBe('yapabilirim');
    expect(ab('okumak', { tense: 'aorist' })).toBe('okuyabilirim');
    expect(ab(git, { tense: 'aorist' })).toBe('gidebilirim');
    expect(ab('yemek', { tense: 'aorist' })).toBe('yiyebilirim');
    expect(ab('demek', { tense: 'aorist' })).toBe('diyebilirim');
  });

  it('verneint: -(y)A + Verneinung', () => {
    expect(all('gelmek', { tense: 'aorist', ability: true, negative: true })).toEqual([
      'gelemem',
      'gelemezsin',
      'gelemez',
      'gelemeyiz',
      'gelemezsiniz',
      'gelemezler',
    ]);
    expect(ab('yapmak', { tense: 'aorist', negative: true })).toBe('yapamam');
    expect(ab('okumak', { tense: 'aorist', negative: true })).toBe('okuyamam');
    expect(ab(git, { tense: 'aorist', negative: true })).toBe('gidemem');
    expect(ab('gelmek', { tense: 'present', negative: true })).toBe('gelemiyorum');
    expect(ab('yapmak', { tense: 'past', negative: true }, '1pl')).toBe('yapamadık');
    expect(ab('gelmek', { tense: 'future', negative: true })).toBe('gelemeyeceğim');
  });

  it('Fragen', () => {
    expect(ab('gelmek', { tense: 'aorist', question: true }, '2sg')).toBe('gelebilir misin');
    expect(ab('gelmek', { tense: 'aorist', negative: true, question: true }, '2sg')).toBe(
      'gelemez misin',
    );
    expect(ab('yapmak', { tense: 'aorist', question: true }, '2pl')).toBe('yapabilir misiniz');
  });

  it('Segmente: Stamm und -ebil getrennt, Aorist begründet', () => {
    const r = conjugate('gelmek', { tense: 'aorist', person: '1sg', ability: true });
    expect(r.segments.map((s) => s.text)).toEqual(['gel', 'ebil', 'ir', 'im']);
    expect(r.segments[1]!.tag).toBe('ABIL');
    expect(r.steps).toContainEqual(
      expect.objectContaining({ rule: 'aorist_vowel', kind: 'ability' }),
    );
  });

  it('nicht mit dem Imperativ', () => {
    expect(() =>
      conjugate('gelmek', { tense: 'imperative', person: '2sg', ability: true }),
    ).toThrow(MorphError);
  });
});

describe('Kopula in der Vergangenheit', () => {
  const past = (word: Parameters<typeof predicate>[0], o = {}) =>
    PERSONS.map((person) => predicate(word, { person, tense: 'past', ...o }).form);

  it('idi: Typ 2, y nach Vokal, t nach stimmlosem Laut', () => {
    expect(past('öğretmen')).toEqual([
      'öğretmendim',
      'öğretmendin',
      'öğretmendi',
      'öğretmendik',
      'öğretmendiniz',
      'öğretmendiler',
    ]);
    expect(past('öğrenci')).toEqual([
      'öğrenciydim',
      'öğrenciydin',
      'öğrenciydi',
      'öğrenciydik',
      'öğrenciydiniz',
      'öğrenciydiler',
    ]);
    expect(
      predicate({ form: 'Türk', capitalized: true }, { person: '1sg', tense: 'past' }).form,
    ).toBe('Türktüm');
    expect(predicate('evde', { person: '1pl', tense: 'past' }).form).toBe('evdeydik');
    expect(predicate('mutlu', { person: '3sg', tense: 'past' }).form).toBe('mutluydu');
    expect(predicate({ form: 'Ayşe', proper: true }, { person: '3sg', tense: 'past' }).form).toBe(
      "Ayşe'ydi",
    );
  });

  it('değildim und Fragen', () => {
    expect(predicate('öğretmen', { person: '1sg', tense: 'past', negative: true }).form).toBe(
      'öğretmen değildim',
    );
    expect(predicate('öğretmen', { person: '2sg', tense: 'past', question: true }).form).toBe(
      'öğretmen miydin',
    );
    expect(predicate('hasta', { person: '3sg', tense: 'past', question: true }).form).toBe(
      'hasta mıydı',
    );
    expect(
      predicate('öğretmen', { person: '2sg', tense: 'past', negative: true, question: true }).form,
    ).toBe('öğretmen değil miydin');
  });

  it('imiş', () => {
    expect(predicate('öğretmen', { person: '3sg', tense: 'evidential' }).form).toBe('öğretmenmiş');
    expect(predicate('öğrenci', { person: '2sg', tense: 'evidential' }).form).toBe(
      'öğrenciymişsin',
    );
    expect(predicate('hasta', { person: '1sg', tense: 'evidential' }).form).toBe('hastaymışım');
    expect(predicate('öğretmen', { person: '3sg', tense: 'evidential', negative: true }).form).toBe(
      'öğretmen değilmiş',
    );
    expect(predicate('öğretmen', { person: '3pl', tense: 'evidential' }).form).toBe(
      'öğretmenmişler',
    );
  });
});
