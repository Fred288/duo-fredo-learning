import { describe, expect, it } from 'vitest';
import { conjugate, PERSONS, type ConjugateOptions, type VerbStem } from './verb';

type Tense = ConjugateOptions['tense'];
const all = (
  verb: VerbStem | string,
  tense: Tense,
  opts: { negative?: boolean; question?: boolean } = {},
) => PERSONS.map((person) => conjugate(verb, { tense, person, ...opts }).form);

const git = { form: 'gitmek', softens: true };
const et = { form: 'etmek', softens: true };

describe('Präteritum -DI (Personalendungen Typ 2)', () => {
  it.each([
    ['gelmek', ['geldim', 'geldin', 'geldi', 'geldik', 'geldiniz', 'geldiler']],
    ['yapmak', ['yaptım', 'yaptın', 'yaptı', 'yaptık', 'yaptınız', 'yaptılar']],
    ['okumak', ['okudum', 'okudun', 'okudu', 'okuduk', 'okudunuz', 'okudular']],
    ['görmek', ['gördüm', 'gördün', 'gördü', 'gördük', 'gördünüz', 'gördüler']],
    ['beklemek', ['bekledim', 'bekledin', 'bekledi', 'bekledik', 'beklediniz', 'beklediler']],
    ['içmek', ['içtim', 'içtin', 'içti', 'içtik', 'içtiniz', 'içtiler']],
  ] as const)('%s', (verb, forms) => {
    expect(all(verb, 'past')).toEqual(forms);
  });

  it('kein Stammwechsel: gitti, yedi, dedi', () => {
    expect(conjugate(git, { tense: 'past', person: '1sg' }).form).toBe('gittim');
    expect(conjugate('yemek', { tense: 'past', person: '3sg' }).form).toBe('yedi');
    expect(conjugate('demek', { tense: 'past', person: '1pl' }).form).toBe('dedik');
  });

  it('Verneinung -mA vor -DI', () => {
    expect(all('gelmek', 'past', { negative: true })).toEqual([
      'gelmedim',
      'gelmedin',
      'gelmedi',
      'gelmedik',
      'gelmediniz',
      'gelmediler',
    ]);
    expect(conjugate('okumak', { tense: 'past', person: '1pl', negative: true }).form).toBe(
      'okumadık',
    );
  });

  it('Frage: Endung am Verb, Partikel getrennt', () => {
    expect(all('gelmek', 'past', { question: true })).toEqual([
      'geldim mi',
      'geldin mi',
      'geldi mi',
      'geldik mi',
      'geldiniz mi',
      'geldiler mi',
    ]);
    expect(conjugate('yapmak', { tense: 'past', person: '2sg', question: true }).form).toBe(
      'yaptın mı',
    );
    expect(
      conjugate('gelmek', { tense: 'past', person: '2sg', negative: true, question: true }).form,
    ).toBe('gelmedin mi');
  });
});

describe('Futur -(y)AcAk', () => {
  it.each([
    ['gelmek', ['geleceğim', 'geleceksin', 'gelecek', 'geleceğiz', 'geleceksiniz', 'gelecekler']],
    ['yapmak', ['yapacağım', 'yapacaksın', 'yapacak', 'yapacağız', 'yapacaksınız', 'yapacaklar']],
    [
      'okumak',
      ['okuyacağım', 'okuyacaksın', 'okuyacak', 'okuyacağız', 'okuyacaksınız', 'okuyacaklar'],
    ],
    [
      'beklemek',
      [
        'bekleyeceğim',
        'bekleyeceksin',
        'bekleyecek',
        'bekleyeceğiz',
        'bekleyeceksiniz',
        'bekleyecekler',
      ],
    ],
  ] as const)('%s', (verb, forms) => {
    expect(all(verb, 'future')).toEqual(forms);
  });

  it('Verbstamm-Erweichung und ye/de', () => {
    expect(conjugate(git, { tense: 'future', person: '1sg' }).form).toBe('gideceğim');
    expect(conjugate(et, { tense: 'future', person: '3sg' }).form).toBe('edecek');
    expect(conjugate('yemek', { tense: 'future', person: '1sg' }).form).toBe('yiyeceğim');
    expect(conjugate('demek', { tense: 'future', person: '3sg' }).form).toBe('diyecek');
  });

  it('Verneinung und Frage', () => {
    expect(conjugate('gelmek', { tense: 'future', person: '1sg', negative: true }).form).toBe(
      'gelmeyeceğim',
    );
    expect(conjugate('okumak', { tense: 'future', person: '3sg', negative: true }).form).toBe(
      'okumayacak',
    );
    expect(conjugate(git, { tense: 'future', person: '1pl', negative: true }).form).toBe(
      'gitmeyeceğiz',
    );
    expect(all('gelmek', 'future', { question: true })).toEqual([
      'gelecek miyim',
      'gelecek misin',
      'gelecek mi',
      'gelecek miyiz',
      'gelecek misiniz',
      'gelecekler mi',
    ]);
    expect(conjugate('yapmak', { tense: 'future', person: '2sg', question: true }).form).toBe(
      'yapacak mısın',
    );
  });
});

describe('Aorist', () => {
  it.each([
    // vokalischer Stamm → -r
    ['okumak', 'okur'],
    ['beklemek', 'bekler'],
    ['istemek', 'ister'],
    ['anlamak', 'anlar'],
    ['yemek', 'yer'],
    ['demek', 'der'],
    // einsilbig → -Ar
    ['yapmak', 'yapar'],
    ['sevmek', 'sever'],
    ['içmek', 'içer'],
    ['koşmak', 'koşar'],
    ['kalkmak', 'kalkar'],
    // die 13 Ausnahmen → -Ir
    ['gelmek', 'gelir'],
    ['almak', 'alır'],
    ['bilmek', 'bilir'],
    ['görmek', 'görür'],
    ['vermek', 'verir'],
    ['kalmak', 'kalır'],
    ['olmak', 'olur'],
    ['bulmak', 'bulur'],
    // mehrsilbig → -Ir
    ['çalışmak', 'çalışır'],
    ['oturmak', 'oturur'],
    ['konuşmak', 'konuşur'],
  ])('%s → %s', (verb, form) => {
    expect(conjugate(verb, { tense: 'aorist', person: '3sg' }).form).toBe(form);
  });

  it('alle Personen, Erweichung git → gider', () => {
    expect(all('gelmek', 'aorist')).toEqual([
      'gelirim',
      'gelirsin',
      'gelir',
      'geliriz',
      'gelirsiniz',
      'gelirler',
    ]);
    expect(all(git, 'aorist')).toEqual([
      'giderim',
      'gidersin',
      'gider',
      'gideriz',
      'gidersiniz',
      'giderler',
    ]);
    expect(conjugate(et, { tense: 'aorist', person: '1sg' }).form).toBe('ederim');
  });

  it('lexikalischer Override', () => {
    expect(conjugate({ form: 'sanmak' }, { tense: 'aorist', person: '3sg' }).form).toBe('sanır');
    expect(
      conjugate({ form: 'yapmak', aorist: 'ir' }, { tense: 'aorist', person: '3sg' }).form,
    ).toBe('yapır');
  });

  it('Verneinung mit Sonderformen in der 1. Person', () => {
    expect(all('gelmek', 'aorist', { negative: true })).toEqual([
      'gelmem',
      'gelmezsin',
      'gelmez',
      'gelmeyiz',
      'gelmezsiniz',
      'gelmezler',
    ]);
    expect(all('yapmak', 'aorist', { negative: true })).toEqual([
      'yapmam',
      'yapmazsın',
      'yapmaz',
      'yapmayız',
      'yapmazsınız',
      'yapmazlar',
    ]);
    expect(conjugate(git, { tense: 'aorist', person: '3sg', negative: true }).form).toBe('gitmez');
  });

  it('Fragen, bejaht und verneint', () => {
    expect(all('gelmek', 'aorist', { question: true })).toEqual([
      'gelir miyim',
      'gelir misin',
      'gelir mi',
      'gelir miyiz',
      'gelir misiniz',
      'gelirler mi',
    ]);
    expect(all('gelmek', 'aorist', { negative: true, question: true })).toEqual([
      'gelmez miyim',
      'gelmez misin',
      'gelmez mi',
      'gelmez miyiz',
      'gelmez misiniz',
      'gelmezler mi',
    ]);
    expect(conjugate('içmek', { tense: 'aorist', person: '2sg', question: true }).form).toBe(
      'içer misin',
    );
  });

  it('begründet die Wahl des Aorist-Vokals', () => {
    const steps = (verb: string) =>
      conjugate(verb, { tense: 'aorist', person: '3sg' }).steps.filter(
        (s) => s.rule === 'aorist_vowel',
      );
    expect(steps('gelmek')).toMatchObject([{ kind: 'exception' }]);
    expect(steps('yapmak')).toMatchObject([{ kind: 'monosyllabic' }]);
    expect(steps('çalışmak')).toMatchObject([{ kind: 'polysyllabic' }]);
    expect(steps('okumak')).toMatchObject([{ kind: 'vowel_stem' }]);
  });
});

describe('Präsens bleibt unverändert', () => {
  it('geliyorum', () => {
    expect(conjugate('gelmek', { tense: 'present', person: '1sg' }).form).toBe('geliyorum');
  });
});
