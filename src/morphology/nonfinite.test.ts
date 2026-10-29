import { describe, expect, it } from 'vitest';
import { MorphError } from './inflect';
import { nonfinite, type NonfiniteOptions } from './nonfinite';
import type { MorphTag } from './tags';
import type { VerbStem } from './verb';

const f = (verb: VerbStem | string, opts: NonfiniteOptions) => nonfinite(verb, opts).form;
const git = { form: 'gitmek', softens: true };
const et = { form: 'ziyaret etmek', softens: true };
const POSS: MorphTag[] = ['POSS_1SG', 'POSS_2SG', 'POSS_3SG', 'POSS_1PL', 'POSS_2PL', 'POSS_3PL'];

describe('Partizip -(y)An', () => {
  it.each([
    ['gelmek', 'gelen'],
    ['yapmak', 'yapan'],
    ['okumak', 'okuyan'],
    ['görmek', 'gören'],
    ['beklemek', 'bekleyen'],
  ])('%s → %s', (verb, form) => {
    expect(f(verb, { form: 'PART_AN' })).toBe(form);
  });

  it('Plural und Kasus, Verneinung, Erweichung, Hebung', () => {
    expect(f('gelmek', { form: 'PART_AN', tags: ['PL'] })).toBe('gelenler');
    expect(f('gelmek', { form: 'PART_AN', tags: ['PL', 'DAT'] })).toBe('gelenlere');
    expect(f('okumak', { form: 'PART_AN', tags: ['ACC'] })).toBe('okuyanı');
    expect(f('gelmek', { form: 'PART_AN', negative: true })).toBe('gelmeyen');
    expect(f(git, { form: 'PART_AN' })).toBe('giden');
    expect(f(et, { form: 'PART_AN' })).toBe('ziyaret eden');
    expect(f('yemek', { form: 'PART_AN' })).toBe('yiyen');
    expect(f('demek', { form: 'PART_AN' })).toBe('diyen');
    expect(f('yemek', { form: 'PART_AN', negative: true })).toBe('yemeyen');
  });

  it('Passiv und können', () => {
    expect(f('yapmak', { form: 'PART_AN', passive: true })).toBe('yapılan');
    expect(f('okumak', { form: 'PART_AN', passive: true })).toBe('okunan');
    expect(f('gelmek', { form: 'PART_AN', ability: true })).toBe('gelebilen');
    expect(f('gelmek', { form: 'PART_AN', ability: true, negative: true })).toBe('gelemeyen');
  });

  it('Bausteine', () => {
    const r = nonfinite('okumak', { form: 'PART_AN', tags: ['PL', 'ACC'] });
    expect(r.segments.map((s) => [s.tag, s.text])).toEqual([
      ['STEM', 'oku'],
      ['PART_AN', 'yan'],
      ['PL', 'lar'],
      ['ACC', 'ı'],
    ]);
  });
});

describe('Partizip -DIk mit Possessiv', () => {
  it('alle Personen mit Erweichung k → ğ', () => {
    expect(POSS.map((p) => f('okumak', { form: 'PART_DIK', tags: [p] }))).toEqual([
      'okuduğum',
      'okuduğun',
      'okuduğu',
      'okuduğumuz',
      'okuduğunuz',
      'okudukları',
    ]);
    expect(POSS.map((p) => f('gelmek', { form: 'PART_DIK', tags: [p] }))).toEqual([
      'geldiğim',
      'geldiğin',
      'geldiği',
      'geldiğimiz',
      'geldiğiniz',
      'geldikleri',
    ]);
  });

  it('Assimilation, Kasus, indirekte Rede', () => {
    expect(f(git, { form: 'PART_DIK', tags: ['POSS_1SG'] })).toBe('gittiğim');
    expect(f('yapmak', { form: 'PART_DIK', tags: ['POSS_3SG'] })).toBe('yaptığı');
    expect(f('gelmek', { form: 'PART_DIK', tags: ['POSS_3SG', 'ACC'] })).toBe('geldiğini');
    expect(f('gelmek', { form: 'PART_DIK', tags: ['POSS_1SG', 'ACC'] })).toBe('geldiğimi');
    expect(f('gelmek', { form: 'PART_DIK', tags: ['POSS_3SG', 'LOC'] })).toBe('geldiğinde');
    expect(f('gelmek', { form: 'PART_DIK', tags: ['ABL'] })).toBe('geldikten');
    expect(f('gelmek', { form: 'PART_DIK', tags: ['POSS_3SG'], negative: true })).toBe('gelmediği');
    expect(f('okumak', { form: 'PART_DIK', tags: ['PL', 'POSS_1SG'] })).toBe('okuduklarım');
    expect(f('yapmak', { form: 'PART_DIK', tags: ['POSS_3SG'], passive: true })).toBe('yapıldığı');
    expect(f(et, { form: 'PART_DIK', tags: ['POSS_1SG'] })).toBe('ziyaret ettiğim');
  });

  it('Bausteine mit erweichtem Auslaut', () => {
    const r = nonfinite('okumak', { form: 'PART_DIK', tags: ['POSS_1SG', 'ACC'] });
    expect(r.segments.map((s) => [s.tag, s.text])).toEqual([
      ['STEM', 'oku'],
      ['PART_DIK', 'duğ'],
      ['POSS_1SG', 'um'],
      ['ACC', 'u'],
    ]);
  });

  it('ohne Possessiv nur mit Ablativ', () => {
    expect(() => nonfinite('gelmek', { form: 'PART_DIK' })).toThrow(MorphError);
    expect(() => nonfinite('gelmek', { form: 'PART_DIK', tags: ['DAT'] })).toThrow(MorphError);
  });
});

describe('Partizip -(y)AcAk', () => {
  it('ohne und mit Possessiv', () => {
    expect(f('gelmek', { form: 'PART_ACAK' })).toBe('gelecek');
    expect(f('okumak', { form: 'PART_ACAK' })).toBe('okuyacak');
    expect(POSS.map((p) => f('okumak', { form: 'PART_ACAK', tags: [p] }))).toEqual([
      'okuyacağım',
      'okuyacağın',
      'okuyacağı',
      'okuyacağımız',
      'okuyacağınız',
      'okuyacakları',
    ]);
    expect(f('gelmek', { form: 'PART_ACAK', tags: ['POSS_3SG', 'ACC'] })).toBe('geleceğini');
    expect(f(git, { form: 'PART_ACAK', tags: ['POSS_1SG'] })).toBe('gideceğim');
    expect(f('yemek', { form: 'PART_ACAK' })).toBe('yiyecek');
    expect(f('gelmek', { form: 'PART_ACAK', negative: true })).toBe('gelmeyecek');
  });

  it('ohne Possessiv kein Kasus', () => {
    expect(() => nonfinite('gelmek', { form: 'PART_ACAK', tags: ['ACC'] })).toThrow(MorphError);
  });
});

describe('Verbalnomen -mA, -mAk, -(y)Iş', () => {
  it('-mA mit Possessiv und Kasus', () => {
    expect(f('gelmek', { form: 'VN_MA' })).toBe('gelme');
    expect(f('gelmek', { form: 'VN_MA', tags: ['POSS_3SG'] })).toBe('gelmesi');
    expect(f('gelmek', { form: 'VN_MA', tags: ['POSS_1SG'] })).toBe('gelmem');
    expect(f('gelmek', { form: 'VN_MA', tags: ['POSS_2SG', 'ACC'] })).toBe('gelmeni');
    expect(f('gelmek', { form: 'VN_MA', tags: ['POSS_3SG', 'ACC'] })).toBe('gelmesini');
    expect(f('okumak', { form: 'VN_MA', tags: ['ACC'] })).toBe('okumayı');
    expect(f('okumak', { form: 'VN_MA', tags: ['DAT'] })).toBe('okumaya');
    expect(f('gelmek', { form: 'VN_MA', tags: ['POSS_3SG'], negative: true })).toBe('gelmemesi');
    expect(f(git, { form: 'VN_MA', tags: ['POSS_1PL'] })).toBe('gitmemiz');
  });

  it('-mAk nur ohne Endung, mit Lokativ, Ablativ, Instrumental', () => {
    expect(f('gelmek', { form: 'VN_MAK' })).toBe('gelmek');
    expect(f('yapmak', { form: 'VN_MAK', tags: ['LOC'] })).toBe('yapmakta');
    expect(f('gelmek', { form: 'VN_MAK', tags: ['ABL'] })).toBe('gelmekten');
    expect(f('okumak', { form: 'VN_MAK', tags: ['INS'] })).toBe('okumakla');
    expect(f('gelmek', { form: 'VN_MAK', negative: true })).toBe('gelmemek');
    expect(() => nonfinite('gelmek', { form: 'VN_MAK', tags: ['ACC'] })).toThrow(MorphError);
    expect(() => nonfinite('gelmek', { form: 'VN_MAK', tags: ['DAT'] })).toThrow(MorphError);
  });

  it('-(y)Iş wie ein Nomen', () => {
    expect(f('gelmek', { form: 'VN_IS' })).toBe('geliş');
    expect(f('okumak', { form: 'VN_IS' })).toBe('okuyuş');
    expect(f(git, { form: 'VN_IS', tags: ['POSS_3SG'] })).toBe('gidişi');
    expect(f('demek', { form: 'VN_IS' })).toBe('deyiş');
    expect(f('yemek', { form: 'VN_IS' })).toBe('yiyiş');
  });
});

describe('Konverbien', () => {
  it.each([
    ['CV_IP', 'gelip', 'okuyup', 'gidip'],
    ['CV_ARAK', 'gelerek', 'okuyarak', 'giderek'],
    ['CV_INCA', 'gelince', 'okuyunca', 'gidince'],
    ['CV_ALI', 'geleli', 'okuyalı', 'gideli'],
    ['CV_MADAN', 'gelmeden', 'okumadan', 'gitmeden'],
  ] as const)('%s', (form, gel, oku, gid) => {
    expect(f('gelmek', { form })).toBe(gel);
    expect(f('okumak', { form })).toBe(oku);
    expect(f(git, { form })).toBe(gid);
  });

  it('de/ye: gehoben, außer deyip und deyince', () => {
    expect(f('yemek', { form: 'CV_IP' })).toBe('yiyip');
    expect(f('yemek', { form: 'CV_INCA' })).toBe('yiyince');
    expect(f('yemek', { form: 'CV_ARAK' })).toBe('yiyerek');
    expect(f('demek', { form: 'CV_IP' })).toBe('deyip');
    expect(f('demek', { form: 'CV_INCA' })).toBe('deyince');
    expect(f('demek', { form: 'CV_ARAK' })).toBe('diyerek');
    expect(f('demek', { form: 'CV_ALI' })).toBe('diyeli');
  });

  it('Verneinung', () => {
    expect(f('gelmek', { form: 'CV_IP', negative: true })).toBe('gelmeyip');
    expect(f('gelmek', { form: 'CV_ARAK', negative: true })).toBe('gelmeyerek');
    expect(f('gelmek', { form: 'CV_INCA', negative: true })).toBe('gelmeyince');
    expect(() => nonfinite('gelmek', { form: 'CV_MADAN', negative: true })).toThrow(MorphError);
  });

  it('keine Endungen', () => {
    expect(() => nonfinite('gelmek', { form: 'CV_IP', tags: ['PL'] })).toThrow(MorphError);
  });

  it('Bausteine', () => {
    const r = nonfinite('gelmek', { form: 'CV_INCA', negative: true });
    expect(r.segments.map((s) => [s.tag, s.text])).toEqual([
      ['STEM', 'gel'],
      ['NEG', 'me'],
      ['CV_INCA', 'yince'],
    ]);
  });
});

describe('nicht erlaubt', () => {
  it('Ableitungen und -ki', () => {
    expect(() => nonfinite('gelmek', { form: 'VN_MA', tags: ['LI'] })).toThrow(MorphError);
    expect(() => nonfinite('gelmek', { form: 'PART_AN', tags: ['KI'] })).toThrow(MorphError);
  });

  it('Possessiv am Partizip -(y)An', () => {
    expect(() => nonfinite('gelmek', { form: 'PART_AN', tags: ['POSS_1SG'] })).toThrow(MorphError);
  });
});
