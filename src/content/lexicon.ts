import { trLower } from '../lib/turkish';
import {
  conjugate,
  conjugateVariants,
  inflect,
  nonfinite,
  PERSONS,
  predicate,
  type ConjugateOptions,
  type Inflection,
  type MorphTag,
  type NonfiniteTag,
  type Person,
  type Stem,
} from '../morphology';
import type { Exercise, FormSpec, Vocab } from './schema';

export type EngineExercise = Extract<Exercise, { type: 'suffix_builder' | 'conjugation' }>;
export type ParadigmExercise = Extract<Exercise, { type: 'paradigm' }>;

/** Stamm samt lexikalischer Flags (Erweichung, Harmonie, Vokalausfall, Eigenname) aus dem Wortschatz. */
export function stemFromVocab(
  form: string,
  vocab: readonly Vocab[] = [],
): Stem & { aorist?: 'ar' | 'ir' } {
  const v = vocab.find((x) => x.tr === form);
  return {
    form,
    softens: v?.softens,
    harmonyVowel: v?.harmony_vowel,
    dropsVowel: v?.drops_vowel,
    proper: v?.proper,
    capitalized: v?.capitalized,
    yStem: v?.y_stem,
    aorist: v?.aorist,
  };
}

/** Engine-Form zu einer Formangabe (Nomen mit Tags, Verb oder Kopula mit Person). */
export function solveForm(spec: FormSpec, vocab: readonly Vocab[] = []): Inflection {
  const stem = stemFromVocab(spec.lemma, vocab);
  if (spec.kind === 'noun') return inflect(stem, spec.tags);
  if (spec.kind === 'verbal') {
    return nonfinite(stem, {
      form: spec.form,
      negative: spec.negative,
      ability: spec.ability,
      passive: spec.passive,
      tags: spec.tags,
    });
  }
  const flags = { person: spec.person, negative: spec.negative, question: spec.question };
  return spec.kind === 'verb'
    ? conjugate(stem, verbOptions(spec))
    : predicate(stem, { ...flags, dir: spec.dir, tense: copulaTense(spec.tense) });
}

const verbOptions = (spec: Extract<FormSpec, { kind: 'verb' | 'copula' }>): ConjugateOptions => ({
  tense: spec.tense ?? 'present',
  ability: spec.ability,
  polite: spec.polite,
  passive: spec.passive,
  compound: spec.compound,
  person: spec.person,
  negative: spec.negative,
  question: spec.question,
});

/** Ebenso richtige Nebenformen der Engine (3. Person Plural mit Kopula: geliyordular). */
export function formVariants(spec: FormSpec, vocab: readonly Vocab[] = []): string[] {
  if (spec.kind !== 'verb') return [];
  return conjugateVariants(stemFromVocab(spec.lemma, vocab), verbOptions(spec));
}

/**
 * Trägt die Nebenformen als `alt_targets` in Konjugationen und Tabellen ein (im Build), damit
 * die Bewertung sie ohne Engine annimmt. Tabellen: je Zeile eine Liste, leer = keine.
 */
export function withAlternatives<U extends { lessons: { exercises: Exercise[] }[] }>(
  unit: U,
  vocab: readonly Vocab[],
): U {
  const annotate = (ex: Exercise): Exercise => {
    if (ex.type === 'conjugation') {
      const alt = formVariants(formSpecOf(ex), vocab);
      return alt.length ? { ...ex, alt_targets: alt } : ex;
    }
    if (ex.type === 'paradigm' && (ex.kind === 'verb' || ex.kind === 'copula')) {
      const alt = paradigmRows(ex).map((_, i) => formVariants(formSpecOf(ex, i), vocab));
      return alt.some((a) => a.length) ? { ...ex, alt_targets: alt } : ex;
    }
    return ex;
  };
  return {
    ...unit,
    lessons: unit.lessons.map((l) => ({ ...l, exercises: l.exercises.map(annotate) })),
  };
}

/** Formangabe einer Grammatikübung bzw. einer Tabellenzeile (ohne Lösung und IDs). */
export function formSpecOf(ex: EngineExercise | ParadigmExercise, row = 0): FormSpec {
  if (ex.type === 'suffix_builder') {
    if (!ex.verbal) return { kind: 'noun', lemma: ex.stem, tags: ex.suffixes };
    return verbalSpec(ex.stem, ex.verbal, ex, ex.suffixes);
  }
  const verbal = {
    tense: ex.tense,
    negative: ex.negative,
    question: ex.question,
    ability: ex.ability,
    polite: ex.polite,
    passive: ex.passive,
    compound: ex.compound,
  };
  if (ex.type === 'conjugation') {
    return defined({ kind: ex.mode, lemma: ex.lemma, person: ex.person, dir: ex.dir, ...verbal });
  }
  const r = paradigmRows(ex)[row];
  if (r === undefined) throw new RangeError(`${ex.id}: keine Zeile ${row}`);
  if (typeof r !== 'string') {
    return ex.kind === 'verbal'
      ? verbalSpec(ex.lemma, ex.verbal!, ex, r)
      : { kind: 'noun', lemma: ex.lemma, tags: r };
  }
  const kind = ex.kind as 'verb' | 'copula'; // Personenzeilen gibt es nur bei Verb und Kopula
  return defined({ kind, lemma: ex.lemma, person: r, ...verbal });
}

/** Infinite Form (Partizip, Verbalnomen, Konverb) mit nominalen Endungen; leere Endungen fallen weg. */
const verbalSpec = (
  lemma: string,
  form: NonfiniteTag,
  ex: { negative?: boolean; ability?: boolean; passive?: boolean },
  tags: MorphTag[],
): FormSpec =>
  defined({
    kind: 'verbal' as const,
    lemma,
    form,
    negative: ex.negative,
    ability: ex.ability,
    passive: ex.passive,
    tags: tags.length ? tags : undefined,
  });

/** Ohne undefined-Felder: die Angabe landet im JSON und wird mit dem Schema verglichen. */
const defined = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Von der Engine gebildete Lösung einer Grammatikübung (Form, Segmente, Begründung). */
export function solveExercise(ex: EngineExercise, vocab: readonly Vocab[] = []): Inflection {
  return solveForm(formSpecOf(ex), vocab);
}

/** Schema stellt sicher, dass Kopula-Übungen nur present/past/evidential/conditional nutzen. */
const copulaTense = (tense?: string) =>
  tense === 'past' || tense === 'evidential' || tense === 'conditional' ? tense : undefined;

/** Zeilen einer Tabelle: Tag-Folgen (Nomen, infinite Form) oder Personen (Verb, Kopula). */
export function paradigmRows(ex: ParadigmExercise): (MorphTag[] | Person)[] {
  return ex.kind === 'noun' || ex.kind === 'verbal'
    ? (ex.rows ?? [])
    : (ex.persons ?? [...PERSONS]);
}

/** Engine-Lösung je Tabellenzeile. */
export function solveParadigm(ex: ParadigmExercise, vocab: readonly Vocab[] = []): Inflection[] {
  return paradigmRows(ex).map((_, i) => solveForm(formSpecOf(ex, i), vocab));
}

/**
 * Vergleich Inhalt ↔ Engine: Groß/Klein zählt nur, wo die Engine großschreibt (Eigennamen),
 * Satzzeichen am Ende (Fragezeichen) werden ignoriert.
 */
export function sameForm(engine: string, target: string): boolean {
  const clean = (s: string) =>
    s
      .normalize('NFC')
      .trim()
      .replace(/[?.!]+$/, '');
  const [a, b] = [clean(engine), clean(target)];
  return /\p{Lu}/u.test(a) ? a === b : a === trLower(b);
}
