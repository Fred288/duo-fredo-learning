import type { MorphTag } from './tags';

// Templates in Archiphonem-Notation: A = e/a, I = i/ı/ü/u, D = d/t.
// Klammer: (Vokal) nur nach Konsonant, (Konsonant) nur nach Vokal.
export interface SuffixDef {
  template: string;
  slot: 1 | 2 | 3; // 1 Plural, 2 Possessiv, 3 Kasus
}

export const SUFFIXES: Record<MorphTag, SuffixDef> = {
  PL: { template: 'lAr', slot: 1 },
  POSS_1SG: { template: '(I)m', slot: 2 },
  POSS_2SG: { template: '(I)n', slot: 2 },
  POSS_3SG: { template: '(s)I', slot: 2 },
  POSS_1PL: { template: '(I)mIz', slot: 2 },
  POSS_2PL: { template: '(I)nIz', slot: 2 },
  POSS_3PL: { template: 'lArI', slot: 2 },
  ACC: { template: '(y)I', slot: 3 },
  DAT: { template: '(y)A', slot: 3 },
  LOC: { template: 'DA', slot: 3 },
  ABL: { template: 'DAn', slot: 3 },
  GEN: { template: '(n)In', slot: 3 },
  INS: { template: '(y)lA', slot: 3 },
};

/** Nach Plural trägt die 3. Person Plural keinen zweiten Pluralmarker (evler-i). */
export const POSS_3PL_AFTER_PL = 'I';

/** Kasus nach Possessiv 3. Person: pronominales n (evi-n-de). */
export const PRONOMINAL_N: Partial<Record<MorphTag, string>> = {
  ACC: 'nI',
  DAT: 'nA',
  LOC: 'nDA',
  ABL: 'nDAn',
};
