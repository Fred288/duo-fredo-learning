import {
  COMPOUND_TENSES,
  COMPOUNDS,
  conjugate,
  conjugateVariants,
  inflect,
  MorphError,
  nonfinite,
  PERSONS,
  PRONOUN_CASES,
  PRONOUN_LEMMAS,
  pronoun,
  type Compound,
  type MorphTag,
  type NonfiniteTag,
  type Person,
  type PronounCase,
  type PronounLemma,
  type Stem,
  type Tense,
  type VerbStem,
  TENSES,
} from '../morphology';
import type { VocabEntry } from './types';

/** Woraus eine Form entstanden ist; die Beschriftung kommt in der UI aus i18n. */
export type FormLabel =
  | { kind: 'noun'; tags: MorphTag[] }
  | { kind: 'pronoun'; case: PronounCase }
  | {
      kind: 'verb';
      tense: Tense;
      person: Person;
      negative?: boolean;
      ability?: boolean;
      passive?: boolean;
      compound?: Compound;
    }
  | {
      kind: 'verbal';
      form: NonfiniteTag;
      tags?: MorphTag[];
      negative?: boolean;
      ability?: boolean;
      passive?: boolean;
    };

export interface Form {
  form: string;
  label: FormLabel;
}

const NOUN_POS: ReadonlySet<VocabEntry['pos']> = new Set(['noun', 'adj', 'num']);
const POSS: MorphTag[] = ['POSS_1SG', 'POSS_2SG', 'POSS_3SG', 'POSS_1PL', 'POSS_2PL', 'POSS_3PL'];
const CASES: MorphTag[] = ['ACC', 'DAT', 'LOC', 'ABL', 'GEN', 'INS'];

/** Wie das Wort gebeugt wird; Mehrwort-Nomen (yatak odası) kann die Engine nicht. */
export function formKind(entry: VocabEntry): 'noun' | 'verb' | 'pronoun' | undefined {
  if (entry.pos === 'verb') return 'verb';
  if (entry.pos === 'pron')
    return PRONOUN_LEMMAS.includes(entry.tr as PronounLemma) ? 'pronoun' : undefined;
  return NOUN_POS.has(entry.pos) && !entry.tr.includes(' ') ? 'noun' : undefined;
}

export const nounStem = (e: VocabEntry): Stem => ({
  form: e.tr,
  softens: e.softens,
  harmonyVowel: e.harmony_vowel,
  dropsVowel: e.drops_vowel,
  proper: e.proper,
  capitalized: e.capitalized,
  yStem: e.y_stem,
});

const verbStemOf = (e: VocabEntry): VerbStem => ({
  form: e.tr,
  softens: e.softens,
  aorist: e.aorist,
});

/** Engine-Form oder undefined, wo die Engine die Kombination ablehnt (Imperativ 1sg …). */
function attempt(fn: () => string): string | undefined {
  try {
    return fn();
  } catch (e) {
    if (e instanceof MorphError) return undefined;
    throw e;
  }
}

/** Nomen: {∅, PL} × {∅, Possessiv} × {∅, Kasus}, ohne die Grundform. */
export function nounForms(entry: VocabEntry): Form[] {
  const stem = nounStem(entry);
  const out: Form[] = [];
  for (const pl of [[], ['PL']] as MorphTag[][]) {
    for (const poss of [[], ...POSS.map((p) => [p])]) {
      for (const kase of [[], ...CASES.map((c) => [c])]) {
        const tags = [...pl, ...poss, ...kase];
        if (!tags.length) continue;
        const form = attempt(() => inflect(stem, tags).form);
        if (form) out.push({ form, label: { kind: 'noun', tags } });
      }
    }
  }
  return out;
}

export function pronounForms(entry: VocabEntry): Form[] {
  return PRONOUN_CASES.filter((c) => c !== 'NOM').map((c) => ({
    form: pronoun(entry.tr as PronounLemma, c),
    label: { kind: 'pronoun', case: c },
  }));
}

type VerbVariant = Pick<
  Extract<FormLabel, { kind: 'verb' }>,
  'tense' | 'negative' | 'ability' | 'passive' | 'compound'
>;

const VERB_VARIANTS: VerbVariant[] = [
  ...TENSES.flatMap((tense) => [{ tense }, { tense, negative: true }]),
  ...COMPOUNDS.flatMap((compound) =>
    COMPOUND_TENSES[compound].flatMap((tense) => [
      { tense, compound },
      { tense, compound, negative: true },
    ]),
  ),
  ...(['present', 'aorist'] as const).flatMap((tense) =>
    [{ ability: true }, { passive: true }].flatMap((v) => [
      { tense, ...v },
      { tense, ...v, negative: true },
      // gelebilirdim, gelemezdim, yapılırdı, yapabiliyordum
      { tense, ...v, compound: 'past' as const },
      { tense, ...v, compound: 'past' as const, negative: true },
    ]),
  ),
];

/** Verb: alle Zeiten × Personen × bejaht/verneint, dazu „können“ und Passiv in Präsens und Aorist. */
export function verbForms(entry: VocabEntry): Form[] {
  const stem = verbStemOf(entry);
  return VERB_VARIANTS.flatMap((variant) =>
    PERSONS.flatMap((person) => {
      const form = attempt(() => conjugate(stem, { ...variant, person }).form);
      if (!form) return [];
      const label = { kind: 'verb' as const, person, ...variant };
      // Nebenformen (geliyordular) mit derselben Angabe
      const more = conjugateVariants(stem, { ...variant, person });
      return [form, ...more].map((f) => ({ form: f, label }));
    }),
  );
}

type VerbalVariant = Omit<Extract<FormLabel, { kind: 'verbal' }>, 'kind'>;

// Kasus nach infiniten Formen; Genitiv und Instrumental sind dort selten.
const VERBAL_CASES: MorphTag[] = ['ACC', 'DAT', 'LOC', 'ABL'];
const withPoss = (cases: boolean): MorphTag[][] =>
  POSS.flatMap((p) => [[p], ...(cases ? VERBAL_CASES.map((c) => [p, c]) : [])]);
const BOTH = [false, true];

const VERBAL_VARIANTS: VerbalVariant[] = [
  // gelen, gelenler, gelene, gelenlere
  ...[[], ['PL'], ...VERBAL_CASES.map((c) => [c]), ...VERBAL_CASES.map((c) => ['PL', c])].map(
    (tags) => ({ form: 'PART_AN' as const, tags: tags as MorphTag[] }),
  ),
  // geldiğim, geldiğini, geldikten
  ...[['ABL'] as MorphTag[], ...withPoss(true)].map((tags) => ({
    form: 'PART_DIK' as const,
    tags,
  })),
  // gelecek, geleceğim, geleceğini
  ...[[], ...withPoss(true)].map((tags) => ({ form: 'PART_ACAK' as const, tags })),
  // gelme, gelmeyi, gelmesi, gelmesini; ohne Possessiv nur ACC/DAT (gelmeden ist das Konverb)
  ...([[], ['ACC'], ['DAT'], ...withPoss(true)] as MorphTag[][]).map((tags) => ({
    form: 'VN_MA' as const,
    tags,
  })),
  // gelmek, gelmekte, gelmekten, gelmekle
  ...[[], ['LOC'], ['ABL'], ['INS']].map((tags) => ({
    form: 'VN_MAK' as const,
    tags: tags as MorphTag[],
  })),
  ...(['CV_IP', 'CV_ARAK', 'CV_INCA', 'CV_ALI'] as const).map((form) => ({ form, tags: [] })),
].flatMap((v) => BOTH.map((negative) => ({ ...v, negative })));

const VERBAL_EXTRA: VerbalVariant[] = [
  { form: 'CV_MADAN', tags: [] },
  // geliş, gelişi (verneint selten)
  ...[[], ...VERBAL_CASES.map((c) => [c]), ...withPoss(true)].map((tags) => ({
    form: 'VN_IS' as const,
    tags,
  })),
  // yapılan, yapıldığı, gelebilen, gelemeyen
  { form: 'PART_AN', tags: [], passive: true },
  { form: 'PART_AN', tags: ['PL'], passive: true },
  { form: 'PART_DIK', tags: ['POSS_3SG'], passive: true },
  { form: 'PART_AN', tags: [], ability: true },
  { form: 'PART_AN', tags: [], ability: true, negative: true },
];

/** Partizipien, Verbalnomen, Konverbien mit den üblichen Endungen; ohne den Infinitiv selbst. */
export function verbalForms(entry: VocabEntry): Form[] {
  const stem = verbStemOf(entry);
  return [...VERBAL_VARIANTS, ...VERBAL_EXTRA].flatMap((variant) => {
    const opts = { ...variant, negative: variant.negative || undefined };
    const form = attempt(() => nonfinite(stem, opts).form);
    if (!form || (variant.form === 'VN_MAK' && !variant.tags?.length && !variant.negative)) {
      return [];
    }
    return [{ form, label: { kind: 'verbal' as const, ...opts } }];
  });
}

export function allForms(entry: VocabEntry): Form[] {
  switch (formKind(entry)) {
    case 'noun':
      return nounForms(entry);
    case 'pronoun':
      return pronounForms(entry);
    case 'verb':
      return [...verbForms(entry), ...verbalForms(entry)];
    default:
      return [];
  }
}

/** Tabelle im Eintrag: Kasus × Sg/Pl, Pronomen-Kasus oder Zeiten × Personen. */
export type FormTable =
  | { kind: 'noun'; rows: { case: PronounCase; sg?: string; pl?: string }[] }
  | { kind: 'pronoun'; rows: { case: PronounCase; form: string }[] }
  | { kind: 'verb'; tenses: Tense[]; rows: { person: Person; forms: (string | undefined)[] }[] };

const TABLE_TENSES: Tense[] = ['present', 'past', 'future', 'aorist'];
const TABLE_CASES: (MorphTag | undefined)[] = [undefined, ...CASES];

export function formTable(entry: VocabEntry): FormTable | undefined {
  switch (formKind(entry)) {
    case 'noun': {
      const stem = nounStem(entry);
      const rows = TABLE_CASES.map((tag, i) => ({
        case: PRONOUN_CASES[i]!,
        sg: tag ? attempt(() => inflect(stem, [tag]).form) : entry.tr,
        pl: attempt(() => inflect(stem, tag ? ['PL', tag] : ['PL']).form),
      }));
      return rows.some((r) => r.pl) ? { kind: 'noun', rows } : undefined;
    }
    case 'pronoun':
      return {
        kind: 'pronoun',
        rows: PRONOUN_CASES.map((c) => ({ case: c, form: pronoun(entry.tr as PronounLemma, c) })),
      };
    case 'verb': {
      const stem = verbStemOf(entry);
      const rows = PERSONS.map((person) => ({
        person,
        forms: TABLE_TENSES.map((tense) => attempt(() => conjugate(stem, { tense, person }).form)),
      }));
      return rows.some((r) => r.forms.some(Boolean))
        ? { kind: 'verb', tenses: TABLE_TENSES, rows }
        : undefined;
    }
    default:
      return undefined;
  }
}
