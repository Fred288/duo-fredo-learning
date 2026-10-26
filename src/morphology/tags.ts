// Abstrakte Morphem-Tags. Die Oberflächenform (Harmonie, Konsonantenwechsel,
// Pufferlaute) erzeugt die Engine; Inhalte referenzieren nur diese Tags.
export const MORPH_TAGS = [
  'LI', // -lI (mit: şekerli, Ankaralı)
  'SIZ', // -sIz (ohne: şekersiz)
  'LIK', // -lIk (Abstraktum, Gegenstand: güzellik, gözlük)
  'CI', // -CI (Beruf: kitapçı, gazeteci)
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
  'KI', // -ki (evdeki, bugünkü), danach wieder Plural/Kasus
] as const;

export type MorphTag = (typeof MORPH_TAGS)[number];

// Verbale Bausteine (Präsens, Verneinung, Frage, Kopula) und Personalendungen.
export const VERB_TAGS = [
  'PRES', // -Iyor
  'PAST', // -DI
  'FUT', // -(y)AcAk
  'AOR', // -r / -Ar / -Ir, verneint -z
  'EVID', // -mIş (auch Kopula -(y)mIş)
  'NEC', // -mAlI
  'ABIL', // -(y)Abil, verneint -(y)A
  'IMP', // Imperativ -sIn, -(y)In, -sInlAr
  'PASS', // Passiv -Il / -In / -n
  'NEG', // -mA (vor -yor: -mI)
  'Q', // Fragepartikel mI (getrennt geschrieben)
  'NEG_COP', // değil
  'DIR', // -DIr
  'P1SG',
  'P2SG',
  'P3SG',
  'P1PL',
  'P2PL',
  'P3PL',
] as const;

export type VerbTag = (typeof VERB_TAGS)[number];
export type AnyTag = MorphTag | VerbTag;
