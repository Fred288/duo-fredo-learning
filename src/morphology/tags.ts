// Abstrakte Morphem-Tags. Die Oberflächenform (Harmonie, Konsonantenwechsel,
// Pufferlaute) erzeugt die Engine; Inhalte referenzieren nur diese Tags.
export const MORPH_TAGS = [
  'PL', // -lAr
  'POSS_1SG', // -(I)m
  'POSS_2SG', // -(I)n
  'POSS_3SG', // -(s)I
  'POSS_1PL', // -(I)mIz
  'POSS_2PL', // -(I)nIz
  'POSS_3PL', // -lArI
  'ACC', // -(y)I
  'DAT', // -(y)A
  'LOC', // -DA
  'ABL', // -DAn
  'GEN', // -(n)In
  'INS', // -(y)lA
] as const;

export type MorphTag = (typeof MORPH_TAGS)[number];
