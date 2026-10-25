import type { Exercise, Vocab } from '../content/schema';
import { inflect, type Inflection, type Stem } from '../morphology';
import { suffixVariants } from '../morphology/variants';
import { seededShuffle } from './grade';

type SuffixBuilder = Extract<Exercise, { type: 'suffix_builder' }>;

export interface SuffixTiles {
  /** Bausteine (Stammformen + Suffixvarianten), stabil gemischt. */
  tokens: string[];
  /** Zerlegung und Begründung der richtigen Lösung. */
  solution: Inflection;
}

/** Stamm samt lexikalischer Flags aus dem Wortschatz der Unit. */
export function stemFor(ex: SuffixBuilder, vocab: readonly Vocab[] = []): Stem {
  const v = vocab.find((x) => x.tr === ex.stem);
  return { form: ex.stem, softens: v?.softens, harmonyVowel: v?.harmony_vowel };
}

const MAX_DISTRACTORS_PER_SLOT = 1;

/** Richtige Segmente aus der Engine plus plausibel falsche Varianten (falsche Harmonie etc.). */
export function suffixTiles(ex: SuffixBuilder, vocab: readonly Vocab[] = []): SuffixTiles {
  const stem = stemFor(ex, vocab);
  const solution = inflect(stem, ex.suffixes);
  const correct = new Set(solution.segments.map((s) => s.text));

  const distractors: string[] = [];
  const add = (candidates: string[], seed: string) => {
    const pool = candidates.filter((c) => c && !correct.has(c) && !distractors.includes(c));
    distractors.push(...seededShuffle(pool, seed).slice(0, MAX_DISTRACTORS_PER_SLOT));
  };

  // Stamm: ungeänderte Form als Ablenker, wenn die Erweichung sie verändert hat.
  const stemSegment = solution.segments[0]!.text;
  if (stemSegment !== ex.stem) add([ex.stem], `${ex.id}-stem`);
  ex.suffixes.forEach((tag, i) => add(suffixVariants(tag), `${ex.id}-${i}`));

  return {
    tokens: seededShuffle([...correct, ...distractors], ex.id),
    solution,
  };
}
