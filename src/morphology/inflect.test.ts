import { describe, expect, it } from 'vitest';
import { inflect, inflectVariants, MorphError, type Stem } from './index';
import type { MorphTag } from './tags';

type Case = [stem: Stem | string, tags: MorphTag[], expected: string];

const kitap: Stem = { form: 'kitap', softens: true };
const saat: Stem = { form: 'saat', harmonyVowel: 'e' };

const cases: Case[] = [
  // ev: hell, ungerundet, konsonantisch
  ['ev', ['PL'], 'evler'],
  ['ev', ['PL', 'LOC'], 'evlerde'],
  ['ev', ['PL', 'POSS_1PL', 'ABL'], 'evlerimizden'],
  ['ev', ['POSS_1SG'], 'evim'],
  ['ev', ['ACC'], 'evi'],
  ['ev', ['POSS_3SG', 'LOC'], 'evinde'],
  ['ev', ['POSS_3SG', 'DAT'], 'evine'],
  ['ev', ['GEN'], 'evin'],
  ['ev', ['INS'], 'evle'],
  ['ev', ['POSS_3PL'], 'evleri'],
  ['ev', ['PL', 'POSS_3PL'], 'evleri'],
  // kitap: Erweichung nur vor Vokal, Assimilation vor Konsonant
  [kitap, ['ACC'], 'kitabı'],
  [kitap, ['DAT'], 'kitaba'],
  [kitap, ['POSS_1SG'], 'kitabım'],
  [kitap, ['LOC'], 'kitapta'],
  [kitap, ['ABL'], 'kitaptan'],
  [kitap, ['INS'], 'kitapla'],
  [kitap, ['PL'], 'kitaplar'],
  // okul, göz: gerundete Vokale
  ['okul', ['LOC'], 'okulda'],
  ['okul', ['DAT'], 'okula'],
  ['okul', ['ACC'], 'okulu'],
  ['göz', ['PL'], 'gözler'],
  ['göz', ['ACC'], 'gözü'],
  // araba: vokalischer Auslaut, Pufferlaute
  ['araba', ['POSS_1SG'], 'arabam'],
  ['araba', ['POSS_3SG'], 'arabası'],
  ['araba', ['DAT'], 'arabaya'],
  ['araba', ['ACC'], 'arabayı'],
  ['araba', ['GEN'], 'arabanın'],
  ['araba', ['POSS_3SG', 'LOC'], 'arabasında'],
  ['araba', ['INS'], 'arabayla'],
  ['kedi', ['GEN'], 'kedinin'],
  // Erweichung k→ğ, nk→ng, ç→c; ohne Flag keine Erweichung
  [{ form: 'çocuk', softens: true }, ['ACC'], 'çocuğu'],
  [{ form: 'renk', softens: true }, ['ACC'], 'rengi'],
  [{ form: 'ağaç', softens: true }, ['DAT'], 'ağaca'],
  ['at', ['ACC'], 'atı'],
  // Harmonie-Ausnahmen (Lehnwörter): Harmonie richtet sich nach dem Gehör, nicht der Schrift
  [{ form: 'gol', harmonyVowel: 'ö' }, ['ACC'], 'golü'],
  [{ form: 'gol', harmonyVowel: 'ö' }, ['PL'], 'goller'],
  [{ form: 'kabul', harmonyVowel: 'ü' }, ['POSS_3SG'], 'kabulü'],
  [saat, ['ACC'], 'saati'],
  [saat, ['LOC'], 'saatte'],
  [saat, ['PL'], 'saatler'],
  [saat, ['PL', 'POSS_3PL'], 'saatleri'],
];

const proper = (form: string, extra: Partial<Stem> = {}): Stem => ({
  form,
  proper: true,
  ...extra,
});
const drops = (form: string): Stem => ({ form, dropsVowel: true });

describe('Eigennamen', () => {
  it.each([
    [proper('İstanbul'), ['LOC'], "İstanbul'da"],
    [proper('Frankfurt'), ['LOC'], "Frankfurt'ta"],
    [proper('Berlin'), ['ABL'], "Berlin'den"],
    [proper('Ankara'), ['DAT'], "Ankara'ya"],
    [proper('Mehmet', { softens: true }), ['DAT'], "Mehmet'e"],
    [proper('Ayşe'), ['GEN'], "Ayşe'nin"],
    [proper('Almanya'), ['LOC'], "Almanya'da"],
    [proper('Türkiye'), ['DAT'], "Türkiye'ye"],
  ] as Case[])('%o + %j → %s', (stem, tags, expected) => {
    expect(inflect(stem, tags).form).toBe(expected);
  });

  it('behält die Großschreibung im Stamm-Segment', () => {
    expect(inflect(proper('İzmir'), ['LOC']).segments[0]).toEqual({ tag: 'STEM', text: 'İzmir' });
  });
});

describe('Vokalausfall', () => {
  it.each([
    [drops('ağız'), ['POSS_1SG'], 'ağzım'],
    [drops('ağız'), ['POSS_3SG'], 'ağzı'],
    [drops('burun'), ['ACC'], 'burnu'],
    [drops('oğul'), ['POSS_1SG'], 'oğlum'],
    [drops('oğul'), ['POSS_3SG'], 'oğlu'],
    [drops('isim'), ['POSS_1SG'], 'ismim'],
    [drops('şehir'), ['ACC'], 'şehri'],
    [drops('şehir'), ['LOC'], 'şehirde'],
    [drops('ağız'), ['PL'], 'ağızlar'],
    [drops('oğul'), ['PL', 'POSS_1SG'], 'oğullarım'],
  ] as Case[])('%o + %j → %s', (stem, tags, expected) => {
    expect(inflect(stem, tags).form).toBe(expected);
  });

  it('begründet den Vokalausfall', () => {
    expect(inflect(drops('oğul'), ['POSS_1SG']).steps).toContainEqual(
      expect.objectContaining({ rule: 'vowel_drop', vowel: 'u' }),
    );
  });
});

describe('inflect', () => {
  it.each(cases)('%o + %j → %s', (stem, tags, expected) => {
    expect(inflect(stem, tags).form).toBe(expected);
  });

  it('normalisiert Groß/Klein türkisch-korrekt', () => {
    expect(inflect('KIZ', ['PL']).form).toBe('kızlar');
    expect(inflect('İŞ', ['LOC']).form).toBe('işte');
  });

  it('liefert Segmente für Zerlegungsübungen', () => {
    expect(inflect('ev', ['PL', 'POSS_1PL', 'ABL']).segments).toEqual([
      { tag: 'STEM', text: 'ev' },
      { tag: 'PL', text: 'ler' },
      { tag: 'POSS_1PL', text: 'imiz' },
      { tag: 'ABL', text: 'den' },
    ]);
  });

  it('begründet die Harmonie im Trace', () => {
    expect(inflect('ev', ['LOC']).steps).toContainEqual({
      tag: 'LOC',
      rule: 'harmony2',
      vowel: 'e',
      front: true,
      rounded: false,
      chose: 'e',
    });
  });

  it('begründet Erweichung, Assimilation, Puffer und pronominales n', () => {
    expect(inflect(kitap, ['ACC']).steps).toContainEqual({
      tag: 'ACC',
      rule: 'softening',
      from: 'p',
      to: 'b',
    });
    expect(inflect(kitap, ['LOC']).steps).toContainEqual({
      tag: 'LOC',
      rule: 'assimilation',
      after: 'p',
      chose: 't',
    });
    expect(inflect('araba', ['DAT']).steps).toContainEqual({
      tag: 'DAT',
      rule: 'buffer',
      letter: 'y',
    });
    expect(inflect('ev', ['POSS_3SG', 'LOC']).steps).toContainEqual({
      tag: 'LOC',
      rule: 'pronominal_n',
    });
  });

  it('lehnt falsche Suffixreihenfolge ab', () => {
    expect(() => inflect('ev', ['LOC', 'PL'])).toThrow(MorphError);
    expect(() => inflect('ev', ['LOC', 'ABL'])).toThrow(MorphError);
  });

  it('lehnt Stamm ohne Vokal ab', () => {
    expect(() => inflect('brr', ['PL'])).toThrow(MorphError);
  });
});

describe('Verdopplung', () => {
  const hak = { form: 'hak', doubles: true };
  it.each([
    [hak, ['ACC'], 'hakkı'],
    [hak, ['POSS_1SG'], 'hakkım'],
    [hak, ['POSS_3SG', 'LOC'], 'hakkında'],
    [hak, ['DAT'], 'hakka'],
    [hak, ['LOC'], 'hakta'],
    [hak, ['PL'], 'haklar'],
    [hak, ['ABL'], 'haktan'],
    [{ form: 'his', doubles: true }, ['ACC'], 'hissi'],
    [{ form: 'sır', doubles: true }, ['POSS_1PL'], 'sırrımız'],
    [{ form: 'af', doubles: true }, ['ACC'], 'affı'],
    [{ form: 'ret', doubles: true, softens: true }, ['ACC'], 'reddi'],
    [{ form: 'ret', doubles: true, softens: true }, ['LOC'], 'rette'],
  ] as const)('%o + %j → %s', (stem, tags, form) => {
    expect(inflect(stem, [...tags]).form).toBe(form);
  });

  it('nennt den Schritt und hält den Stamm zusammen', () => {
    const r = inflect(hak, ['ACC']);
    expect(r.segments).toEqual([
      { tag: 'STEM', text: 'hakk' },
      { tag: 'ACC', text: 'ı' },
    ]);
    expect(r.steps).toContainEqual({ tag: 'ACC', rule: 'doubling', letter: 'k' });
  });
});

describe('Possessiv ohne Puffer-s (cami, mevzu)', () => {
  const cami = { form: 'cami', possNoS: true };
  it.each([
    [cami, ['POSS_3SG'], 'camii'],
    [cami, ['POSS_3SG', 'LOC'], 'camiinde'],
    [cami, ['POSS_3SG', 'ACC'], 'camiini'],
    [{ form: 'mevzu', possNoS: true }, ['POSS_3SG'], 'mevzuu'],
    // Nur die 3. Person ist besonders.
    [cami, ['ACC'], 'camiyi'],
    [cami, ['DAT'], 'camiye'],
    [cami, ['POSS_1SG'], 'camim'],
    [cami, ['PL'], 'camiler'],
  ] as const)('%o + %j → %s', (stem, tags, form) => {
    expect(inflect(stem, [...tags]).form).toBe(form);
  });
});

describe('Nebenform mit Puffer-s', () => {
  it('nur bei poss_no_s und Possessiv 3. Sg.', () => {
    const cami = { form: 'cami', possNoS: true };
    expect(inflectVariants(cami, ['POSS_3SG'])).toEqual(['camisi']);
    expect(inflectVariants(cami, ['POSS_3SG', 'LOC'])).toEqual(['camisinde']);
    expect(inflectVariants(cami, ['ACC'])).toEqual([]);
    expect(inflectVariants('ev', ['POSS_3SG'])).toEqual([]);
  });
});

describe('Zirkumflex (â, î, û)', () => {
  it.each([
    ['kâr', ['ACC'], 'kârı'],
    ['dükkân', ['LOC'], 'dükkânda'],
    ['sükûn', ['ACC'], 'sükûnu'],
    ['rüzgâr', ['PL'], 'rüzgârlar'],
    ['millî', ['LIK'], 'millîlik'],
  ] as const)('%s + %j → %s', (stem, tags, form) => {
    expect(inflect(stem, [...tags]).form).toBe(form);
  });
});

describe('y-Stamm (su, ne)', () => {
  const su = { form: 'su', yStem: true };

  it('ne zeigt in der 3. Person kein y', () => {
    const ne = { form: 'ne', yStem: true };
    expect(inflect(ne, ['POSS_3SG']).form).toBe('nesi');
    expect(inflect(ne, ['POSS_1SG']).form).toBe('neyim');
    expect(inflect(ne, ['ACC']).form).toBe('neyi');
  });
  it.each([
    [['GEN'], 'suyun'],
    [['POSS_1SG'], 'suyum'],
    [['POSS_2SG'], 'suyun'],
    [['POSS_3SG'], 'suyu'],
    [['POSS_1PL'], 'suyumuz'],
    [['POSS_2PL'], 'suyunuz'],
    [['POSS_3PL'], 'suları'],
    [['ACC'], 'suyu'],
    [['DAT'], 'suya'],
    [['LOC'], 'suda'],
    [['ABL'], 'sudan'],
    [['PL'], 'sular'],
    [['POSS_3SG', 'LOC'], 'suyunda'],
  ] as const)('su + %s → %s', (tags, form) => {
    expect(inflect(su, [...tags]).form).toBe(form);
  });

  it('ne: neyin, neyi, neye', () => {
    const ne = { form: 'ne', yStem: true };
    expect(inflect(ne, ['GEN']).form).toBe('neyin');
    expect(inflect(ne, ['ACC']).form).toBe('neyi');
    expect(inflect(ne, ['DAT']).form).toBe('neye');
  });

  it('Baustein und Begründung: su + yun', () => {
    const r = inflect(su, ['GEN']);
    expect(r.segments.map((s) => s.text)).toEqual(['su', 'yun']);
    expect(r.steps).toContainEqual({ tag: 'GEN', rule: 'buffer', letter: 'y' });
  });
});
