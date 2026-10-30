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

  it('auch ohne Possessiv mit Kasus (das Kommende)', () => {
    expect(f('gelmek', { form: 'PART_ACAK', tags: ['ACC'] })).toBe('geleceği');
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

  it('Possessiv am Partizip -mIş', () => {
    expect(() => nonfinite('gelmek', { form: 'PART_MIS', tags: ['POSS_1SG'] })).toThrow(MorphError);
  });
});

describe('weitere Kombinationen (Review E2)', () => {
  it.each([
    [{ form: 'yapmak' }, { form: 'PART_AN', passive: true, ability: true }, 'yapılabilen'],
    [{ form: 'yapmak' }, { form: 'PART_AN', passive: true, negative: true }, 'yapılmayan'],
    [{ form: 'yapmak' }, { form: 'VN_MA', passive: true, tags: ['POSS_3SG'] }, 'yapılması'],
    [{ form: 'yapmak' }, { form: 'CV_MADAN', passive: true }, 'yapılmadan'],
    [{ form: 'demek' }, { form: 'PART_AN', passive: true }, 'denen'],
    [{ form: 'yemek' }, { form: 'PART_AN', passive: true }, 'yenen'],
    [{ form: 'bilmek' }, { form: 'PART_AN', passive: true }, 'bilinen'],
    [{ form: 'gelmek' }, { form: 'CV_IP', ability: true }, 'gelebilip'],
    [{ form: 'gelmek' }, { form: 'CV_INCA', ability: true, negative: true }, 'gelemeyince'],
    [{ form: 'gelmek' }, { form: 'CV_MADAN', ability: true }, 'gelemeden'],
    [{ form: 'gelmek' }, { form: 'VN_MAK', ability: true }, 'gelebilmek'],
    [{ form: 'gelmek' }, { form: 'VN_MAK', ability: true, negative: true }, 'gelememek'],
    [git, { form: 'VN_MA', ability: true, tags: ['POSS_3SG'] }, 'gidebilmesi'],
    [{ form: 'demek' }, { form: 'PART_AN', ability: true }, 'diyebilen'],
    [{ form: 'yemek' }, { form: 'PART_AN', ability: true, negative: true }, 'yiyemeyen'],
    [{ form: 'demek' }, { form: 'PART_DIK', tags: ['POSS_3SG'] }, 'dediği'],
    [{ form: 'demek' }, { form: 'VN_MA', tags: ['POSS_3SG'] }, 'demesi'],
    [{ form: 'demek' }, { form: 'CV_ARAK', negative: true }, 'demeyerek'],
    [{ form: 'beklemek' }, { form: 'CV_INCA' }, 'bekleyince'],
    [{ form: 'söylemek' }, { form: 'CV_ARAK' }, 'söyleyerek'],
    [{ form: 'beklemek' }, { form: 'PART_AN', passive: true }, 'beklenen'],
    [{ form: 'beklemek' }, { form: 'PART_DIK', tags: ['PL', 'POSS_3SG', 'ACC'] }, 'beklediklerini'],
    [{ form: 'okumak' }, { form: 'PART_DIK', tags: ['POSS_3PL', 'ACC'] }, 'okuduklarını'],
    [{ form: 'gelmek' }, { form: 'PART_DIK', tags: ['POSS_3SG', 'INS'] }, 'geldiğiyle'],
    [{ form: 'gelmek' }, { form: 'VN_MA', tags: ['POSS_3SG', 'GEN'] }, 'gelmesinin'],
    [et, { form: 'CV_IP' }, 'ziyaret edip'],
    [et, { form: 'PART_AN', passive: true }, 'ziyaret edilen'],
    [et, { form: 'PART_AN', ability: true, negative: true }, 'ziyaret edemeyen'],
    [et, { form: 'PART_ACAK', tags: ['POSS_3SG', 'ACC'] }, 'ziyaret edeceğini'],
    [{ form: 'gelmek' }, { form: 'CV_ALI', negative: true }, 'gelmeyeli'],
    [{ form: 'gelmek' }, { form: 'VN_MAK', negative: true, tags: ['ABL'] }, 'gelmemekten'],
    [{ form: 'gelmek' }, { form: 'PART_ACAK', negative: true, tags: ['POSS_1SG'] }, 'gelmeyeceğim'],
  ] as [VerbStem, NonfiniteOptions, string][])('%o + %o → %s', (verb, opts, form) => {
    expect(f(verb, opts)).toBe(form);
  });

  it('Bausteine: gelemeden, ziyaret edeceğini', () => {
    const r = nonfinite('gelmek', { form: 'CV_MADAN', ability: true });
    expect(r.segments.map((s) => [s.tag, s.text])).toEqual([
      ['STEM', 'gel'],
      ['ABIL', 'e'],
      ['CV_MADAN', 'meden'],
    ]);
    const z = nonfinite(et, { form: 'PART_ACAK', tags: ['POSS_3SG', 'ACC'] });
    expect(z.segments.map((s) => s.text)).toEqual(['ziyaret ed', 'eceğ', 'i', 'ni']);
  });

  it('Fehlerfälle', () => {
    expect(() => nonfinite('gelmek', { form: 'CV_MADAN', ability: true, negative: true })).toThrow(
      MorphError,
    );
    expect(() => nonfinite('gelmek', { form: 'VN_MAK', tags: ['PL'] })).toThrow(MorphError);
  });

  it('deyip: Begründung für das erhaltene e', () => {
    expect(nonfinite('demek', { form: 'CV_IP' }).steps).toContainEqual({
      tag: 'CV_IP',
      rule: 'no_raising',
    });
    expect(nonfinite('gelmek', { form: 'CV_IP' }).steps.some((s) => s.rule === 'no_raising')).toBe(
      false,
    );
  });
});

describe('de- in Mehrwortverben', () => {
  it('hebt wie der einfache Stamm, außer vor -ip', () => {
    expect(nonfinite('evet demek', { form: 'PART_AN' }).form).toBe('evet diyen');
    expect(nonfinite('evet demek', { form: 'CV_IP' }).form).toBe('evet deyip');
  });
});

describe('B2-Formen', () => {
  it.each([
    ['gelmek', 'CV_DIKCA', 'geldikçe'],
    ['okumak', 'CV_DIKCA', 'okudukça'],
    ['gitmek', 'CV_DIKCA', 'gittikçe'],
    ['gelmek', 'CV_INCAYA', 'gelinceye'],
    ['gitmek', 'CV_INCAYA', 'gidinceye'],
    ['okumak', 'CV_INCAYA', 'okuyuncaya'],
    ['gelmek', 'CV_MAKSIZIN', 'gelmeksizin'],
    ['yapmak', 'CV_MAKSIZIN', 'yapmaksızın'],
    ['gelmek', 'CV_MAKTANSA', 'gelmektense'],
    ['yapmak', 'CV_MAKTANSA', 'yapmaktansa'],
    ['görmek', 'PART_MIS', 'görmüş'],
  ] as const)('%s + %s → %s', (verb, form, expected) => {
    const stem = verb === 'gitmek' ? { form: verb, softens: true } : verb;
    expect(nonfinite(stem, { form }).form).toBe(expected);
  });

  it('-(y)As braucht genau ein Possessiv', () => {
    const asi = (tags: MorphTag[], verb = 'gelmek') =>
      nonfinite({ form: verb, softens: verb === 'gitmek' }, { form: 'PART_ASI', tags }).form;
    expect(asi(['POSS_1SG'], 'gitmek')).toBe('gidesim');
    expect(asi(['POSS_3SG'])).toBe('gelesi');
    expect(asi(['POSS_2PL'], 'yapmak')).toBe('yapasınız');
    expect(() => asi([])).toThrow(MorphError);
    expect(() => asi(['POSS_1SG', 'ACC'])).toThrow(MorphError);
  });

  it('Endungen an -(y)An und -(y)AcAk', () => {
    const f = (form: 'PART_AN' | 'PART_ACAK', tags: MorphTag[], verb = 'gelmek') =>
      nonfinite(verb, { form, tags }).form;
    expect(f('PART_AN', ['PL', 'POSS_1SG'], 'sevmek')).toBe('sevenlerim');
    expect(f('PART_ACAK', ['PL'])).toBe('gelecekler');
    expect(f('PART_ACAK', ['PL', 'DAT'])).toBe('geleceklere');
    expect(f('PART_ACAK', ['DAT'])).toBe('geleceğe');
  });

  it('-mIş-Partizip ohne Possessiv; verneinte Konverbien', () => {
    expect(nonfinite('görmek', { form: 'PART_MIS', tags: ['PL', 'DAT'] }).form).toBe('görmüşlere');
    expect(() => nonfinite('görmek', { form: 'PART_MIS', tags: ['POSS_1SG'] })).toThrow(MorphError);
    expect(nonfinite('gelmek', { form: 'CV_DIKCA', negative: true }).form).toBe('gelmedikçe');
    expect(nonfinite('gelmek', { form: 'CV_MAKTANSA', negative: true }).form).toBe('gelmemektense');
    expect(() => nonfinite('gelmek', { form: 'CV_MAKSIZIN', negative: true })).toThrow(MorphError);
    expect(nonfinite('gelmek', { form: 'CV_MAKSIZIN', ability: true }).form).toBe('gelemeksizin');
  });

  it('Kausativ, Passiv und „können“ davor', () => {
    expect(nonfinite('yapmak', { form: 'CV_DIKCA', causative: true }).form).toBe('yaptırdıkça');
    expect(nonfinite('yapmak', { form: 'CV_DIKCA', passive: true }).form).toBe('yapıldıkça');
    expect(nonfinite('gelmek', { form: 'CV_DIKCA', ability: true }).form).toBe('gelebildikçe');
  });
});

describe('Review E5', () => {
  it('de- behält das e vor -(y)IncAyA, ye- nicht', () => {
    expect(nonfinite('demek', { form: 'CV_INCAYA' }).form).toBe('deyinceye');
    expect(nonfinite('evet demek', { form: 'CV_INCAYA' }).form).toBe('evet deyinceye');
    expect(nonfinite('yemek', { form: 'CV_INCAYA' }).form).toBe('yiyinceye');
    expect(nonfinite('demek', { form: 'PART_ASI', tags: ['POSS_1SG'] }).form).toBe('diyesim');
  });

  it('-(y)As: verneint ja, 3. Plural nicht', () => {
    expect(nonfinite('gelmek', { form: 'PART_ASI', negative: true, tags: ['POSS_1SG'] }).form).toBe(
      'gelmeyesim',
    );
    expect(() => nonfinite('gelmek', { form: 'PART_ASI', tags: ['POSS_3PL'] })).toThrow(MorphError);
  });

  it('-(y)An mit Possessiv auch ohne Plural', () => {
    expect(nonfinite('sevmek', { form: 'PART_AN', tags: ['POSS_1SG'] }).form).toBe('sevenim');
  });
});
