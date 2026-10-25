import { describe, expect, it } from 'vitest';
import { inflect, MorphError, type Stem } from './index';
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

  // Bekannte Grenzen, siehe KNOWN_LIMITS in inflect.ts und docs/ENGINE_GAPS.md
  it.todo('Konsonantenverdopplung: hak → hakkı, his → hissi, ret → reddi');
  it.todo('Stumme Endung (arab. ʿain): cami → camii (umgangssprachlich auch camisi)');
  it.todo('Unregelmäßig: su → suyun (Gen.), suyu (Poss. 3. Sg.); ne → neyi');
});
