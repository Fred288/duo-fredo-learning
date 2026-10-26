import { describe, expect, it } from 'vitest';
import { inflect, MorphError } from './inflect';
import { conjugate, PERSONS } from './verb';
import { suffixVariants } from './variants';

describe('Ableitungen -lI, -sIz, -lIk, -CI', () => {
  it.each([
    ['şeker', ['LI'], 'şekerli'],
    ['tuz', ['LI'], 'tuzlu'],
    ['süt', ['LI'], 'sütlü'],
    ['para', ['LI'], 'paralı'],
    ['şeker', ['SIZ'], 'şekersiz'],
    ['para', ['SIZ'], 'parasız'],
    ['ev', ['SIZ'], 'evsiz'],
    ['güzel', ['LIK'], 'güzellik'],
    ['çocuk', ['LIK'], 'çocukluk'],
    ['göz', ['LIK'], 'gözlük'],
    ['kitap', ['CI'], 'kitapçı'],
    ['süt', ['CI'], 'sütçü'],
    ['balık', ['CI'], 'balıkçı'],
    ['gazete', ['CI'], 'gazeteci'],
    ['iş', ['CI'], 'işçi'],
    ['yol', ['CI'], 'yolcu'],
    ['çay', ['CI'], 'çaycı'],
    ['göz', ['LIK', 'PL'], 'gözlükler'],
    ['kitap', ['CI', 'PL'], 'kitapçılar'],
    ['kitap', ['CI', 'LIK'], 'kitapçılık'],
  ] as const)('%s + %s → %s', (stem, tags, form) => {
    expect(inflect(stem, [...tags]).form).toBe(form);
  });

  it('-lık erweicht vor Vokal: güzelliği, gözlüğüm', () => {
    expect(inflect('güzel', ['LIK', 'POSS_3SG']).form).toBe('güzelliği');
    expect(inflect('göz', ['LIK', 'POSS_1SG']).form).toBe('gözlüğüm');
    expect(inflect('göz', ['LIK', 'LOC']).form).toBe('gözlükte');
  });

  it('Stamm-Erweichung und Vokalausfall nur vor Vokal', () => {
    expect(inflect({ form: 'kitap', softens: true }, ['CI']).form).toBe('kitapçı');
    expect(inflect({ form: 'isim', dropsVowel: true }, ['SIZ']).form).toBe('isimsiz');
    expect(inflect({ form: 'su', yStem: true }, ['LI']).form).toBe('sulu');
    expect(inflect({ form: 'su', yStem: true }, ['SIZ']).form).toBe('susuz');
  });

  it('Eigennamen: Ableitung ohne Apostroph (Ankaralı, Berlinliler)', () => {
    expect(inflect({ form: 'Ankara', proper: true }, ['LI']).form).toBe('Ankaralı');
    expect(inflect({ form: 'Berlin', proper: true }, ['LI', 'PL']).form).toBe('Berlinliler');
    expect(inflect({ form: 'İstanbul', proper: true }, ['LI']).form).toBe('İstanbullu');
  });

  it('c/ç wird begründet', () => {
    const steps = inflect('kitap', ['CI']).steps;
    expect(steps).toContainEqual({ tag: 'CI', rule: 'assimilation', after: 'p', chose: 'ç' });
  });

  it('Ableitung nach dem Plural ist ungültig', () => {
    expect(() => inflect('ev', ['PL', 'LI'])).toThrow(MorphError);
  });
});

describe('-ki (der/die/das … von/in)', () => {
  it.each([
    ['ev', ['LOC', 'KI'], 'evdeki'],
    ['masa', ['LOC', 'KI'], 'masadaki'],
    ['Ali', ['GEN', 'KI'], "Ali'ninki"],
    ['ev', ['LOC', 'KI', 'PL'], 'evdekiler'],
    ['oda', ['LOC', 'KI', 'ACC'], 'odadakini'],
    ['bugün', ['KI'], 'bugünkü'],
    ['dün', ['KI'], 'dünkü'],
    ['sabah', ['KI'], 'sabahki'],
  ] as const)('%s + %s → %s', (stem, tags, form) => {
    const s = stem === 'Ali' ? { form: stem, proper: true } : stem;
    expect(inflect(s, [...tags]).form).toBe(form);
  });

  it('-ki harmonisiert nicht (Ablenker nur als Variante)', () => {
    expect(suffixVariants('KI')).toEqual(expect.arrayContaining(['ki', 'kı']));
    expect(suffixVariants('CI')).toEqual(expect.arrayContaining(['ci', 'çi', 'cı', 'çü']));
  });
});

describe('Passiv', () => {
  const pass = (
    verb: string | { form: string; softens?: boolean },
    tense: 'present' | 'past' | 'aorist' = 'present',
  ) => conjugate(verb, { tense, person: '3sg', passive: true }).form;

  it.each([
    ['yapmak', 'yapılıyor'],
    ['görmek', 'görülüyor'],
    ['okumak', 'okunuyor'],
    ['bilmek', 'biliniyor'],
    ['almak', 'alınıyor'],
    ['yemek', 'yeniyor'],
    ['satmak', 'satılıyor'],
    ['sevmek', 'seviliyor'],
  ])('%s → %s', (verb, form) => {
    expect(pass(verb)).toBe(form);
  });

  it('andere Zeiten, Erweichung, Aorist immer -Ir', () => {
    expect(pass('yapmak', 'past')).toBe('yapıldı');
    expect(pass('yapmak', 'aorist')).toBe('yapılır');
    expect(pass('yemek', 'aorist')).toBe('yenir');
    expect(pass({ form: 'ziyaret etmek', softens: true }, 'past')).toBe('ziyaret edildi');
    expect(conjugate('konuşmak', { tense: 'aorist', person: '3sg', passive: true }).form).toBe(
      'konuşulur',
    );
  });

  it('Verneinung, Frage und alle Personen', () => {
    expect(
      conjugate('yapmak', { tense: 'past', person: '3sg', passive: true, negative: true }).form,
    ).toBe('yapılmadı');
    expect(
      conjugate('yapmak', { tense: 'present', person: '3sg', passive: true, question: true }).form,
    ).toBe('yapılıyor mu');
    expect(
      PERSONS.map((p) => conjugate('sevmek', { tense: 'past', person: p, passive: true }).form),
    ).toEqual(['sevildim', 'sevildin', 'sevildi', 'sevildik', 'sevildiniz', 'sevildiler']);
  });

  it('kombiniert mit können: yapılabilir', () => {
    expect(
      conjugate('yapmak', { tense: 'aorist', person: '3sg', passive: true, ability: true }).form,
    ).toBe('yapılabilir');
  });

  it('Segmente: Stamm und Passiv getrennt', () => {
    const r = conjugate('yapmak', { tense: 'past', person: '3sg', passive: true });
    expect(r.segments.map((s) => s.text)).toEqual(['yap', 'ıl', 'dı']);
    expect(r.segments[1]!.tag).toBe('PASS');
  });
});
