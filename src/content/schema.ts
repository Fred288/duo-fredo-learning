import { z } from 'zod';
import { MORPH_TAGS } from '../morphology/tags';

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

export const Vocab = z.object({
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
  .object({
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

export const WordBank = z.object({
  ...exerciseBase,
  type: z.literal('word_bank'),
  prompt: nonEmpty,
  // Erste Antwort ist kanonisch, aus ihr werden die Bausteine gebildet.
  answers: z.array(nonEmpty).min(1),
  distractors: z.array(nonEmpty).optional(),
});

export const FreeText = z.object({
  ...exerciseBase,
  type: z.literal('free_text'),
  prompt: nonEmpty,
  direction: z.enum(['de_tr', 'tr_de']),
  answers: z.array(nonEmpty).min(1),
});

export const SuffixBuilder = z.object({
  ...exerciseBase,
  type: z.literal('suffix_builder'),
  stem: nonEmpty,
  suffixes: z.array(z.enum(MORPH_TAGS)).min(1),
  target: nonEmpty,
});

export const Segment = z.object({
  ...exerciseBase,
  type: z.literal('segment'),
  word: nonEmpty,
  segments: z.array(z.object({ text: nonEmpty, role: nonEmpty })).min(2),
});

export const SovPuzzle = z.object({
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
  Segment,
  SovPuzzle,
]);

export const Lesson = z.object({
  id: nonEmpty,
  type: z.enum(['vocab', 'grammar', 'dialog', 'reading', 'review']),
  title: nonEmpty,
  exercises: z.array(Exercise).min(1),
});

export const Unit = z
  .object({
    id: z.string().regex(/^(a1|a2|b1|b2)-u\d{2}$/, 'Unit-ID wie a1-u01'),
    level: Level,
    title: nonEmpty,
    grammar_focus: z.array(nonEmpty).optional(),
    explainer: nonEmpty.optional(),
    reviewed: z.boolean().default(false),
    lessons: z.array(Lesson).min(1),
    vocab: z.array(Vocab).optional(),
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
