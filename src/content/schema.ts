import { z } from 'zod';
import { MORPH_TAGS, VERB_TAGS } from '../morphology/tags';
import { COPULA_TENSES, IMPERATIVE_PERSONS, PERSONS, TENSES } from '../morphology/verb';

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
  // Aufnahme in content/audio/ (Name = Vokabel-ID); synthetisch = per TTS erzeugte Datei.
  // Ohne audio spricht die App per Laufzeit-TTS, das gilt immer als synthetisch.
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
  // y vor Genitiv und Possessiv (su → suyun, suyum)
  y_stem: z.boolean().optional(),
  // Aorist-Vokal von Verben, wenn die Regel nicht greift (ar: yapar, ir: gelir)
  aorist: z.enum(['ar', 'ir']).optional(),
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
    // Türkischer Teil des Prompts zum Vorlesen ("" = nichts vorlesen); der Build ergänzt beides.
    speak_prompt: z.string().trim().optional(),
    // Antwort ist türkisch: das Feedback liest die Lösung vor (falsche Formen in Optionen nie).
    speak_answer: z.boolean().optional(),
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

const COPULA_TENSE_SET: readonly string[] = COPULA_TENSES;

/** Zeit passt zum Modus; Imperativ nur für 2./3. Person. Gemeinsam für Konjugation und Tabelle. */
function checkVerbForm(
  e: { tense?: string; ability?: boolean; polite?: boolean; passive?: boolean },
  copula: boolean,
  persons: readonly string[],
  ctx: z.RefinementCtx,
) {
  if (copula && e.tense && !COPULA_TENSE_SET.includes(e.tense)) {
    ctx.addIssue({ code: 'custom', path: ['tense'], message: `Kopula kennt kein ${e.tense}` });
  }
  if (copula && (e.ability || e.passive)) {
    ctx.addIssue({ code: 'custom', path: ['ability'], message: 'ability nur bei Verben' });
  }
  if (e.tense === 'imperative') {
    if (e.ability)
      ctx.addIssue({ code: 'custom', path: ['ability'], message: 'kein können im Imperativ' });
    const bad = persons.filter((p) => !IMPERATIVE_PERSONS.includes(p as never));
    if (bad.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['person'],
        message: `Imperativ nicht für ${bad.join(', ')}`,
      });
    }
  } else if (e.polite) {
    ctx.addIssue({ code: 'custom', path: ['polite'], message: 'polite nur im Imperativ' });
  }
}

/** Verbkonjugation (mode verb, lemma = Infinitiv) oder Nominalsatz mit Kopula (mode copula). */
export const Conjugation = z
  .strictObject({
    ...exerciseBase,
    type: z.literal('conjugation'),
    mode: z.enum(['verb', 'copula']),
    lemma: nonEmpty,
    person: z.enum(PERSONS),
    tense: z.enum(TENSES).optional(),
    negative: z.boolean().optional(),
    question: z.boolean().optional(),
    dir: z.boolean().optional(),
    ability: z.boolean().optional(),
    polite: z.boolean().optional(),
    passive: z.boolean().optional(),
    target: nonEmpty,
  })
  .superRefine((e, ctx) => checkVerbForm(e, e.mode === 'copula', [e.person], ctx));

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
    tense: z.enum(TENSES).optional(),
    ability: z.boolean().optional(),
    polite: z.boolean().optional(),
    passive: z.boolean().optional(),
    negative: z.boolean().optional(),
    question: z.boolean().optional(),
    targets: z.array(nonEmpty).min(2),
  })
  .superRefine((e, ctx) => {
    if (e.kind !== 'noun') {
      if (e.tense === 'imperative' && !e.persons) {
        ctx.addIssue({ code: 'custom', path: ['persons'], message: 'Imperativ braucht persons' });
      }
      checkVerbForm(e, e.kind === 'copula', e.persons ?? [], ctx);
    }
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

/** Bausteine einer zerlegten Form: Stamm, nominale und verbale Suffixe. */
export const SEGMENT_TAGS = ['STEM', ...MORPH_TAGS, ...VERB_TAGS] as const;
export type SegmentTag = (typeof SEGMENT_TAGS)[number];

/** Eingabe der Engine für genau eine Form: Nomen mit Tags oder Verb/Kopula mit Person und Zeit. */
export const FormSpec = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('noun'),
    lemma: nonEmpty,
    tags: z.array(z.enum(MORPH_TAGS)).min(1),
  }),
  z.strictObject({
    kind: z.enum(['verb', 'copula']),
    lemma: nonEmpty,
    person: z.enum(PERSONS),
    tense: z.enum(TENSES).optional(),
    negative: z.boolean().optional(),
    question: z.boolean().optional(),
    dir: z.boolean().optional(),
    ability: z.boolean().optional(),
    polite: z.boolean().optional(),
    passive: z.boolean().optional(),
  }),
]);

/**
 * Wort zerlegen: Grenzen setzen und jedem Stück seine Rolle geben. Wird im Build aus
 * Grammatikübungen erzeugt (`from`); `analysis` bildet die Form in der Engine neu.
 * Leerzeichen (Fragepartikel) und Apostroph sind feste Grenzen, keine Bausteine.
 */
export const Segment = z
  .strictObject({
    ...exerciseBase,
    type: z.literal('segment'),
    word: nonEmpty,
    segments: z.array(z.strictObject({ text: nonEmpty, tag: z.enum(SEGMENT_TAGS) })).min(2),
    analysis: FormSpec,
    from: nonEmpty,
  })
  .superRefine((e, ctx) => {
    if (e.segments[0]!.tag !== 'STEM' || e.segments.slice(1).some((s) => s.tag === 'STEM')) {
      ctx.addIssue({ code: 'custom', path: ['segments'], message: 'nur das erste Stück ist STEM' });
    }
    if (e.segments.map((s) => s.text).join('') !== e.word.replace(/[\s'’]/g, '')) {
      ctx.addIssue({ code: 'custom', path: ['segments'], message: `ergeben nicht "${e.word}"` });
    }
  });

export const SovPuzzle = z.strictObject({
  ...exerciseBase,
  type: z.literal('sov_puzzle'),
  tokens: z.array(nonEmpty).min(2),
  order: z.array(nonEmpty).min(2),
});

/**
 * Hörübung: `text` wird vorgelesen und ist die Lösung. tiles = aus Bausteinen bauen,
 * dictation = tippen, meaning = deutsche Bedeutung wählen (options/answer).
 */
export const Listen = z
  .strictObject({
    ...exerciseBase,
    type: z.literal('listen'),
    mode: z.enum(['tiles', 'dictation', 'meaning']),
    text: nonEmpty,
    distractors: z.array(nonEmpty).optional(),
    options: z.array(nonEmpty).min(2).optional(),
    answer: nonEmpty.optional(),
    // ID der Übung bzw. Vokabel, aus der die Hörübung erzeugt wurde.
    from: nonEmpty.optional(),
  })
  .superRefine((e, ctx) => {
    if (e.mode === 'meaning') {
      if (!e.options || !e.answer || !e.options.includes(e.answer)) {
        ctx.addIssue({
          code: 'custom',
          path: ['answer'],
          message: 'meaning braucht options mit answer',
        });
      } else if (new Set(e.options).size !== e.options.length) {
        ctx.addIssue({ code: 'custom', path: ['options'], message: 'options doppelt' });
      }
      if (e.distractors) {
        ctx.addIssue({ code: 'custom', path: ['distractors'], message: 'nur für tiles' });
      }
    } else if (e.options || e.answer) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'options nur für meaning' });
    }
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
  Listen,
]);

export const LESSON_TYPES = [
  'vocab',
  'grammar',
  'dialog',
  'reading',
  'review',
  'listening',
  'segmenting',
  'word_order',
] as const;

export const Lesson = z.strictObject({
  id: nonEmpty,
  type: z.enum(LESSON_TYPES),
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
export type FormSpec = z.infer<typeof FormSpec>;

/** Vokabel-ID für SRS; Default ist das türkische Lemma. */
export const vocabId = (v: Vocab): string => v.id ?? v.tr;
