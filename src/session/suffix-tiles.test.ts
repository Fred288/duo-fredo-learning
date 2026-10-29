import { describe, expect, it } from 'vitest';
import type { Exercise, Vocab } from '../content/schema';
import { grade } from './grade';
import { suffixTiles } from './suffix-tiles';

type SB = Extract<Exercise, { type: 'suffix_builder' }>;
const sb = (stem: string, suffixes: SB['suffixes'], target: string): SB => ({
  id: `x-${stem}`,
  type: 'suffix_builder',
  stem,
  suffixes,
  target,
});
const kitap: Vocab = { tr: 'kitap', de: ['Buch'], pos: 'noun', softens: true };

describe('suffixTiles', () => {
  it('enthält die richtigen Segmente und falsche Harmonie-Varianten', () => {
    const { tokens } = suffixTiles(sb('ev', ['PL', 'LOC'], 'evlerde'), []);
    expect(tokens).toEqual(expect.arrayContaining(['ev', 'ler', 'de']));
    expect(tokens).toContain('lar'); // falsche Harmonie als Ablenker
    expect(tokens.length).toBeGreaterThan(3);
  });

  it('bietet bei Erweichung die ungeänderte Stammform als Ablenker', () => {
    const { tokens, solution } = suffixTiles(sb('kitap', ['ACC'], 'kitabı'), [kitap]);
    expect(solution.form).toBe('kitabı');
    expect(tokens).toEqual(expect.arrayContaining(['kitab', 'ı', 'kitap']));
  });

  it('ist deterministisch', () => {
    const ex = sb('göz', ['PL'], 'gözler');
    expect(suffixTiles(ex, []).tokens).toEqual(suffixTiles(ex, []).tokens);
  });

  it('aus den Bausteinen lässt sich die Lösung bauen und wird als richtig bewertet', () => {
    const ex = sb('okul', ['PL', 'LOC'], 'okullarda');
    const { solution } = suffixTiles(ex, []);
    const answer = solution.segments.map((s) => s.text).join('');
    expect(grade(ex, answer, { tolerateDiacritics: true }).verdict).toBe('correct');
  });
});

describe('grade suffix_builder', () => {
  const ex = sb('ev', ['LOC'], 'evde');
  it('akzeptiert nur die exakte Form', () => {
    expect(grade(ex, 'evde', { tolerateDiacritics: true }).verdict).toBe('correct');
    expect(grade(ex, 'evda', { tolerateDiacritics: true }).verdict).toBe('wrong');
  });
});

describe('suffixTiles: infinite Formen', () => {
  it('Verbstamm mit Erweichung, Partizip und Possessiv', () => {
    const ex: SB = {
      id: 'x-gid',
      type: 'suffix_builder',
      stem: 'gitmek',
      verbal: 'PART_ACAK',
      suffixes: ['POSS_1SG'],
      target: 'gideceğim',
    };
    const git: Vocab = { tr: 'gitmek', de: ['gehen'], pos: 'verb', softens: true };
    const { tokens, solution } = suffixTiles(ex, [git]);
    expect(solution.form).toBe('gideceğim');
    expect(tokens).toEqual(expect.arrayContaining(['gid', 'eceğ', 'im', 'git']));
    expect(grade(ex, 'gideceğim', { tolerateDiacritics: true }).verdict).toBe('correct');
  });

  it('Konverb ohne Endungen', () => {
    const ex: SB = {
      id: 'x-gel',
      type: 'suffix_builder',
      stem: 'gelmek',
      verbal: 'CV_INCA',
      suffixes: [],
      target: 'gelince',
    };
    const { tokens } = suffixTiles(ex, []);
    expect(tokens).toEqual(expect.arrayContaining(['gel', 'ince']));
    expect(tokens.length).toBeGreaterThan(2); // eine Variante von -(y)IncA als Ablenker
  });
});

describe('suffixTiles: erweichtes Partizip', () => {
  it('Ablenker mit ğ und die unerweichte Form', () => {
    const ex: SB = {
      id: 'x-oku',
      type: 'suffix_builder',
      stem: 'okumak',
      verbal: 'PART_DIK',
      suffixes: ['POSS_1SG'],
      target: 'okuduğum',
    };
    const { tokens } = suffixTiles(ex, []);
    expect(tokens).toEqual(expect.arrayContaining(['oku', 'duğ', 'um', 'duk']));
    expect(tokens.filter((t) => t.endsWith('ğ')).length).toBeGreaterThan(1);
  });
});
