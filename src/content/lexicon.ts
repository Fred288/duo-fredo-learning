import { trLower } from '../lib/turkish';
import { conjugate, inflect, predicate, type Inflection, type Stem } from '../morphology';
import type { Exercise, Vocab } from './schema';

export type EngineExercise = Extract<Exercise, { type: 'suffix_builder' | 'conjugation' }>;

/** Stamm samt lexikalischer Flags (Erweichung, Harmonie, Vokalausfall, Eigenname) aus dem Wortschatz. */
export function stemFromVocab(form: string, vocab: readonly Vocab[] = []): Stem {
  const v = vocab.find((x) => x.tr === form);
  return {
    form,
    softens: v?.softens,
    harmonyVowel: v?.harmony_vowel,
    dropsVowel: v?.drops_vowel,
    proper: v?.proper,
    capitalized: v?.capitalized,
  };
}

/** Von der Engine gebildete Lösung einer Grammatikübung (Form, Segmente, Begründung). */
export function solveExercise(ex: EngineExercise, vocab: readonly Vocab[] = []): Inflection {
  if (ex.type === 'suffix_builder') return inflect(stemFromVocab(ex.stem, vocab), ex.suffixes);
  const stem = stemFromVocab(ex.lemma, vocab);
  const flags = { person: ex.person, negative: ex.negative, question: ex.question };
  return ex.mode === 'verb'
    ? conjugate(stem, { tense: 'present', ...flags })
    : predicate(stem, { ...flags, dir: ex.dir });
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
