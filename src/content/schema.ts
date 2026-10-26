import { z } from 'zod';
import { MORPH_TAGS } from '../morphology/tags';
import { PERSONS } from '../morphology/verb';

export const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;
export const Level = z.enum(LEVELS);

const nonEmpty = z.string().trim().min(1);
const register = z.enum(['informal', 'formal']); // sen / siz

// Herkunft ist auf Unit-Ebene Pflicht, auf Item-Ebene ein optionaler Override.
const provenanceFields = {
  source: nonEmpty,
  license: nonEmpty,
  attribution: nonEmpty.optional(),
  author: nonEmpty.optional(),
  tatoeba_id: z.number().int().positive().optional(),
};
const provenanceOverride = z.object(provenanceFields).partial().shape;

export const Vocab = z.strictObject({
  id: nonEmpty.optional(),
  tr: nonEmpty,
  de: z.array(nonEmpty).min(1),
  pos: z.enum([
    'noun',
    'verb',
    'adj',
    'adv',
    'pron',
    'num',
    'particle',
    'postp',
    'conj',
    'interj',
    'phrase',
  ]),
  tags: z.array(nonEmpty).optional(),
  audio: nonEmpty.optional(),
  audio_synthetic: z.boolean().optional(),
  // Morphologie-Ausnahmen: kitap → kitabı, saat → saati (harmonisiert wie hell).
  softens: z.boolean().optional(),
  harmony_vowel: z
    .string()
    .regex(/^[aeıioöuü]$/)
    .optional(),
  // Vokalausfall vor vokalischem Suffix (oğul → oğlum)
  drops_vowel: z.boolean().optional(),
  // Eigenname: Apostroph vor dem Suffix (İstanbul'da)
  proper: z.boolean().optional(),
  // großgeschrieben ohne Apostroph (Nationalitäten: Almanlar)
  capitalized: z.boolean().optional(),
  register: register.optional(),
  reviewed: z.boolean().optional(),
  ...provenanceOverride,
});

const exerciseBase = {
  id: nonEmpty,
  gloss_de: nonEmpty.optional(),
  hint: nonEmpty.optional(),
  explanation: nonEmpty.optional(),
  register: register.optional(),
  reviewed: z.boolean().optional(),
  ...provenanceOverride,
};

export const MultipleChoice = z
  .strictObject({
    ...exerciseBase,
    type: z.literal('multiple_choice'),
    prompt: nonEmpty,
    options: z.array(nonEmpty).min(2),
    answer: nonEmpty,
  })
  .refine((e) => e.options.includes(e.answer), {
    message: 'answer muss in options enthalten sein',
    path: ['answer'],
  });

export const WordBank = z.strictObject({
  ...exerciseBase,
  type: z.literal('word_bank'),
  prompt: nonEmpty,
  // Erste Antwort ist kanonisch, aus ihr werden die Bausteine gebildet.
  answers: z.array(nonEmpty).min(1),
  distractors: z.array(nonEmpty).optional(),
});

export const FreeText = z.strictObject({
  ...exerciseBase,
  type: z.literal('free_text'),
  prompt: nonEmpty,
  direction: z.enum(['de_tr', 'tr_de']),
  answers: z.array(nonEmpty).min(1),
});

export const SuffixBuilder = z.strictObject({
  ...exerciseBase,
  type: z.literal('suffix_builder'),
  stem: nonEmpty,
  suffixes: z.array(z.enum(MORPH_TAGS)).min(1),
  target: nonEmpty,
});

/** Verbkonjugation (mode verb, lemma = Infinitiv) oder Nominalsatz mit Kopula (mode copula). */
export const Conjugation = z.strictObject({
  ...exerciseBase,
  type: z.literal('conjugation'),
  mode: z.enum(['verb', 'copula']),
  lemma: nonEmpty,
  person: z.enum(PERSONS),
  tense: z.literal('present').optional(),
  negative: z.boolean().optional(),
  question: z.boolean().optional(),
  dir: z.boolean().optional(),
  target: nonEmpty,
});

/** Tabelle: ein Wort durchdeklinieren (noun, Zeilen = Tag-Folgen) oder durchkonjugieren (verb/copula). */
export const Paradigm = z
  .strictObject({
    ...exerciseBase,
    type: z.literal('paradigm'),
    kind: z.enum(['noun', 'verb', 'copula']),
    lemma: nonEmpty,
    rows: z
      .array(z.array(z.enum(MORPH_TAGS)))
      .min(2)
      .optional(),
    persons: z.array(z.enum(PERSONS)).min(2).optional(),
    negative: z.boolean().optional(),
    question: z.boolean().optional(),
    targets: z.array(nonEmpty).min(2),
  })
  .superRefine((e, ctx) => {
    const rows = e.kind === 'noun' ? e.rows?.length : (e.persons ?? PERSONS).length;
    if (rows === undefined) {
      ctx.addIssue({ code: 'custom', path: ['rows'], message: 'noun-Tabelle braucht rows' });
    } else if (rows !== e.targets.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['targets'],
        message: `${e.targets.length} targets für ${rows} Zeilen`,
      });
    }
  });

export const Segment = z.strictObject({
  ...exerciseBase,
  type: z.literal('segment'),
  word: nonEmpty,
  segments: z.array(z.object({ text: nonEmpty, role: nonEmpty })).min(2),
});

export const SovPuzzle = z.strictObject({
  ...exerciseBase,
  type: z.literal('sov_puzzle'),
  tokens: z.array(nonEmpty).min(2),
  order: z.array(nonEmpty).min(2),
});

export const Exercise = z.discriminatedUnion('type', [
  MultipleChoice,
  WordBank,
  FreeText,
  SuffixBuilder,
  Conjugation,
  Paradigm,
  Segment,
  SovPuzzle,
]);

export const Lesson = z.strictObject({
  id: nonEmpty,
  type: z.enum(['vocab', 'grammar', 'dialog', 'reading', 'review']),
  title: nonEmpty,
  exercises: z.array(Exercise).min(1),
});

export const Unit = z
  .strictObject({
    id: z.string().regex(/^(a1|a2|b1|b2)-u\d{2}$/, 'Unit-ID wie a1-u01'),
    level: Level,
    title: nonEmpty,
    grammar_focus: z.array(nonEmpty).optional(),
    explainer: nonEmpty.optional(),
    reviewed: z.boolean().default(false),
    lessons: z.array(Lesson).min(1),
    vocab: z.array(Vocab).optional(),
    // Vom Build ergänzt: Einträge anderer Units, die Grammatikübungen dieser Unit brauchen.
    lexicon: z.array(Vocab).optional(),
    ...provenanceFields,
  })
  .superRefine((unit, ctx) => {
    if (!unit.id.startsWith(unit.level.toLocaleLowerCase('tr'))) {
      ctx.addIssue({ code: 'custom', path: ['level'], message: `Level passt nicht zu ${unit.id}` });
    }
    unit.lessons.forEach((lesson, li) => {
      if (!lesson.id.startsWith(`${unit.id}-`)) {
        ctx.addIssue({
          code: 'custom',
          path: ['lessons', li, 'id'],
          message: `Lektions-ID muss mit ${unit.id}- beginnen`,
        });
      }
      lesson.exercises.forEach((ex, ei) => {
        if (!ex.id.startsWith(`${lesson.id}-`)) {
          ctx.addIssue({
            code: 'custom',
            path: ['lessons', li, 'exercises', ei, 'id'],
            message: `Übungs-ID muss mit ${lesson.id}- beginnen`,
          });
        }
      });
    });
  });

export type Level = z.infer<typeof Level>;
export type Vocab = z.infer<typeof Vocab>;
export type Exercise = z.infer<typeof Exercise>;
export type Lesson = z.infer<typeof Lesson>;
export type Unit = z.infer<typeof Unit>;

/** Vokabel-ID für SRS; Default ist das türkische Lemma. */
export const vocabId = (v: Vocab): string => v.id ?? v.tr;
