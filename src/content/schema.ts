import { z } from 'zod';
import { MORPH_TAGS, NONFINITE_TAGS, VERB_TAGS } from '../morphology/tags';
import {
  COMPOUND_TENSES,
  COMPOUNDS,
  COPULA_TENSES,
  IMPERATIVE_PERSONS,
  OPTATIVE_PERSONS,
  PERSONS,
  TENSES,
  type Tense,
} from '../morphology/verb';

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

/** Rollen der Satzglieder im Satzbau; object_bare = unbestimmtes Objekt ohne Akkusativ. */
export const CHUNK_ROLES = [
  'subject',
  'time',
  'place',
  'object',
  'object_bare',
  'complement',
  'question',
  'predicate',
] as const;
export type ChunkRole = (typeof CHUNK_ROLES)[number];

const Chunk = z.strictObject({ text: nonEmpty, role: z.enum(CHUNK_ROLES) });
/** Weitere gültige Reihenfolge der Satzglieder (Indizes in `chunks`); note = deutscher Fokus-Hinweis. */
const ChunkOrder = z.strictObject({
  order: z.array(z.number().int().min(0)).min(2),
  note: nonEmpty.optional(),
});

export const WordBank = z
  .strictObject({
    ...exerciseBase,
    type: z.literal('word_bank'),
    prompt: nonEmpty,
    // Erste Antwort ist kanonisch, aus ihr werden die Bausteine gebildet.
    answers: z.array(nonEmpty).min(1),
    distractors: z.array(nonEmpty).optional(),
    // Satzglieder der ersten Antwort in Grundreihenfolge; daraus entsteht die Satzbau-Übung.
    chunks: z.array(Chunk).min(3).optional(),
    orders: z.array(ChunkOrder).min(1).optional(),
  })
  .refine((e) => !e.orders || e.chunks, {
    message: 'orders nur mit chunks',
    path: ['orders'],
  });

export const FreeText = z.strictObject({
  ...exerciseBase,
  type: z.literal('free_text'),
  prompt: nonEmpty,
  direction: z.enum(['de_tr', 'tr_de']),
  answers: z.array(nonEmpty).min(1),
});

/**
 * Wortform bauen: Nomen + Endungen (ev + PL + LOC) oder, mit `verbal`, Verb (Infinitiv) + infinite
 * Form + Endungen (okumak + PART_DIK + POSS_1SG → okuduğum; gelmek + CV_INCA → gelince).
 */
export const SuffixBuilder = z
  .strictObject({
    ...exerciseBase,
    type: z.literal('suffix_builder'),
    stem: nonEmpty,
    verbal: z.enum(NONFINITE_TAGS).optional(),
    negative: z.boolean().optional(),
    ability: z.boolean().optional(),
    passive: z.boolean().optional(),
    suffixes: z.array(z.enum(MORPH_TAGS)).default([]),
    target: nonEmpty,
  })
  .superRefine((e, ctx) => {
    if (!e.verbal && e.suffixes.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['suffixes'], message: 'mindestens eine Endung' });
    }
    if (!e.verbal && (e.negative || e.ability || e.passive)) {
      ctx.addIssue({
        code: 'custom',
        path: ['verbal'],
        message: 'negative/ability/passive nur mit verbal',
      });
    }
  });

const COPULA_TENSE_SET: readonly string[] = COPULA_TENSES;

/** Zeit passt zum Modus; Imperativ nur für 2./3. Person. Gemeinsam für Konjugation und Tabelle. */
function checkVerbForm(
  e: {
    tense?: Tense;
    ability?: boolean;
    polite?: boolean;
    passive?: boolean;
    question?: boolean;
    dir?: boolean;
    compound?: (typeof COMPOUNDS)[number];
  },
  copula: boolean,
  persons: readonly string[],
  ctx: z.RefinementCtx,
) {
  // -DIr verbindet sich nicht mit idi/imiş/ise (die Engine ließe es stillschweigend weg).
  if (e.dir && (!copula || (e.tense && e.tense !== 'present'))) {
    ctx.addIssue({ code: 'custom', path: ['dir'], message: 'dir nur bei Kopula im Präsens' });
  }
  if (copula && e.tense && !COPULA_TENSE_SET.includes(e.tense)) {
    ctx.addIssue({ code: 'custom', path: ['tense'], message: `Kopula kennt kein ${e.tense}` });
  }
  if (copula && (e.ability || e.passive)) {
    ctx.addIssue({ code: 'custom', path: ['ability'], message: 'ability nur bei Verben' });
  }
  if (copula && e.tense === 'conditional' && e.question) {
    ctx.addIssue({ code: 'custom', path: ['question'], message: 'keine Frage mit ise' });
  }
  if (e.compound) {
    if (copula) {
      ctx.addIssue({ code: 'custom', path: ['compound'], message: 'compound nur bei Verben' });
    } else if (!COMPOUND_TENSES[e.compound].includes(e.tense ?? 'present')) {
      ctx.addIssue({
        code: 'custom',
        path: ['compound'],
        message: `keine Kopula ${e.compound} nach ${e.tense ?? 'present'}`,
      });
    } else if (e.compound === 'conditional' && e.question) {
      ctx.addIssue({ code: 'custom', path: ['question'], message: 'keine Frage mit ise' });
    }
  }
  if (e.tense === 'optative') {
    const bad = persons.filter((p) => !OPTATIVE_PERSONS.includes(p as never));
    if (bad.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['person'],
        message: `Optativ nicht für ${bad.join(', ')}`,
      });
    }
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
    compound: z.enum(COMPOUNDS).optional(),
    target: nonEmpty,
    /** Ebenso richtige Nebenformen der Engine; schreibt der Build (`withAlternatives`). */
    alt_targets: z.array(nonEmpty).optional(),
  })
  .superRefine((e, ctx) => checkVerbForm(e, e.mode === 'copula', [e.person], ctx));

/** Tabelle: ein Wort durchdeklinieren (noun, Zeilen = Tag-Folgen) oder durchkonjugieren (verb/copula). */
export const Paradigm = z
  .strictObject({
    ...exerciseBase,
    type: z.literal('paradigm'),
    kind: z.enum(['noun', 'verb', 'copula', 'verbal']),
    lemma: nonEmpty,
    /** Bei `verbal`: die infinite Form; die Zeilen sind die Endungen danach (okuduğum … okudukları). */
    verbal: z.enum(NONFINITE_TAGS).optional(),
    rows: z
      .array(z.array(z.enum(MORPH_TAGS)))
      .min(2)
      .optional(),
    persons: z.array(z.enum(PERSONS)).min(2).optional(),
    tense: z.enum(TENSES).optional(),
    ability: z.boolean().optional(),
    polite: z.boolean().optional(),
    passive: z.boolean().optional(),
    compound: z.enum(COMPOUNDS).optional(),
    negative: z.boolean().optional(),
    question: z.boolean().optional(),
    targets: z.array(nonEmpty).min(2),
    /** Nebenformen je Zeile (leer = keine); schreibt der Build (`withAlternatives`). */
    alt_targets: z.array(z.array(nonEmpty)).optional(),
  })
  .superRefine((e, ctx) => {
    if ((e.kind === 'verbal') !== !!e.verbal) {
      ctx.addIssue({ code: 'custom', path: ['verbal'], message: 'verbal genau bei kind verbal' });
    }
    if (e.kind === 'verbal' && (e.tense || e.persons || e.compound || e.question || e.polite)) {
      ctx.addIssue({
        code: 'custom',
        path: ['kind'],
        message: 'verbal-Tabellen haben Zeilen, keine Zeit',
      });
    }
    if (e.kind === 'verb' || e.kind === 'copula') {
      if ((e.tense === 'imperative' || e.tense === 'optative') && !e.persons) {
        ctx.addIssue({ code: 'custom', path: ['persons'], message: `${e.tense} braucht persons` });
      }
      checkVerbForm(e, e.kind === 'copula', e.persons ?? [], ctx);
    }
    const byRows = e.kind === 'noun' || e.kind === 'verbal';
    const rows = byRows ? e.rows?.length : (e.persons ?? PERSONS).length;
    if (rows === undefined) {
      ctx.addIssue({ code: 'custom', path: ['rows'], message: `${e.kind}-Tabelle braucht rows` });
    } else if (rows !== e.targets.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['targets'],
        message: `${e.targets.length} targets für ${rows} Zeilen`,
      });
    }
    if (e.alt_targets && e.alt_targets.length !== e.targets.length) {
      ctx.addIssue({ code: 'custom', path: ['alt_targets'], message: 'eine Liste je Zeile' });
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
    compound: z.enum(COMPOUNDS).optional(),
  }),
  z.strictObject({
    kind: z.literal('verbal'),
    lemma: nonEmpty,
    form: z.enum(NONFINITE_TAGS),
    negative: z.boolean().optional(),
    ability: z.boolean().optional(),
    passive: z.boolean().optional(),
    tags: z.array(z.enum(MORPH_TAGS)).optional(),
  }),
]);

/**
 * Wort zerlegen: Grenzen setzen und jedem Stück seine Rolle geben. Wird im Build aus
 * Grammatikübungen erzeugt (`from`); `analysis` bildet die Form in der Engine neu.
 * Leerzeichen (Fragepartikel) und Apostroph sind feste Grenzen, keine Bausteine.
 * `alt_segments`: zweite, ebenso übliche Zerlegung mit denselben Rollen (Präsens: bekl-iyor
 * der Engine, bekli-yor der Lehrbücher); erzeugt der Build, der Build-Check prüft sie.
 */
const SegmentPieces = z.array(z.strictObject({ text: nonEmpty, tag: z.enum(SEGMENT_TAGS) })).min(2);

export const Segment = z
  .strictObject({
    ...exerciseBase,
    type: z.literal('segment'),
    word: nonEmpty,
    segments: SegmentPieces,
    alt_segments: SegmentPieces.optional(),
    analysis: FormSpec,
    from: nonEmpty,
  })
  .superRefine((e, ctx) => {
    for (const key of ['segments', 'alt_segments'] as const) {
      const segs = e[key];
      if (!segs) continue;
      if (segs[0]!.tag !== 'STEM' || segs.slice(1).some((s) => s.tag === 'STEM')) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'nur das erste Stück ist STEM' });
      }
      if (segs.map((s) => s.text).join('') !== e.word.replace(/[\s'’]/g, '')) {
        ctx.addIssue({ code: 'custom', path: [key], message: `ergeben nicht "${e.word}"` });
      }
    }
  });

/**
 * Satzbau: Satzglieder in türkische Reihenfolge bringen. `chunks` in Grundreihenfolge (Anzeige:
 * erstes Wort klein, außer Namen), `text` = ganzer Satz; richtig sind nur Grundreihenfolge und
 * `orders`. Wird im Build aus annotierten Wortbank-Sätzen erzeugt (`from`).
 */
export const SovPuzzle = z.strictObject({
  ...exerciseBase,
  type: z.literal('sov_puzzle'),
  prompt: nonEmpty,
  text: nonEmpty,
  chunks: z.array(Chunk).min(3),
  orders: z.array(ChunkOrder).min(1).optional(),
  from: nonEmpty.optional(),
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

/** Wort im Lesetext, vom Build aufgelöst (`annotatePassage`); Lücken (Leerzeichen, Satzzeichen) ohne `w`. */
export const PassageToken = z.strictObject({
  text: z.string().min(1),
  /** Wort (antippbar); fehlt bei Leerzeichen und Satzzeichen. */
  w: z.literal(true).optional(),
  /** Vokabel-ID (`vocabId`) der Grundform. */
  vocab: nonEmpty.optional(),
  /** Deutsche Glosse aus dem `glossary` des Textes. */
  gloss: nonEmpty.optional(),
});

export const Passage = z.strictObject({
  title_tr: nonEmpty.optional(),
  /** Satzweise: türkischer Text und deutsche Übersetzung (auf Wunsch eingeblendet). */
  sentences: z.array(z.strictObject({ tr: nonEmpty, de: nonEmpty })).min(1),
  /**
   * Wörter, die der Kurs nicht als Vokabel führt (Namen, Formen jenseits der Engine). `tr` ist
   * die Form im Text (oder bei Namen der Teil vor dem Apostroph); `vocab` verweist optional auf
   * die Grundform (güzeldi → güzel).
   */
  glossary: z
    .array(z.strictObject({ tr: nonEmpty, de: nonEmpty, vocab: nonEmpty.optional() }))
    .optional(),
  /** Vom Build erzeugt, je Satz die Wörter mit Auflösung; in der YAML nicht setzen. */
  tokens: z.array(z.array(PassageToken)).optional(),
  reviewed: z.boolean().optional(),
  ...provenanceOverride,
});

export const Lesson = z
  .strictObject({
    id: nonEmpty,
    type: z.enum(LESSON_TYPES),
    title: nonEmpty,
    /** Lesetext (nur `type: reading`); die Übungen sind die Verständnisfragen dazu. */
    passage: Passage.optional(),
    exercises: z.array(Exercise).min(1),
  })
  .superRefine((lesson, ctx) => {
    if (lesson.passage && lesson.type !== 'reading') {
      ctx.addIssue({ code: 'custom', path: ['passage'], message: 'passage nur bei type: reading' });
    }
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
export type Passage = z.infer<typeof Passage>;
export type PassageToken = z.infer<typeof PassageToken>;
export type Unit = z.infer<typeof Unit>;
export type FormSpec = z.infer<typeof FormSpec>;

/** Vokabel-ID für SRS; Default ist das türkische Lemma. */
export const vocabId = (v: Vocab): string => v.id ?? v.tr;
