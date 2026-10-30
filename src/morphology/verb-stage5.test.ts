import { describe, expect, it } from 'vitest';
import { MorphError } from './inflect';
import { nonfinite } from './nonfinite';
import {
  conjugate,
  conjugateVariants,
  predicate,
  type ConjugateOptions,
  type VerbStem,
} from './verb';

const form = (verb: VerbStem | string, opts: Partial<ConjugateOptions>) =>
  conjugate(verb, { tense: 'present', person: '3sg', ...opts }).form;

describe('Kausativ', () => {
  it.each([
    // -DIr nach Konsonant
    ['yapmak', 'yaptırıyor'],
    ['gülmek', 'güldürüyor'],
    ['ölmek', 'öldürüyor'],
    ['düşünmek', 'düşündürüyor'],
    ['etmek', 'ettiriyor'],
    ['gitmek', 'gittiriyor'],
    ['demek', 'dedirtiyor'],
    ['yemek', 'yediriyor'],
    // -t nach Vokal und mehrsilbig auf r/l
    ['okumak', 'okutuyor'],
    ['beklemek', 'bekletiyor'],
    ['anlamak', 'anlatıyor'],
    ['uyumak', 'uyutuyor'],
    ['oturmak', 'oturtuyor'],
    ['kısalmak', 'kısaltıyor'],
  ])('%s → %s', (verb, expected) => {
    expect(form(verb, { causative: true })).toBe(expected);
  });

  it.each([
    [{ form: 'pişmek', causative: 'ir' }, 'pişiriyor'],
    [{ form: 'düşmek', causative: 'ir' }, 'düşürüyor'],
    [{ form: 'kaçmak', causative: 'ir' }, 'kaçırıyor'],
    [{ form: 'çıkmak', causative: 'ar' }, 'çıkarıyor'],
    [{ form: 'korkmak', causative: 'it' }, 'korkutuyor'],
    [{ form: 'akmak', causative: 'it' }, 'akıtıyor'],
  ] as const)('Wortschatz: %o → %s', (verb, expected) => {
    expect(form(verb, { causative: true })).toBe(expected);
  });

  it('läuft durch alle Zeiten wie ein mehrsilbiges Verb', () => {
    const yap = 'yapmak';
    expect(form(yap, { causative: true, tense: 'aorist' })).toBe('yaptırır');
    expect(form(yap, { causative: true, tense: 'past', person: '1sg' })).toBe('yaptırdım');
    expect(form(yap, { causative: true, tense: 'future', person: '1sg' })).toBe('yaptıracağım');
    expect(form(yap, { causative: true, tense: 'imperative', person: '2sg' })).toBe('yaptır');
    expect(form(yap, { causative: true, negative: true })).toBe('yaptırmıyor');
    expect(form('okumak', { causative: true, tense: 'aorist' })).toBe('okutur');
    expect(form({ form: 'çıkmak', causative: 'ar' }, { causative: true, tense: 'aorist' })).toBe(
      'çıkarır',
    );
  });

  it('steht vor Passiv und „können“', () => {
    const opts = { causative: true, tense: 'aorist' } as const;
    expect(form('yapmak', { ...opts, passive: true })).toBe('yaptırılır');
    expect(form('yapmak', { ...opts, ability: true })).toBe('yaptırabilir');
    expect(form('yapmak', { ...opts, passive: true, ability: true })).toBe('yaptırılabilir');
    expect(form('okumak', { ...opts, passive: true })).toBe('okutulur');
  });

  it('verbindet sich mit idi und bildet saubere Bausteine', () => {
    const r = conjugate('yapmak', {
      tense: 'present',
      person: '1sg',
      causative: true,
      compound: 'past',
    });
    expect(r.form).toBe('yaptırıyordum');
    expect(r.segments.slice(0, 2)).toEqual([
      { tag: 'STEM', text: 'yap' },
      { tag: 'CAUS', text: 'tır' },
    ]);
    expect(r.steps).toContainEqual({ tag: 'CAUS', rule: 'causative', kind: 'dir', chose: 'tır' });
  });

  it('Verbverbindungen: das letzte Wort entscheidet', () => {
    expect(form('temizlik yapmak', { causative: true })).toBe('temizlik yaptırıyor');
  });

  it('infinite Formen', () => {
    expect(nonfinite('yapmak', { form: 'PART_AN', causative: true }).form).toBe('yaptıran');
    expect(nonfinite('okumak', { form: 'PART_AN', causative: true, passive: true }).form).toBe(
      'okutulan',
    );
    expect(nonfinite('yapmak', { form: 'CV_IP', causative: true }).form).toBe('yaptırıp');
    expect(
      nonfinite('yapmak', { form: 'PART_DIK', causative: true, tags: ['POSS_1SG'] }).form,
    ).toBe('yaptırdığım');
  });

  it('Kausativ und Reziprok zugleich nur als eigene Vokabel', () => {
    expect(() => form('görmek', { causative: true, reciprocal: true })).toThrow(MorphError);
  });
});

describe('Reziprok', () => {
  it.each([
    ['görmek', 'görüşüyor'],
    ['bakmak', 'bakışıyor'],
    ['anlamak', 'anlaşıyor'],
  ])('%s → %s', (verb, expected) => {
    expect(form(verb, { reciprocal: true })).toBe(expected);
  });

  it('Aorist und Partizip', () => {
    expect(form('görmek', { reciprocal: true, tense: 'aorist' })).toBe('görüşür');
    expect(nonfinite('görmek', { form: 'VN_MAK', reciprocal: true }).form).toBe('görüşmek');
  });
});

describe('Verlauf -mAktA', () => {
  it.each([
    ['1sg', 'gelmekteyim'],
    ['2sg', 'gelmektesin'],
    ['3sg', 'gelmekte'],
    ['1pl', 'gelmekteyiz'],
    ['2pl', 'gelmektesiniz'],
    ['3pl', 'gelmekteler'],
  ] as const)('%s → %s', (person, expected) => {
    expect(form('gelmek', { tense: 'mekte', person })).toBe(expected);
  });

  it('Verneinung, Frage, idi, Passiv', () => {
    expect(form('yapmak', { tense: 'mekte', negative: true })).toBe('yapmamakta');
    expect(form('gelmek', { tense: 'mekte', question: true, person: '2sg' })).toBe(
      'gelmekte misin',
    );
    expect(form('gelmek', { tense: 'mekte', compound: 'past' })).toBe('gelmekteydi');
    expect(form('yapmak', { tense: 'mekte', passive: true })).toBe('yapılmakta');
  });
});

describe('-DIr am Verb', () => {
  it.each([
    ['evidential', 'gelmiştir'],
    ['present', 'geliyordur'],
    ['future', 'gelecektir'],
    ['necessitative', 'gelmelidir'],
    ['mekte', 'gelmektedir'],
  ] as const)('%s → %s', (tense, expected) => {
    expect(form('gelmek', { tense, dir: true })).toBe(expected);
  });

  it('3. Plural, Verneinung, Passiv, Harmonie', () => {
    expect(form('gelmek', { tense: 'evidential', dir: true, person: '3pl' })).toBe('gelmişlerdir');
    expect(form('gelmek', { tense: 'evidential', dir: true, negative: true })).toBe('gelmemiştir');
    expect(form('yapmak', { tense: 'mekte', dir: true, passive: true })).toBe('yapılmaktadır');
    expect(form('okumak', { tense: 'evidential', dir: true })).toBe('okumuştur');
  });

  it('nur 3. Person, ohne Frage und Kopula, nicht nach -DI und Aorist', () => {
    expect(() => form('gelmek', { tense: 'evidential', dir: true, person: '1sg' })).toThrow(
      MorphError,
    );
    expect(() => form('gelmek', { tense: 'past', dir: true })).toThrow(MorphError);
    expect(() => form('gelmek', { tense: 'aorist', dir: true })).toThrow(MorphError);
    expect(() => form('gelmek', { tense: 'present', dir: true, question: true })).toThrow(
      MorphError,
    );
    expect(() => form('gelmek', { tense: 'present', dir: true, compound: 'past' })).toThrow(
      MorphError,
    );
  });
});

describe('Nominalsatz: Stammwandel vor -(y)Im/-(y)Iz', () => {
  it.each([
    [{ form: 'hak', doubles: true }, '1sg', 'hakkım'],
    [{ form: 'zıt', doubles: true, softens: true }, '1pl', 'zıddız'],
    [{ form: 'oğul', dropsVowel: true }, '1sg', 'oğlum'],
    [{ form: 'çocuk', softens: true }, '1sg', 'çocuğum'],
    [{ form: 'çocuk', softens: true }, '2sg', 'çocuksun'],
    [{ form: 'hak', doubles: true }, '2sg', 'haksın'],
    [{ form: 'öğrenci' }, '1sg', 'öğrenciyim'],
  ] as const)('%o, %s → %s', (stem, person, expected) => {
    expect(predicate(stem, { person }).form).toBe(expected);
  });

  it('bleibt in Frage und Verneinung unverändert', () => {
    const hak = { form: 'hak', doubles: true };
    expect(predicate(hak, { person: '1sg', question: true }).form).toBe('hak mıyım');
    expect(predicate(hak, { person: '1sg', negative: true }).form).toBe('hak değilim');
  });
});

describe('ye- im Imperativ', () => {
  it('hebt auch im Mehrwortverb, de- nicht', () => {
    const imp = { tense: 'imperative', person: '2pl' } as const;
    expect(conjugate('yemek', imp).form).toBe('yiyin');
    expect(conjugate('yemek yemek', imp).form).toBe('yemek yiyin');
    expect(conjugate('evet demek', imp).form).toBe('evet deyin');
  });
});

describe('Review E4', () => {
  it('kein eigener Kausativ: Flag none', () => {
    expect(() => form({ form: 'bozulmak', causative: 'none' }, { causative: true })).toThrow(
      MorphError,
    );
    expect(form({ form: 'bozulmak', causative: 'none' }, {})).toBe('bozuluyor');
  });

  it('einsilbig auf Vokal nimmt -DIr', () => {
    expect(form('yumak', { causative: true })).toBe('yuduruyor');
    expect(form('evet demek', { causative: true })).toBe('evet dedirtiyor');
  });

  it('Reziprok nicht von de-/ye-', () => {
    expect(() => form('demek', { reciprocal: true })).toThrow(MorphError);
    expect(() => form('yemek', { reciprocal: true })).toThrow(MorphError);
  });

  it('imiş nach -mekte', () => {
    expect(form('yapmak', { tense: 'mekte', compound: 'evidential', passive: true })).toBe(
      'yapılmaktaymış',
    );
  });

  it('-lAr und -DIr: Haupt- und Nebenform', () => {
    const opts = { person: '3pl', dir: true } as const;
    expect(form('gelmek', { ...opts, tense: 'mekte' })).toBe('gelmektedirler');
    expect(form('gelmek', { ...opts, tense: 'necessitative' })).toBe('gelmelidirler');
    expect(form('gelmek', { ...opts, tense: 'evidential' })).toBe('gelmişlerdir');
    expect(conjugateVariants('gelmek', { ...opts, tense: 'mekte' })).toEqual(['gelmektelerdir']);
    expect(conjugateVariants('gelmek', { ...opts, tense: 'evidential' })).toEqual(['gelmiştirler']);
    expect(conjugateVariants('gelmek', { ...opts, tense: 'evidential', person: '3sg' })).toEqual(
      [],
    );
  });
});
