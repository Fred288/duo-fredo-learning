import { describe, expect, it } from 'vitest';
import { sectionSlug } from '../content/explainer-section';
import { Unit } from '../content/schema';
import { buildLookup, duplicateSlugs } from './index-build';
import { exactKey, searchKey } from './key';

describe('searchKey', () => {
  it('faltet türkische Sonderzeichen und alle i-Varianten', () => {
    expect(searchKey('şğçöüı')).toBe('sgcoui');
    expect(searchKey('İSTANBUL')).toBe('istanbul');
    expect(searchKey('ILIK')).toBe('ilik');
    expect(searchKey('Ich')).toBe('ich');
  });
  it('faltet deutsche Umlaute und ß, Zirkumflex', () => {
    expect(searchKey('Mädchen Straße')).toBe('madchen strasse');
    expect(searchKey('kâğıt')).toBe('kagit');
  });
  it('entfernt Apostroph und Satzzeichen', () => {
    expect(searchKey("İstanbul'da")).toBe('istanbulda');
    expect(searchKey('  mit: ile / -le, -la ')).toBe('mit ile le la');
  });
  it('exactKey behält Sonderzeichen', () => {
    expect(exactKey('Işık')).toBe('ışık');
    expect(exactKey("İstanbul'da")).toBe('istanbulda');
  });
});

describe('sectionSlug', () => {
  it('bildet lesbare Anker', () => {
    expect(sectionSlug('mit: ile / -le, -la')).toBe('mit-ile-le-la');
    expect(sectionSlug('Groß und klein: **zwei** i')).toBe('gross-und-klein-zwei-i');
  });
  it('findet doppelte Überschriften', () => {
    expect(duplicateSlugs('## Plural\na\n## Kasus\n## plural!\n')).toEqual(['plural']);
    expect(duplicateSlugs('## a\n## b\n')).toEqual([]);
  });
});

const unit = (id: string, extra: object = {}) =>
  Unit.parse({
    id,
    level: 'A1',
    title: `Titel ${id}`,
    source: 'eigene Formulierung',
    license: 'CC BY-SA 4.0',
    lessons: [
      {
        id: `${id}-l1`,
        type: 'vocab',
        title: 'Wörter',
        exercises: [
          {
            id: `${id}-l1-e1`,
            type: 'free_text',
            direction: 'de_tr',
            prompt: 'x',
            answers: ['y'],
          },
        ],
      },
    ],
    ...extra,
  });

describe('buildLookup', () => {
  const units = [
    unit('a1-u01', {
      explainer: 'explainers/a.md',
      vocab: [
        { tr: 'yemek', de: ['essen'], pos: 'verb' },
        { id: 'yemek-essen', tr: 'yemek', de: ['Essen', 'Mahlzeit'], pos: 'noun' },
        { tr: 'kitap', de: ['Buch'], pos: 'noun', softens: true, reviewed: false },
      ],
    }),
    unit('a1-u02', { vocab: [{ tr: 'İstanbul', de: ['Istanbul'], pos: 'noun', proper: true }] }),
  ];
  const md =
    '# Titel\n\nEinleitung\n\n## Wo? -de / -da\n\nev**de**, okul**da**\n\n## Plural\n\nevler\n';
  const index = buildLookup(units, new Map([['explainers/a.md', md]]));

  it('hält Homonyme über vocabId getrennt', () => {
    expect(index.vocab.filter((v) => v.tr === 'yemek').map((v) => [v.id, v.pos])).toEqual([
      ['yemek', 'verb'],
      ['yemek-essen', 'noun'],
    ]);
  });

  it('übernimmt Unit und Engine-Flags, lässt Ballast weg', () => {
    const kitap = index.vocab.find((v) => v.id === 'kitap')!;
    expect(kitap).toMatchObject({ unit: 'a1-u01', softens: true, de: ['Buch'] });
    expect(kitap).not.toHaveProperty('reviewed');
    expect(index.vocab.find((v) => v.id === 'İstanbul')).toMatchObject({
      unit: 'a1-u02',
      proper: true,
    });
  });

  it('teilt Erklärkarten in Abschnitte mit Anker und Suchwörtern', () => {
    expect(index.sections.map((s) => [s.unit, s.title, s.slug])).toEqual([
      ['a1-u01', 'Wo? -de / -da', 'wo-de-da'],
      ['a1-u01', 'Plural', 'plural'],
    ]);
    expect(index.sections[0]!.words).toEqual(['wo', 'de', 'da', 'evde', 'okulda']);
  });

  it('führt Units in Kursreihenfolge mit Titel und Erklärkarte', () => {
    expect(index.units).toEqual([
      { id: 'a1-u01', title: 'Titel a1-u01', explainer: 'explainers/a.md' },
      { id: 'a1-u02', title: 'Titel a1-u02', explainer: undefined },
    ]);
    expect(index.v).toBe(1);
  });
});
