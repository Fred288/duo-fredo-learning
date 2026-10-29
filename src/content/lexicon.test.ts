import { describe, expect, it } from 'vitest';
import { formVariants, withAlternatives } from './lexicon';
import type { Exercise } from './schema';

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
