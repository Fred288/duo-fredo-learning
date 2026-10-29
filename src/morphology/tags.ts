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

// Infinite Verbformen: Partizipien, Verbalnomen, Konverbien. Danach folgen nominale Endungen.
export const NONFINITE_TAGS = [
  'PART_AN', // -(y)An (gelen)
  'PART_DIK', // -DIk (geldiğim)
  'PART_ACAK', // -(y)AcAk (geleceğim)
  'VN_MA', // -mA (gelmesi)
  'VN_MAK', // -mAk (gelmek, gelmekte)
  'VN_IS', // -(y)Iş (geliş)
  'CV_IP', // -(y)Ip (gelip)
  'CV_ARAK', // -(y)ArAk (gelerek)
  'CV_INCA', // -(y)IncA (gelince)
  'CV_ALI', // -(y)AlI (geleli)
  'CV_MADAN', // -mAdAn (gelmeden)
] as const;

export type NonfiniteTag = (typeof NONFINITE_TAGS)[number];

// Verbale Bausteine (Präsens, Verneinung, Frage, Kopula) und Personalendungen.
export const VERB_TAGS = [
  ...NONFINITE_TAGS,
  'PRES', // -Iyor
  'PAST', // -DI
  'FUT', // -(y)AcAk
  'AOR', // -r / -Ar / -Ir, verneint -z
  'EVID', // -mIş (auch Kopula -(y)mIş)
  'NEC', // -mAlI
  'ABIL', // -(y)Abil, verneint -(y)A
  'IMP', // Imperativ -sIn, -(y)In, -sInlAr
  'PASS', // Passiv -Il / -In / -n
  'COND', // Konditional -sA, Kopula -(y)sA (ise)
  'OPT', // Optativ -(y)A (geleyim, gelelim)
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
