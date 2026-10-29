import { trLower } from '../lib/turkish';
import {
  conjugate,
  inflect,
  PERSONS,
  predicate,
  type Inflection,
  type MorphTag,
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
  const flags = { person: spec.person, negative: spec.negative, question: spec.question };
  return spec.kind === 'verb'
    ? conjugate(stem, {
        tense: spec.tense ?? 'present',
        ability: spec.ability,
        polite: spec.polite,
        passive: spec.passive,
        compound: spec.compound,
        ...flags,
      })
    : predicate(stem, { ...flags, dir: spec.dir, tense: copulaTense(spec.tense) });
}

/** Formangabe einer Grammatikübung bzw. einer Tabellenzeile (ohne Lösung und IDs). */
export function formSpecOf(ex: EngineExercise | ParadigmExercise, row = 0): FormSpec {
  if (ex.type === 'suffix_builder') return { kind: 'noun', lemma: ex.stem, tags: ex.suffixes };
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
  if (typeof r !== 'string') return { kind: 'noun', lemma: ex.lemma, tags: r };
  const kind = ex.kind as 'verb' | 'copula'; // Personenzeilen gibt es nur bei Verb und Kopula
  return defined({ kind, lemma: ex.lemma, person: r, ...verbal });
}

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

/** Zeilen einer Tabelle: Tag-Folgen (Nomen) oder Personen (Verb, Kopula). */
export function paradigmRows(ex: ParadigmExercise): (MorphTag[] | Person)[] {
  return ex.kind === 'noun' ? (ex.rows ?? []) : (ex.persons ?? [...PERSONS]);
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
