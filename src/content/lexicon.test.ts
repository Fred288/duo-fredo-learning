import { describe, expect, it } from 'vitest';
import {
  formSpecOf,
  formVariants,
  solveExercise,
  solveParadigm,
  withAlternatives,
} from './lexicon';
import type { Exercise, Vocab } from './schema';

describe('Nebenformen im Build', () => {
  it('formVariants: nur Verben mit Kopula in der 3. Person Plural', () => {
    expect(
      formVariants({
        kind: 'verb',
        lemma: 'gelmek',
        person: '3pl',
        tense: 'conditional',
        compound: 'past',
      }),
    ).toEqual(['gelseydiler']);
    expect(formVariants({ kind: 'verb', lemma: 'gelmek', person: '3pl' })).toEqual([]);
    expect(formVariants({ kind: 'noun', lemma: 'ev', tags: ['PL'] })).toEqual([]);
  });

  it('withAlternatives trägt alt_targets ein, sonst bleibt die Übung gleich', () => {
    const conj: Exercise = {
      id: 'b1-u01-l2-e1',
      type: 'conjugation',
      mode: 'verb',
      lemma: 'gelmek',
      person: '3pl',
      tense: 'present',
      compound: 'past',
      target: 'geliyorlardı',
    };
    const plain: Exercise = { ...conj, id: 'b1-u01-l2-e2', person: '1sg', target: 'geliyordum' };
    const table: Exercise = {
      id: 'b1-u01-l2-e3',
      type: 'paradigm',
      kind: 'verb',
      lemma: 'gelmek',
      tense: 'present',
      compound: 'past',
      persons: ['1sg', '3pl'],
      targets: ['geliyordum', 'geliyorlardı'],
    };
    const unit = { lessons: [{ exercises: [conj, plain, table] }] };
    const [a, b, c] = withAlternatives(unit, []).lessons[0]!.exercises;
    expect(a).toMatchObject({ alt_targets: ['geliyordular'] });
    expect(b).toBe(plain);
    expect(c).toMatchObject({ alt_targets: [[], ['geliyordular']] });
  });
});

describe('infinite Formen über Übungen', () => {
  it('suffix_builder mit verbal und Tabelle verbal', () => {
    const sb: Exercise = {
      id: 'b1-u08-l2-e1',
      type: 'suffix_builder',
      stem: 'okumak',
      verbal: 'PART_DIK',
      suffixes: ['POSS_1SG', 'ACC'],
      target: 'okuduğumu',
    };
    expect(formSpecOf(sb as never)).toEqual({
      kind: 'verbal',
      lemma: 'okumak',
      form: 'PART_DIK',
      tags: ['POSS_1SG', 'ACC'],
    });
    expect(solveExercise(sb as never).form).toBe('okuduğumu');
    const table = {
      id: 'b1-u08-l2-e2',
      type: 'paradigm',
      kind: 'verbal',
      lemma: 'gelmek',
      verbal: 'PART_DIK',
      negative: true,
      rows: [['POSS_1SG'], ['POSS_3PL']],
      targets: ['gelmediğim', 'gelmedikleri'],
    } as const;
    expect(solveParadigm(table as never).map((r) => r.form)).toEqual([
      'gelmediğim',
      'gelmedikleri',
    ]);
  });
});

describe('Formen für B2', () => {
  it('Kausativ mit Wortschatz-Flag und -dir am Verb', () => {
    const ex = {
      id: 'b2-u02-l2-e1',
      type: 'conjugation',
      mode: 'verb',
      lemma: 'pişmek',
      person: '3sg',
      tense: 'aorist',
      causative: true,
      target: 'pişirir',
    } as Exercise;
    const vocab: Vocab[] = [{ tr: 'pişmek', de: ['kochen'], pos: 'verb', causative: 'ir' }];
    expect(solveExercise(ex as never, vocab).form).toBe('pişirir');
    expect(formSpecOf(ex as never)).toMatchObject({ causative: true });
    const dir = { ...ex, lemma: 'gelmek', tense: 'mekte', causative: undefined, dir: true };
    expect(solveExercise(dir as never).form).toBe('gelmektedir');
  });
});
