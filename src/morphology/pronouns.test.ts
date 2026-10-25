import { describe, expect, it } from 'vitest';
import { PRONOUN_CASES, pronoun } from './pronouns';

// Reihenfolge: NOM, ACC, DAT, LOC, ABL, GEN, INS
const table = {
  ben: ['ben', 'beni', 'bana', 'bende', 'benden', 'benim', 'benimle'],
  sen: ['sen', 'seni', 'sana', 'sende', 'senden', 'senin', 'seninle'],
  o: ['o', 'onu', 'ona', 'onda', 'ondan', 'onun', 'onunla'],
  biz: ['biz', 'bizi', 'bize', 'bizde', 'bizden', 'bizim', 'bizimle'],
  siz: ['siz', 'sizi', 'size', 'sizde', 'sizden', 'sizin', 'sizinle'],
  onlar: ['onlar', 'onları', 'onlara', 'onlarda', 'onlardan', 'onların', 'onlarla'],
  bu: ['bu', 'bunu', 'buna', 'bunda', 'bundan', 'bunun', 'bununla'],
  şu: ['şu', 'şunu', 'şuna', 'şunda', 'şundan', 'şunun', 'şununla'],
} as const;

describe('Pronomen', () => {
  for (const [lemma, forms] of Object.entries(table)) {
    it(lemma, () => {
      expect(PRONOUN_CASES.map((c) => pronoun(lemma as keyof typeof table, c))).toEqual(forms);
    });
  }
});
